// src/mapping.ts

import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS } from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut } from "./utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);


export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const earningsAmount = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  updateTotalFeesIn(earningsAmount);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalEarned = BigInt.fromI32(0);
    mech.totalWithdrawn = BigInt.fromI32(0);
  }
  mech.totalEarned = mech.totalEarned.plus(earningsAmount);
  mech.save();
}

export function handleWithdrawForNative(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmount = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  updateTotalFeesOut(withdrawalAmount);

  const mech = Mech.load(mechId);
  if (mech != null) {
    mech.totalWithdrawn = mech.totalWithdrawn.plus(withdrawalAmount);
    mech.save();
  }
}