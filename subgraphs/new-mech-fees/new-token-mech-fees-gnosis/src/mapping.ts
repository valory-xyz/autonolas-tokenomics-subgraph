import { Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceToken/BalanceTrackerFixedPriceToken"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import {
  BURN_ADDRESS_MECH_FEES_GNOSIS,
  BALANCER_VAULT_ADDRESS_GNOSIS,
  OLAS_WXDAI_POOL_ADDRESS_GNOSIS,
  OLAS_ADDRESS_GNOSIS,
  WXDAI_ADDRESS_GNOSIS
} from "../../../../shared/constants"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  getOlasInUsd
} from "../../../../shared/new-mech-fees/utils"
import { BalancerV2Vault } from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceToken/BalancerV2Vault";
import { BalancerV2WeightedPool } from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceToken/BalancerV2WeightedPool";

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);
const VAULT_ADDRESS = Address.fromString(BALANCER_VAULT_ADDRESS_GNOSIS);
const POOL_ADDRESS = Address.fromString(OLAS_WXDAI_POOL_ADDRESS_GNOSIS);
const OLAS_ADDRESS = Address.fromString(OLAS_ADDRESS_GNOSIS);
const WXDAI_ADDRESS = Address.fromString(WXDAI_ADDRESS_GNOSIS);

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
  
  const deliveryRateUsd = getOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    WXDAI_ADDRESS,
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

  // Get pool ID safely
  const poolId = getPoolIdSafe(POOL_ADDRESS);

  const withdrawalAmountUsd = getOlasInUsd(
    VAULT_ADDRESS,
    poolId,
    OLAS_ADDRESS,
    WXDAI_ADDRESS,
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