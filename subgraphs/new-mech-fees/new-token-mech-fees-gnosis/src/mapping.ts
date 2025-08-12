import { Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../common/generated/BalanceTrackerFixedPriceToken/BalanceTrackerFixedPriceToken"
import { Mech } from "../../common/generated/schema"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected,
  updateDailyTotalsIn,
  updateDailyTotalsOut,
  updateMechDailyIn,
  updateMechDailyOut
} from "../../common/utils"
import { calculateOlasInUsd } from "../../common/token-utils"
import { BalancerV2Vault } from "../../common/generated/BalanceTrackerFixedPriceToken/BalancerV2Vault";
import { BalancerV2WeightedPool } from "../../common/generated/BalanceTrackerFixedPriceToken/BalancerV2WeightedPool";
import { getBalancerVaultAddress, getOlasStablePoolAddress, getOlasTokenAddress, getStableTokenAddress, getBurnAddressMechFees } from "../../../../shared/constants";

const BURN_ADDRESS = getBurnAddressMechFees();
const VAULT_ADDRESS = getBalancerVaultAddress();
const POOL_ADDRESS = getOlasStablePoolAddress();
const OLAS_ADDRESS = getOlasTokenAddress();
const STABLE_ADDRESS = getStableTokenAddress();

function getPoolIdSafe(poolAddress: Address): Bytes {
  // For Balancer V2, the pool ID is typically the pool address + some additional data
  // We'll try to get it from the pool contract directly instead of through the vault
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

  // Get pool ID safely
  const poolId = getPoolIdSafe(POOL_ADDRESS);
  
  const deliveryRateUsd = calculateOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    STABLE_ADDRESS,
    18,
    deliveryRateOlas
  );

  updateTotalFeesIn(deliveryRateUsd);
  updateMechFeesIn(mechId, deliveryRateUsd, deliveryRateOlas.toBigDecimal());
  updateDailyTotalsIn(deliveryRateUsd, event.block.timestamp);
  updateMechDailyIn(mechId, deliveryRateUsd, deliveryRateOlas.toBigDecimal(), event.block.timestamp);

  // Create MechTransaction for the accrued fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateOlas.toBigDecimal(),
      deliveryRateUsd,
      event,
      event.params.deliveryRate,
      event.params.balance,
      event.params.rateDiff
    );
  }
}

export function handleWithdrawForToken(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountOlas = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  // Get pool ID safely
  const poolId = getPoolIdSafe(POOL_ADDRESS);

  const withdrawalAmountUsd = calculateOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    STABLE_ADDRESS,
    18,
    withdrawalAmountOlas
  );

  updateTotalFeesOut(withdrawalAmountUsd);
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalAmountOlas.toBigDecimal());
  updateDailyTotalsOut(withdrawalAmountUsd, event.block.timestamp);
  updateMechDailyOut(mechId, withdrawalAmountUsd, withdrawalAmountOlas.toBigDecimal(), event.block.timestamp);

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalAmountOlas.toBigDecimal(),
      withdrawalAmountUsd,
      event
    );
  }
} 