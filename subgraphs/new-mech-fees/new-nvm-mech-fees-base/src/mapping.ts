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
  ETH_DECIMALS
} from "../../../../shared/constants"
import {
  updateTotalFeesIn,
  updateTotalFeesOut,
  convertBaseUsdcToUsd,
  updateMechFeesIn,
  updateMechFeesOut,
  createMechTransactionForAccrued,
  createMechTransactionForCollected
} from "../../../../shared/new-mech-fees/utils";

const BURN_ADDRESS = Address.fromString(BURN_ADDRESS_MECH_FEES_BASE);

export function handleMechBalanceAdjustedForNvm(event: MechBalanceAdjusted): void {
  const deliveryRateCredits = event.params.deliveryRate;
  const mechId = event.params.mech.toHex();

  // Convert delivery rate (credits) to USDC minor units using the formula:
  // usdc_amount = (deliveryRate * TOKEN_RATIO_BASE) / 1e18
  const ethDivisor = BigInt.fromI32(10).pow(ETH_DECIMALS).toBigDecimal();
  const deliveryRateUsdc = deliveryRateCredits.toBigDecimal()
    .times(TOKEN_RATIO_BASE)
    .div(ethDivisor);

  // Convert to BigInt for storage as raw amount
  const deliveryRateUsdcRaw = BigInt.fromString(deliveryRateUsdc.toString().split('.')[0]);

  // Convert raw USDC to USD value (assuming 1:1)
  const deliveryRateUsd = convertBaseUsdcToUsd(deliveryRateUsdcRaw);

  // Update global and mech-specific totals
  updateTotalFeesIn(deliveryRateUsd);
  updateMechFeesIn(mechId, deliveryRateUsd, deliveryRateUsdcRaw.toBigDecimal());

  // Create the transaction record
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForAccrued(
      mech,
      deliveryRateUsdcRaw.toBigDecimal(),
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

  updateTotalFeesOut(withdrawalAmountUsd);
  updateMechFeesOut(mechId, withdrawalAmountUsd, withdrawalAmountUsdc.toBigDecimal());

  // Create MechTransaction for the collected fees
  const mech = Mech.load(mechId);
  if (mech != null) {
    createMechTransactionForCollected(
      mech,
      withdrawalAmountUsdc.toBigDecimal(),
      withdrawalAmountUsd,
      event
    );
  }
} 