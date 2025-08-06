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
  calculateBaseNvmFeesIn
} from "../../../../shared/new-mech-fees/utils";
import { AggregatorV3Interface } from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/AggregatorV3Interface"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);
const PRICE_FEED_ADDRESS = Address.fromString(CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD);

export function handleMechBalanceAdjusted(event: MechBalanceAdjusted): void {
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

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesInUSD = BigDecimal.fromString("0");
    mech.totalFeesOutUSD = BigDecimal.fromString("0");
    mech.totalFeesInRaw = BigDecimal.fromString("0");
    mech.totalFeesOutRaw = BigDecimal.fromString("0");
  }
  mech.totalFeesInUSD = mech.totalFeesInUSD.plus(deliveryRateUsd);
  mech.totalFeesInRaw = mech.totalFeesInRaw.plus(deliveryRateRaw);
  mech.save();
}

export function handleWithdraw(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountUsdc = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertBaseUsdcToUsd(withdrawalAmountUsdc);

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOutUSD = mech.totalFeesOutUSD.plus(withdrawalAmountUsd);
    mech.totalFeesOutRaw = mech.totalFeesOutRaw.plus(
      withdrawalAmountUsdc.toBigDecimal()
    );
    mech.save();
  }
} 