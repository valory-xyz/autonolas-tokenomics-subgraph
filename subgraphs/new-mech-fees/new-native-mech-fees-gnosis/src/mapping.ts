// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../common/generated/BalanceTrackerFixedPriceNative/BalanceTrackerFixedPriceNative"
import { Mech } from "../../common/generated/schema"
import { getBurnAddressMechFees } from "../../../../shared/constants"
import { 
  updateTotalFeesIn, 
  updateTotalFeesOut, 
  convertGnosisNativeWeiToUsd,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected,
  updateMechModelIn,
  updateMechModelOut,
  updateDailyTotalsIn,
  updateDailyTotalsOut,
  updateMechDailyIn,
  updateMechDailyOut
} from "../../common/utils"

const BURN_ADDRESS = getBurnAddressMechFees();
const MODEL = "native";

export function handleMechBalanceAdjustedForNative(event: MechBalanceAdjusted): void {
  const earningsAmountWei = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  const earningsAmountUsd = convertGnosisNativeWeiToUsd(earningsAmountWei);

  updateTotalFeesIn(earningsAmountUsd);
  updateMechFeesIn(mechId, earningsAmountUsd, earningsAmountWei.toBigDecimal());
  updateMechModelIn(mechId, MODEL, earningsAmountUsd, earningsAmountWei.toBigDecimal());
  updateDailyTotalsIn(earningsAmountUsd, event.block.timestamp);
  updateMechDailyIn(mechId, earningsAmountUsd, earningsAmountWei.toBigDecimal(), event.block.timestamp);

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
      event.params.rateDiff,
      MODEL
    );
  }
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
  updateMechModelOut(mechId, MODEL, withdrawalAmountUsd, withdrawalAmountWei.toBigDecimal());
  updateDailyTotalsOut(withdrawalAmountUsd, event.block.timestamp);
  updateMechDailyOut(mechId, withdrawalAmountUsd, withdrawalAmountWei.toBigDecimal(), event.block.timestamp);

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalAmountWei.toBigDecimal(),
      withdrawalAmountUsd,
      event,
      MODEL
    );
  }
}