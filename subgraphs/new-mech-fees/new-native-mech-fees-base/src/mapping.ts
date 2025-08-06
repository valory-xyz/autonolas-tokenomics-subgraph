// src/mapping.ts

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { 
  BURN_ADDRESS_MECH_FEES_BASE,
  CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD
} from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut, convertBaseNativeWeiToUsd } from "../../../../shared/new-mech-fees/utils"
import { AggregatorV3Interface } from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceNative/AggregatorV3Interface"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);
const PRICE_FEED_ADDRESS = Address.fromString(CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD);


export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const deliveryRateEth = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink for tx: {}", [event.transaction.hash.toHex()]);
    return;
  }
  
  const deliveryRateUsd = convertBaseNativeWeiToUsd(
    deliveryRateEth,
    latestRoundData.value.value1
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
  mech.totalFeesInRaw = mech.totalFeesInRaw.plus(deliveryRateEth.toBigDecimal());
  mech.save();
}

export function handleWithdrawForNative(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountWei = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink for tx: {}", [event.transaction.hash.toHex()]);
    return;
  }

  const withdrawalAmountUsd = convertBaseNativeWeiToUsd(
    withdrawalAmountWei,
    latestRoundData.value.value1
  );

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOutUSD = mech.totalFeesOutUSD.plus(withdrawalAmountUsd);
    mech.totalFeesOutRaw = mech.totalFeesOutRaw.plus(
      withdrawalAmountWei.toBigDecimal()
    );
    mech.save();
  }
}