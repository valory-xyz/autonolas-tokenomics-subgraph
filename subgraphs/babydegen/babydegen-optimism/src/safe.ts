import { BigInt, BigDecimal, log, ethereum, Address } from "@graphprotocol/graph-ts"
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
// ETH transfers out (through ExecutionSuccess and ExecutionFromModuleSuccess events) are now tracked for funding metrics.
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

/**
 * Helper function to handle ETH transfers for both ExecutionSuccess and ExecutionFromModuleSuccess events
 * @param serviceSafe The safe address that executed the transaction
 * @param eventType String identifying the type of event ('execution' or 'module')
 * @param block The block where the transaction occurred
 * @param tx The transaction object
 * @param txHash The transaction hash as a string
 * @param moduleAddress Optional module address for module executions
 * @param extraInfo Optional additional information to log (e.g. payment)
 */
function handleSafeEthTransfer(
  serviceSafe: Address,
  eventType: string,
  block: ethereum.Block,
  tx: ethereum.Transaction,
  txHash: string,
  moduleAddress: Address | null = null,
  extraInfo: string | null = null
): void {
  let service = getServiceByAgent(serviceSafe)
  
  if (service === null) {
    log.debug("{} for non-service safe: {}", [eventType, serviceSafe.toHexString()])
    return // Not a service safe
  }
  
  // For ETH transfers, we need the transaction information
  let to = tx.to
  let value = tx.value
  
  // Log specific info based on event type
  if (eventType == "ExecutionFromModuleSuccess" && moduleAddress) {
    log.debug("{}: module: {}, safe: {}, txHash: {}", [
      eventType,
      moduleAddress.toHexString(),
      serviceSafe.toHexString(),
      txHash
    ])
  } else if (extraInfo) {
    log.debug("Safe {}: txHash: {}, {}", [
      eventType,
      txHash,
      extraInfo
    ])
  }
  
  // Check if this is a direct ETH transfer (value > 0 and to is valid)
  if (value.gt(BigInt.zero()) && to !== null) {
    // Only proceed if 'to' is not the service safe itself
    if (!to.equals(serviceSafe)) {
      // Check if recipient is an operator or EOA
      if (isFundingSource(to, serviceSafe, block, txHash)) {
        // Construct appropriate log message based on event type
        if (eventType == "ExecutionFromModuleSuccess" && moduleAddress) {
          log.info("ETH Transfer detected from module to operator/EOA: {} -> {}, value: {}, module: {}", [
            serviceSafe.toHexString(),
            to.toHexString(),
            value.toString(),
            moduleAddress.toHexString()
          ])
        } else {
          log.info("ETH Transfer detected from service safe to operator/EOA: {} -> {}, value: {}", [
            serviceSafe.toHexString(),
            to.toHexString(),
            value.toString()
          ])
        }
        
        // 1. Update ETH balance
        updateETHBalance(serviceSafe, value, false, block)
        
        // 2. Convert to USD for funding metrics
        let ethPrice = getEthUsd(block)
        let usdValue = value.toBigDecimal()
          .times(ethPrice)
          .div(BigDecimal.fromString("1e18"))
        
        // 3. Update funding balance (deposit=false for outflow)
        updateFunding(serviceSafe, usdValue, false, block.timestamp)
        
        // Log with appropriate message based on event type
        if (eventType == "ExecutionFromModuleSuccess" && moduleAddress) {
          log.info("FUNDING: OUT {} USD (ETH) from {} to {} via module {}", [
            usdValue.toString(),
            serviceSafe.toHexString(),
            to.toHexString(),
            moduleAddress.toHexString()
          ])
        } else {
          log.info("FUNDING: OUT {} USD (ETH) from {} to {}", [
            usdValue.toString(),
            serviceSafe.toHexString(),
            to.toHexString()
          ])
        }
      } else {
        // Log with appropriate message based on event type
        if (eventType == "ExecutionFromModuleSuccess" && moduleAddress) {
          log.info("ETH transfer not to operator/EOA - not counting in funding: {} -> {}, module: {}", [
            serviceSafe.toHexString(),
            to.toHexString(),
            moduleAddress.toHexString()
          ])
        } else {
          log.info("ETH transfer not to operator/EOA - not counting in funding: {} -> {}", [
            serviceSafe.toHexString(),
            to.toHexString()
          ])
        }
      }
    }
  }
}

export function handleExecutionSuccess(event: ExecutionSuccessEvent): void {
  let serviceSafe = event.address
  let txHash = event.params.txHash.toHexString()
  let payment = event.params.payment
  
  handleSafeEthTransfer(
    serviceSafe,
    "ExecutionSuccess",
    event.block,
    event.transaction,
    txHash,
    null,
    "payment: " + payment.toString()
  )
}

export function handleExecutionFromModuleSuccess(event: ExecutionFromModuleSuccessEvent): void {
  let serviceSafe = event.address
  let moduleAddress = event.params.module
  let txHash = event.transaction.hash.toHexString()
  
  handleSafeEthTransfer(
    serviceSafe,
    "ExecutionFromModuleSuccess",
    event.block,
    event.transaction,
    txHash,
    moduleAddress
  )
}
