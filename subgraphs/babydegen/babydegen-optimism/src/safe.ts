import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts"
import {
  Safe,
  SafeReceived as SafeReceivedEvent,
  ExecutionSuccess as ExecutionSuccessEvent,
  ExecutionFromModuleSuccess as ExecutionFromModuleSuccessEvent
} from "../../../../generated/templates/Safe/Safe"
import { isFundingSource, getEthUsd } from "./common"
import { getServiceByAgent } from "./config"
import { updateFunding } from "./helpers"
import { updateETHBalance } from "./tokenBalances"

// NOTE: This subgraph is configured to ONLY track USDC and ETH transfers for funding balance calculations.
// ETH transfers out (through ExecutionSuccess events) are now tracked for funding metrics.
// ETH transfers in are tracked via SafeReceived events.

export function handleSafeReceived(event: SafeReceivedEvent): void {
  // Handle funding balance update for ETH received
  let from = event.params.sender
  let to = event.address // The safe that received ETH (emitted the event)
  let value = event.params.value
  let txHash = event.transaction.hash.toHexString()
  
  // Debug log
  log.debug("FUNDING: ETH SafeReceived - from: {}, to: {}, value: {}, block: {}", [
    from.toHexString(),
    to.toHexString(),
    value.toString(),
    event.block.number.toString()
  ])
  
  // Check if the receiving safe is a service safe
  let toService = getServiceByAgent(to)
  
  if (toService !== null) {
    // Check if sender is valid funding source for this service
    if (isFundingSource(from, to, event.block, txHash)) {
      // Convert ETH to USD
      let ethPrice = getEthUsd(event.block)
      let usd = value.toBigDecimal()
        .times(ethPrice)
        .div(BigDecimal.fromString("1e18")) // ETH has 18 decimals
      
      log.info("FUNDING: IN {} USD (ETH) to {} from {}", [
        usd.toString(),
        to.toHexString(),
        from.toHexString()
      ])
      
      updateFunding(to, usd, true, event.block.timestamp)
      
      // Also update ETH balance in TokenBalance
      updateETHBalance(to, value, true, event.block)
    } else {
      log.info("FUNDING: ETH received but sender {} is not a valid funding source for safe {}", [
        from.toHexString(),
        to.toHexString()
      ])
    }
  } else {
    log.warning("FUNDING: ETH SafeReceived for non-service safe: {}", [
      to.toHexString()
    ])
  }
}

export function handleExecutionSuccess(event: ExecutionSuccessEvent): void {
  // Get the safe that executed the transaction
  let serviceSafe = event.address
  let service = getServiceByAgent(serviceSafe)
  
  if (service === null) {
    log.debug("ExecutionSuccess for non-service safe: {}", [serviceSafe.toHexString()])
    return // Not a service safe
  }
  
  // Get transaction details
  let txHash = event.params.txHash.toHexString()
  let payment = event.params.payment
  
  // For ETH transfers, we need the transaction information
  let tx = event.transaction
  let to = tx.to
  let value = tx.value
  
  // Check if this is a direct ETH transfer (value > 0 and to is valid)
  if (value.gt(BigInt.zero()) && to !== null) {
    // Only proceed if 'to' is not the service safe itself
    if (!to.equals(serviceSafe)) {
      // Check if recipient is an operator or EOA
      if (isFundingSource(to, serviceSafe, event.block, txHash)) {
        log.info("ETH Transfer detected from service safe to operator/EOA: {} -> {}, value: {}", [
          serviceSafe.toHexString(),
          to.toHexString(),
          value.toString()
        ])
        
        // 1. Update ETH balance
        updateETHBalance(serviceSafe, value, false, event.block)
        
        // 2. Convert to USD for funding metrics
        let ethPrice = getEthUsd(event.block)
        let usdValue = value.toBigDecimal()
          .times(ethPrice)
          .div(BigDecimal.fromString("1e18"))
        
        // 3. Update funding balance (deposit=false for outflow)
        updateFunding(serviceSafe, usdValue, false, event.block.timestamp)
        
        log.info("FUNDING: OUT {} USD (ETH) from {} to {}", [
          usdValue.toString(),
          serviceSafe.toHexString(),
          to.toHexString()
        ])
      } else {
        log.info("ETH transfer not to operator/EOA - not counting in funding: {} -> {}", [
          serviceSafe.toHexString(),
          to.toHexString()
        ])
      }
    }
  }
  
  // This could be a contract interaction or internal transaction
  log.debug("Safe ExecutionSuccess: txHash: {}, payment: {}", [
    txHash,
    payment.toString()
  ])
}

export function handleExecutionFromModuleSuccess(event: ExecutionFromModuleSuccessEvent): void {
  // Get the safe that executed the transaction
  let serviceSafe = event.address
  let service = getServiceByAgent(serviceSafe)
  
  if (service === null) {
    log.debug("ExecutionFromModuleSuccess for non-service safe: {}", [serviceSafe.toHexString()])
    return // Not a service safe
  }
  
  // Get the module address that executed the transaction
  let moduleAddress = event.params.module
  
  // Get transaction details from the event transaction
  let txHash = event.transaction.hash.toHexString()
  
  // For ETH transfers, we need the transaction information
  let tx = event.transaction
  let to = tx.to
  let value = tx.value
  
  // Log the module execution
  log.debug("ExecutionFromModuleSuccess: module: {}, safe: {}, txHash: {}", [
    moduleAddress.toHexString(),
    serviceSafe.toHexString(),
    txHash
  ])
  
  // Check if this is a direct ETH transfer (value > 0 and to is valid)
  if (value.gt(BigInt.zero()) && to !== null) {
    // Only proceed if 'to' is not the service safe itself
    if (!to.equals(serviceSafe)) {
      // Check if recipient is an operator or EOA
      if (isFundingSource(to, serviceSafe, event.block, txHash)) {
        log.info("ETH Transfer detected from module to operator/EOA: {} -> {}, value: {}, module: {}", [
          serviceSafe.toHexString(),
          to.toHexString(),
          value.toString(),
          moduleAddress.toHexString()
        ])
        
        // 1. Update ETH balance
        updateETHBalance(serviceSafe, value, false, event.block)
        
        // 2. Convert to USD for funding metrics
        let ethPrice = getEthUsd(event.block)
        let usdValue = value.toBigDecimal()
          .times(ethPrice)
          .div(BigDecimal.fromString("1e18"))
        
        // 3. Update funding balance (deposit=false for outflow)
        updateFunding(serviceSafe, usdValue, false, event.block.timestamp)
        
        log.info("FUNDING: OUT {} USD (ETH) from {} to {} via module {}", [
          usdValue.toString(),
          serviceSafe.toHexString(),
          to.toHexString(),
          moduleAddress.toHexString()
        ])
      } else {
        log.info("ETH transfer not to operator/EOA - not counting in funding: {} -> {}, module: {}", [
          serviceSafe.toHexString(),
          to.toHexString(),
          moduleAddress.toHexString()
        ])
      }
    }
  }
}
