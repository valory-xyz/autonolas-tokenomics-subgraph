# New Mech Fees Subgraphs

A blockchain indexing system that tracks fees for autonomous agents (mechs) interacting with the new marketplace contracts. This system covers multiple payment models across Gnosis and Base networks.

## Overview

These subgraphs provide real-time tracking of every fee-in (accrual) and fee-out (collection) event for mechs. By logging each transaction, the subgraphs enable detailed time-based analysis, such as calculating daily and weekly fees per mech.

The system is split into six subgraphs, one for each combination of payment model and network.

## Subgraph Details

| Payment Model | Network | Balance Tracker Contract |
| :--- | :--- | :--- |
| **Native** | Gnosis (xdai) | `0x21cE6799A22A3Da84B7c44a814a9c79ab1d2A50D` |
| **Native** | Base | `0xB3921F8D8215603f0Bd521341Ac45eA8f2d274c1` |
| **NVM** | Gnosis (xdai) | `0x7D686bD1fD3CFF6E45a40165154D61043af7D67c` |
| **NVM** | Base | `0xaafbeef195bdab1bb6f3dc9ceba875cd72499230` |
| **Token (OLAS)** | Gnosis (xdai) | `0x53Bd432516707a5212A70216284a99A563aAC1D1` |
| **Token (OLAS)** | Base | `0x43fB32f25dce34EB76c78C7A42C8F40F84BCD237` |

## Core Entities

- **`Mech`**: Central entity for a mech, identified by its address. It stores the lifetime totals for fees in and out, both in raw units and USD.
- **`Global`**: A singleton entity that aggregates total fees in and out in USD across all mechs for a given subgraph.
- **`MechTransaction`**: A detailed record of every individual fee event (`MechBalanceAdjusted` or `Withdraw`). This is the core entity for time-based analysis. Each transaction is immutable.

## Raw Units (`amountRaw` and `totalFeesInRaw`/`totalFeesOutRaw`)

The raw fields in both `MechTransaction` and `Mech` entities represent amounts in their payment-model-specific native units. **Important: Raw units are NOT comparable across different payment models** - use USD fields for cross-model analysis.

| Payment Model | Network | Raw Unit | Description |
| :--- | :--- | :--- | :--- |
| **Native** | Gnosis | xDAI wei | Native token in wei (10^18) |
| **Native** | Base | ETH wei | Native token in wei (10^18) |
| **Token** | Gnosis | OLAS wei | OLAS token in wei (10^18) |
| **Token** | Base | OLAS wei | OLAS token in wei (10^18) |
| **NVM** | Gnosis | Credits | Abstract credit units from `deliveryRate` |
| **NVM** | Base | Credits | Abstract credit units from `deliveryRate` |

### Raw Unit Consistency Rules

✅ **Within Payment Model**: Raw units are consistent and comparable
```graphql
# ✅ GOOD: Compare NVM mechs across networks
{
  gnosis_mech: mech(id: "0x...") { totalFeesInRaw }  # Credits
  base_mech: mech(id: "0x...") { totalFeesInRaw }    # Credits  
}
```

❌ **Across Payment Models**: Raw units are incompatible
```graphql
# ❌ AVOID: Mixing payment models in raw comparisons
{
  nvm_mech: mech(id: "0x...") { totalFeesInRaw }     # Credits
  native_mech: mech(id: "0x...") { totalFeesInRaw }  # Wei
}
```

✅ **Cross-Model Analysis**: Use USD fields instead
```graphql
# ✅ GOOD: Use USD for cross-payment-model analysis
{
  mechs {
    totalFeesInUSD   # Always comparable
    totalFeesOutUSD  # Always comparable
  }
}
```

### NVM Subgraphs - Credit Consistency

NVM subgraphs maintain **perfect credit consistency** across fee-in and fee-out operations:

**Implementation Logic:**
- **`FEE_IN`**: Stores credits directly from `deliveryRate` parameter
- **`FEE_OUT`**: Converts token withdrawals back to equivalent credits

**Formula Compliance (Documentation: `deliveryRate × tokenRatio ÷ (1e18 × 10^tokenDecimals)`):**

| Network | Token Ratio | Token Decimals | Formula |
|---------|-------------|----------------|---------|
| **Gnosis** | `990000000000000000000000000000` | 18 | `credits × 990...000 ÷ (1e18 × 1e18)` |
| **Base** | `990000000000000000` | 6 | `credits × 990...000 ÷ (1e18 × 1e6)` |

**Credit → Token Conversion:**
```typescript
// Gnosis: Credits → xDAI
xdai_amount = (credits * 990000000000000000000000000000) / (1e18 * 1e18)

// Base: Credits → USDC  
usdc_amount = (credits * 990000000000000000) / (1e18 * 1e6)
```

**Benefits:**
- ✅ `totalFeesInRaw - totalFeesOutRaw` gives meaningful net credit balance
- ✅ Perfect consistency between Gnosis and Base NVM implementations
- ✅ Cross-network credit comparisons are mathematically valid

## Data Validation & USD Conversion

### Raw → USD Conversion
All raw values can be converted back to USD using the same formulas used during indexing:

| Payment Model | Network | Conversion Function |
|---------------|---------|-------------------|
| **NVM** | Gnosis | `raw_credits × 990000000000000000000000000000 ÷ (1e18 × 1e18)` |
| **NVM** | Base | `raw_credits × 990000000000000000 ÷ (1e18 × 1e6)` |
| **Native** | Gnosis | `raw_wei ÷ 1e18` (xDAI ≈ USD) |
| **Native** | Base | `(raw_wei ÷ 1e18) × current_eth_price` |
| **Token** | Both | Use Balancer pool data with `calculateOlasInUsd()` |

### Validation with Dune Analytics
The subgraph data can be validated against Dune Analytics queries that implement identical formulas:

**NVM Models:** Both Gnosis and Base have corresponding Dune queries with credit-consistent units
- Raw credits from subgraph should match `fees_in_raw_credits`/`fees_out_raw_credits` from Dune
- USD values should match exactly due to identical mathematical formulas

**Key Validation Points:**
- ✅ **Mathematical Consistency**: Same formulas = identical results
- ✅ **Unit Alignment**: Credits-to-credits, USD-to-USD comparisons  
- ✅ **Cross-Chain Validation**: Credit totals comparable between networks
- ✅ **Precision**: No rounding differences due to deterministic calculations

## Sample Queries

### Get Mech Lifetime Totals
This query fetches the total fees in and out for a specific mech over its entire lifetime.
```graphql
{
  mech(id: "0x...") {
    id
    totalFeesInUSD
    totalFeesOutUSD
    totalFeesInRaw
    totalFeesOutRaw
  }
}
```

### Get Daily Fee Transactions for a Mech
This query retrieves all fee transactions for a specific mech within a given time window (e.g., one day). The client can then aggregate these transactions to calculate the daily total.
```graphql
{
  mechTransactions(
    where: {
      mech: "0x...",
      timestamp_gte: "1672531200", # Start of day (Unix timestamp)
      timestamp_lt: "1672617600"  # End of day (Unix timestamp)
    },
    orderBy: timestamp,
    orderDirection: desc
  ) {
    id
    type # FEE_IN or FEE_OUT
    amountRaw
    amountUSD
    timestamp
    txHash
  }
}
```

### Get Global Fee Statistics
This query returns the total fees processed by the subgraph across all mechs.
```graphql
{
  global(id: "1") {
    totalFeesInUSD
    totalFeesOutUSD
  }
}
``` 