// src/mapping.ts

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../generated/schema"
import {
  BURN_ADDRESS_MECH_FEES_GNOSIS,
  CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD ,
  CHAINLINK_PRICE_FEED_DECIMALS,
  ETH_DECIMALS
} from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut, convertWeiToUsd } from "./utils"
import { AggregatorV3Interface } from "../generated/BalanceTrackerFixedPriceNative/AggregatorV3Interface"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);
const PRICE_FEED_ADDRESS = Address.fromString(CHAINLINK_PRICE_FEED_ADDRESS_BASE_ETH_USD);


export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const deliveryRateEth = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  // Get the ETH price in USD from Chainlink
  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink", []);
    return;
  }

  const deliveryRateUsd = convertWeiToUsd(
    deliveryRateEth,
    latestRoundData.value.value1,
    CHAINLINK_PRICE_FEED_DECIMALS,
    ETH_DECIMALS
  );

  updateTotalFeesIn(deliveryRateUsd);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesIn = BigDecimal.fromString("0");
    mech.totalFeesOut = BigDecimal.fromString("0");
  }
  mech.totalFeesIn = mech.totalFeesIn.plus(deliveryRateUsd);
  mech.save();
}

export function handleWithdrawForNative(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountWei = event.params.amount;
  const mechId = recipientAddress.toHex();

  // Exit if the withdrawal is to the burn address
  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  // Get the ETH price in USD from Chainlink
  const priceFeed = AggregatorV3Interface.bind(PRICE_FEED_ADDRESS);
  const latestRoundData = priceFeed.try_latestRoundData();

  if (latestRoundData.reverted) {
    log.error("Could not get price from Chainlink", []);
    return;
  }

  const withdrawalAmountUsd = convertWeiToUsd(
    withdrawalAmountWei,
    latestRoundData.value.value1,
    CHAINLINK_PRICE_FEED_DECIMALS,
    ETH_DECIMALS
  );

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOut = mech.totalFeesOut.plus(withdrawalAmountUsd);
    mech.save();
  }
}