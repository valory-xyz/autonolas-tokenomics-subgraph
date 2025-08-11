### Token payment pricing via Balancer pools

- **Scope**: New Mech Fees (Token model) on Base and Gnosis
- **Goal**: Convert OLAS amounts (raw) to USD using on-chain Balancer V2 pool balances

### Networks and pools
- **Base**
  - Stablecoin: USDC (6 decimals)
  - Pool: OLAS–USDC (Balancer V2)
- **Gnosis**
  - Stablecoin: WXDAI (18 decimals; treated ≈ USD)
  - Pool: OLAS–WXDAI (Balancer V2)

### Data sources used
- Weighted Pool contract: `getPoolId()` → `poolId`
- Balancer Vault: `getPoolTokens(poolId)` → token addresses and balances

### Pricing model
- Spot price proxy from pool balances (deterministic, on-chain):
  - Let `B_olas` be the OLAS pool balance (18 decimals)
  - Let `B_stable` be the stablecoin pool balance (USDC 6 or WXDAI 18)
  - Price per OLAS in USD ≈ `B_stable / B_olas`
  - Amount in USD = `olasAmount × (B_stable / B_olas)` with proper decimal normalization
- We do not model pool weights/fees; balance ratio is used as a simple spot proxy (KISS)

### Implementation (shared utils)
- Core function used by both Base and Gnosis token subgraphs:

```ts
// shared/new-mech-fees/utils.ts
export function calculateOlasInUsd(
  vaultAddress: Address,
  poolId: Bytes,
  olasAddress: Address,
  stablecoinAddress: Address,
  stablecoinDecimals: i32,
  olasAmount: BigInt
): BigDecimal {
  // 1) guard: zero pool id
  if (poolId.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"))) {
    log.warning("Zero pool ID provided for OLAS price calculation", []);
    return BigDecimal.fromString("0");
  }

  // 2) fetch balances from vault
  const vault = BalancerV2Vault.bind(vaultAddress);
  const balances = getPoolTokenBalances(vault, poolId, olasAddress, stablecoinAddress);
  const olasBalance = balances[0];
  const stablecoinBalance = balances[1];

  // 3) guard: invalid balances
  if (olasBalance.isZero() || stablecoinBalance.isZero()) {
    log.warning("Invalid pool balances for pool {}", [poolId.toHexString()]);
    return BigDecimal.fromString("0");
  }

  // 4) price × amount (decimals handled internally)
  return calculateOlasPriceFromPool(olasAmount, olasBalance, stablecoinBalance, stablecoinDecimals);
}
```

- Each token mapping retrieves `poolId` safely:

```ts
// subgraphs/new-mech-fees/new-token-mech-fees-*/src/mapping.ts
function getPoolIdSafe(poolAddress: Address): Bytes {
  const pool = BalancerV2WeightedPool.bind(poolAddress);
  const poolIdResult = pool.try_getPoolId();
  if (poolIdResult.reverted) {
    log.warning("Could not get pool ID for pool {}, using placeholder", [poolAddress.toHexString()]);
    return Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000");
  }
  return poolIdResult.value;
}
```

### Decimals
- OLAS: 18 decimals (both networks)
- Stablecoin:
  - Base: USDC (6 decimals)
  - Gnosis: WXDAI (18 decimals)

### Edge cases and safeguards
- If `getPoolId()` reverts → use zero pool ID and return `0` USD
- If either pool balance is zero → return `0` USD
- Pure read-only usage; no swaps or on-chain writes are performed

### Why Balancer pools (not oracles)?
- OLAS does not have a universal USD oracle across chains
- Pool balances provide a live on-chain proxy price which may occasionally deviate from fair market value due to potential pool manipulation. However, we expect these discrepancies to self-correct over time through arbitrage activity.```

### Where this is used
- Token model handlers for both fee-in (`MechBalanceAdjusted`) and fee-out (`Withdraw`):
  - Base: `subgraphs/new-mech-fees/new-token-mech-fees-base/src/mapping.ts`
  - Gnosis: `subgraphs/new-mech-fees/new-token-mech-fees-gnosis/src/mapping.ts`
- The handlers call `calculateOlasInUsd(...)` to compute USD amounts, then update:
  - Global totals (`Global.totalFeesInUSD`, `Global.totalFeesOutUSD`)
  - Per‑mech totals (USD and raw)
  - Immutable per‑event `MechTransaction` records 

### Step-by-step flow (what calls what, and when)

- **Fee-in (MechBalanceAdjusted)**
  1. Event arrives: `MechBalanceAdjusted` with `deliveryRate` (OLAS amount) and `mech` address
  2. Resolve `mechId = mech.toHex()`
  3. Get pool ID safely via `getPoolIdSafe(POOL_ADDRESS)`
     - If `try_getPoolId()` reverts → zero pool ID placeholder
  4. Compute USD: `calculateOlasInUsd(VAULT_ADDRESS, poolId, OLAS_ADDRESS, STABLE_ADDRESS, STABLE_DECIMALS, deliveryRate)`
     - If pool ID is zero or balances invalid → returns `0`
  5. Update global totals: `updateTotalFeesIn(amountUsd)`
  6. Update mech totals: `updateMechFeesIn(mechId, amountUsd, deliveryRate.toBigDecimal())`
  7. Record transaction: `createMechTransactionForAccrued(mech, raw=deliveryRate, usd=amountUsd, event, deliveryRate, balance, rateDiff)`

- **Fee-out (Withdraw)**
  1. Event arrives: `Withdraw` with `account` (recipient/mech) and `amount` (OLAS amount)
  2. If `account == BURN_ADDRESS` → exit early (ignore burns)
  3. Resolve `mechId = account.toHex()`
  4. Get pool ID safely via `getPoolIdSafe(POOL_ADDRESS)`
  5. Compute USD: `calculateOlasInUsd(VAULT_ADDRESS, poolId, OLAS_ADDRESS, STABLE_ADDRESS, STABLE_DECIMALS, amount)`
     - If pool ID is zero or balances invalid → returns `0`
  6. Update global totals: `updateTotalFeesOut(amountUsd)`
  7. Update mech totals: `updateMechFeesOut(mechId, amountUsd, amount.toBigDecimal())`
  8. Record transaction: `createMechTransactionForCollected(mech, raw=amount, usd=amountUsd, event)`

- **Safeguards and outcomes**
  - Pool ID failure or invalid balances → USD computed as `0`; records are still created, keeping raw values intact
  - All updates are additive and idempotent per event (unique `txHash-logIndex` IDs for transactions)
  - Flow is identical on Base and Gnosis; only the stablecoin address/decimals differ 