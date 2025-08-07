// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/BalanceTrackerNvmSubscriptionNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { BURN_ADDRESS_MECH_FEES_GNOSIS } from "../../../../shared/constants"
import { 
  updateTotalFeesIn, 
  updateTotalFeesOut, 
  calculateGnosisNvmFeesIn, 
  convertGnosisNativeWeiToUsd,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected
} from "../../../../shared/new-mech-fees/utils"

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_GNOSIS);

export function handleMechBalanceAdjustedForNvm(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = calculateGnosisNvmFeesIn(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);
  updateMechFeesIn(mechId, earningsAmountUsd, earningsAmountWei.toBigDecimal());

  // Create MechTransaction for the accrued fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      earningsAmountWei.toBigDecimal(),
      earningsAmountUsd,
      event,
      event.params.deliveryRate,
      event.params.balance,
      event.params.rateDiff
    );
  }
}

export function handleWithdrawForNvm(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountWei = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertGnosisNativeWeiToUsd(withdrawalAmountWei);

  updateTotalFeesOut(withdrawalAmountUsd);
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalAmountWei.toBigDecimal());

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalAmountWei.toBigDecimal(),
      withdrawalAmountUsd,
      event
    );
  }
} 