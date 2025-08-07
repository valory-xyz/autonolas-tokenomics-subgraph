// src/mapping.ts

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/BalanceTrackerNvmSubscriptionNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { 
  BURN_ADDRESS_MECH_FEES_BASE,
  CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD,
  CHAINLINK_PRICE_FEED_DECIMALS,
  ETH_DECIMALS
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
  const deliveryRateFromEvent = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink for tx: {}", [event.transaction.hash.toHex()]);
    return;
  }
  
  // 1. Calculate the fee in ETH value from the abstract deliveryRate
  const deliveryRateInEth = calculateBaseNvmFeesIn(deliveryRateFromEvent);

  // 2. Calculate the fee in USD
  const priceDivisor = BigInt.fromI32(10)
    .pow(CHAINLINK_PRICE_FEED_DECIMALS as u8)
    .toBigDecimal();
  const deliveryRateUsd = deliveryRateInEth
    .times(latestRoundData.value.value1.toBigDecimal())
    .div(priceDivisor);

  // 3. Calculate the fee in wei for raw storage
  const ethMultiplier = BigInt.fromI32(10).pow(ETH_DECIMALS as u8).toBigDecimal();
  const deliveryRateInWei = deliveryRateInEth.times(ethMultiplier);

  // 4. Update global and mech-specific totals
  updateTotalFeesIn(deliveryRateUsd);
  updateMechFeesIn(mechId, deliveryRateUsd, deliveryRateInWei);

  // 5. Create the transaction record
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateInWei,
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