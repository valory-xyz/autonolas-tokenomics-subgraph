// src/mapping.ts

import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS, ETH_DECIMALS } from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut } from "./utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);

function convertWeiToUsd(amountInWei: BigInt): BigInt {
  const ethDivisor = BigInt.fromI32(10).pow(ETH_DECIMALS as u8);
  return amountInWei.div(ethDivisor);
}

export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = convertWeiToUsd(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesIn = BigInt.fromI32(0);
    mech.totalFeesOut = BigInt.fromI32(0);
  }
  mech.totalFeesIn = mech.totalFeesIn.plus(earningsAmountUsd);
  mech.save();
}

export function handleWithdrawForNative(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountWei = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertWeiToUsd(withdrawalAmountWei);

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOut = mech.totalFeesOut.plus(withdrawalAmountUsd);
    mech.save();
  }
}