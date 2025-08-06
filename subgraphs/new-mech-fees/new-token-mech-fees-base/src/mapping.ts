import { Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceToken/BalanceTrackerFixedPriceToken"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import {
  BURN_ADDRESS_MECH_FEES_BASE,
  BALANCER_VAULT_ADDRESS_BASE,
  OLAS_USDC_POOL_ADDRESS_BASE,
  OLAS_ADDRESS_BASE,
  USDC_ADDRESS_BASE
} from "../../../../shared/constants"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  calculateOlasInUsd
} from "../../../../shared/new-mech-fees/utils"
import { BalancerV2WeightedPool } from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceToken/BalancerV2WeightedPool";

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);
const VAULT_ADDRESS = Address.fromString(BALANCER_VAULT_ADDRESS_BASE);
const POOL_ADDRESS = Address.fromString(OLAS_USDC_POOL_ADDRESS_BASE);
const OLAS_ADDRESS = Address.fromString(OLAS_ADDRESS_BASE);
const USDC_ADDRESS = Address.fromString(USDC_ADDRESS_BASE);

function getPoolIdSafe(poolAddress: Address): Bytes {
  const pool = BalancerV2WeightedPool.bind(poolAddress);
  const poolIdResult = pool.try_getPoolId();
  
  if (poolIdResult.reverted) {
    log.warning("Could not get pool ID for pool {}, using placeholder", [poolAddress.toHexString()]);
    return Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000");
  }
  
  return poolIdResult.value;
}

export function handleMechBalanceAdjustedForToken(event: MechBalanceAdjusted): void {
  const deliveryRateOlas = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const poolId = getPoolIdSafe(POOL_ADDRESS);
  
  const deliveryRateUsd = calculateOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    USDC_ADDRESS,
    6,
    deliveryRateOlas
  );

  updateTotalFeesIn(deliveryRateUsd);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesInUSD = BigDecimal.fromString("0");
    mech.totalFeesOutUSD = BigDecimal.fromString("0");
    mech.totalFeesInRaw = BigDecimal.fromString("0");
    mech.totalFeesOutRaw = BigDecimal.fromString("0");
  }
  mech.totalFeesInUSD = mech.totalFeesInUSD.plus(deliveryRateUsd);
  mech.totalFeesInRaw = mech.totalFeesInRaw.plus(deliveryRateOlas.toBigDecimal());
  mech.save();
}

export function handleWithdrawForToken(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountOlas = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const poolId = getPoolIdSafe(POOL_ADDRESS);

  const withdrawalAmountUsd = calculateOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    USDC_ADDRESS,
    6,
    withdrawalAmountOlas
  );

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOutUSD = mech.totalFeesOutUSD.plus(withdrawalAmountUsd);
    mech.totalFeesOutRaw = mech.totalFeesOutRaw.plus(
      withdrawalAmountOlas.toBigDecimal()
    );
    mech.save();
  }
} 