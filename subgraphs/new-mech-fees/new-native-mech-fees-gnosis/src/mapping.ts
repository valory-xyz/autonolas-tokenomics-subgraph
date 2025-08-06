// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS } from "../../../../shared/constants"
import { updateTotalFeesIn, updateTotalFeesOut, convertGnosisNativeWeiToUsd } from "../../../../shared/new-mech-fees/utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);

export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = convertGnosisNativeWeiToUsd(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);

  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesInUSD = BigDecimal.fromString("0");
    mech.totalFeesOutUSD = BigDecimal.fromString("0");
    mech.totalFeesInRaw = BigDecimal.fromString("0");
    mech.totalFeesOutRaw = BigDecimal.fromString("0");
  }
  mech.totalFeesInUSD = mech.totalFeesInUSD.plus(earningsAmountUsd);
  mech.totalFeesInRaw = mech.totalFeesInRaw.plus(earningsAmountWei.toBigDecimal());
  mech.save();
}

export function handleWithdrawForNative(event: Withdraw): void {
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
    mech.totalFeesOutUSD = mech.totalFeesOutUSD.plus(withdrawalAmountUsd);
    mech.totalFeesOutRaw = mech.totalFeesOutRaw.plus(
      withdrawalAmountWei.toBigDecimal()
    );
    mech.save();
  }
}