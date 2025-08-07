// src/mapping.ts

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  MechBalanceAdjusted,
  Withdraw
} from "../../../../shared/new-mech-fees/generated/BalanceTrackerNvmSubscriptionToken/BalanceTrackerNvmSubscriptionToken"
import { Mech } from "../../../../shared/new-mech-fees/generated/schema"
import { 
  BURN_ADDRESS_MECH_FEES_BASE,
  TOKEN_RATIO_BASE,
  TOKEN_DECIMALS_BASE,
  ETH_DECIMALS
} from "../../../../shared/constants"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  convertBaseUsdcToUsd,
  calculateBaseNvmFeesIn,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected
} from "../../../../shared/new-mech-fees/utils";

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);

export function handleMechBalanceAdjustedForNvm(event: MechBalanceAdjusted): void {
  const deliveryRateCredits = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  // Convert credits to USD using the correct formula from utils
  const deliveryRateUsd = calculateBaseNvmFeesIn(deliveryRateCredits);

  // Update global and mech-specific totals
  updateTotalFeesIn(deliveryRateUsd);
  // Store credits as raw value (not converted to USDC)
  updateMechFeesIn(mechId, deliveryRateUsd, deliveryRateCredits.toBigDecimal());

  // Create the transaction record
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateCredits.toBigDecimal(), // Store credits as raw amount
      deliveryRateUsd,
      event,
      event.params.deliveryRate,
      event.params.balance,
      event.params.rateDiff
    );
  }
}

export function handleWithdrawForNvm(event: Withdraw): void {
  const recipientAddress = event.params.account;
  const withdrawalAmountUsdc = event.params.amount;
  const mechId = recipientAddress.toHex();

  if (recipientAddress.equals(BURN_ADDRESS)) {
    return;
  }

  const withdrawalAmountUsd = convertBaseUsdcToUsd(withdrawalAmountUsdc);

  // Convert USDC back to credits for raw storage
  // Formula: credits = (usdc_amount × 1e18 × 1e6) ÷ TOKEN_RATIO_BASE
  const ethDivisor = BigInt.fromI32(10).pow(ETH_DECIMALS as u8).toBigDecimal();
  const tokenDivisor = BigInt.fromI32(10).pow(TOKEN_DECIMALS_BASE as u8).toBigDecimal();
  const withdrawalCredits = withdrawalAmountUsdc.toBigDecimal()
    .times(ethDivisor)
    .times(tokenDivisor)
    .div(TOKEN_RATIO_BASE);

  updateTotalFeesOut(withdrawalAmountUsd);
  // Store credits as raw value (converted from USDC)
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