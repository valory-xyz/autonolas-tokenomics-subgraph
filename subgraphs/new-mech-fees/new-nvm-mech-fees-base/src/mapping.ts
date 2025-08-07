// src/mapping.ts

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/BalanceTrackerNvmSubscriptionNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { 
  BURN_ADDRESS_MECH_FEES_BASE,
  CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD
} from "../../../../shared/constants"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  calculateBaseNvmFeesInUsd,
  convertBaseUsdcToUsd,
  calculateBaseNvmFeesIn,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected
} from "../../../../shared/new-mech-fees/utils";
import { AggregatorV3Interface } from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/AggregatorV3Interface"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);
const PRICE_FEED_ADDRESS = Address.fromString(CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD);

export function handleMechBalanceAdjustedForNvm(event: MechBalanceAdjusted): void {
  const deliveryRateEth = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink for tx: {}", [event.transaction.hash.toHex()]);
    return;
  }
  
  const deliveryRateUsd = calculateBaseNvmFeesInUsd(
    deliveryRateEth,
    latestRoundData.value.value1
  );

  const deliveryRateRaw = calculateBaseNvmFeesIn(deliveryRateEth);

  updateTotalFeesIn(deliveryRateUsd);
  updateMechFeesIn(mechId, deliveryRateUsd, deliveryRateRaw);

  // Create MechTransaction for the accrued fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateRaw,
      deliveryRateUsd,
      event,
      event.params.deliveryRate,
      event.params.balance,
      event.params.rateDiff
    );
  }
}

export function handleWithdrawForNvm(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountUsdc = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertBaseUsdcToUsd(withdrawalAmountUsdc);

  updateTotalFeesOut(withdrawalAmountUsd);
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalAmountUsdc.toBigDecimal());

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalAmountUsdc.toBigDecimal(),
      withdrawalAmountUsd,
      event
    );
  }
} 