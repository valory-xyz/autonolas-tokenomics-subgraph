// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS } from "../../../../shared/constants"
import { 
  updateTotalFeesIn, 
  updateTotalFeesOut, 
  convertGnosisNativeWeiToUsd,
  updateMechFeesIn,
  updateMechFeesOut
} from "../../../../shared/new-mech-fees/utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);

export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = convertGnosisNativeWeiToUsd(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);
  updateMechFeesIn(mechId, earningsAmountUsd, earningsAmountWei.toBigDecimal());
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
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalAmountWei.toBigDecimal());
}