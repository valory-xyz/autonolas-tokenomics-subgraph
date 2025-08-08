// src/mapping.ts

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionNative/BalanceTrackerNvmSubscriptionNative"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { 
  BURN_ADDRESS_MECH_FEES_GNOSIS,
  TOKEN_RATIO_GNOSIS,
  TOKEN_DECIMALS_GNOSIS,
  ETH_DECIMALS
} from "../../../../shared/constants"
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
  const deliveryRateCredits = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  // Convert credits to USD using the existing function
  const earningsAmountUsd = calculateGnosisNvmFeesIn(deliveryRateCredits);

  updateTotalFeesIn(earningsAmountUsd);
  // Store credits as raw value (not converted to xDAI wei)
  updateMechFeesIn(mechId, earningsAmountUsd, deliveryRateCredits.toBigDecimal());

  // Create MechTransaction for the accrued fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateCredits.toBigDecimal(), // Store credits as raw amount
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

  // Convert xDAI wei back to credits for raw storage
  // Formula: credits = (xdai_wei * 1e18 * 1e18) / (TOKEN_RATIO_GNOSIS)
  const ethDivisor = BigInt.fromI32(10).pow(ETH_DECIMALS as u8).toBigDecimal();
  const tokenDivisor = BigInt.fromI32(10).pow(TOKEN_DECIMALS_GNOSIS as u8).toBigDecimal();
  
  const withdrawalCredits = withdrawalAmountWei.toBigDecimal()
    .times(ethDivisor)
    .times(tokenDivisor)
    .div(TOKEN_RATIO_GNOSIS);

  updateTotalFeesOut(withdrawalAmountUsd);
  // Store credits as raw value (converted from xDAI wei)
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalCredits);

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalCredits, // Store credits as raw amount
      withdrawalAmountUsd,
      event
    );
  }
} 