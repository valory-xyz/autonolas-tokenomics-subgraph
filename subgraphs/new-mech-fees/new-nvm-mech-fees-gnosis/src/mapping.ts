// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/BalanceTrackerNvmSubscriptionNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS } from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut, calculateGnosisNvmFeesIn, convertGnosisNativeWeiToUsd } from "../../../../shared/new-mech-fees/utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);

export function handleMechBalanceAdjusted(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = calculateGnosisNvmFeesIn(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesIn = BigDecimal.fromString("0");
    mech.totalFeesOut = BigDecimal.fromString("0");
  }
  mech.totalFeesIn = mech.totalFeesIn.plus(earningsAmountUsd);
  mech.save();
}

export function handleWithdraw(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountWei = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertGnosisNativeWeiToUsd(withdrawalAmountWei);

  updateTotalFeesOut(withdrawalAmountUsd);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalFeesOut = mech.totalFeesOut.plus(withdrawalAmountUsd);
    mech.save();
  }
} 