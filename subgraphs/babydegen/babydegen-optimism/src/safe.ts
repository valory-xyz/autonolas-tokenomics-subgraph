import { BigInt, BigDecimal, log, ethereum, Address } from "@graphprotocol/graph-ts"
import {
  Safe,
  SafeReceived as SafeReceivedEvent,
  ExecutionSuccess as ExecutionSuccessEvent,
  ExecutionFromModuleSuccess as ExecutionFromModuleSuccessEvent
} from "../../../../generated/templates/Safe/Safe"
import { isFundingSource, getEthUsd } from "./common"
import { getServiceByAgent } from "./config"
import { updateFundingBalance } from "./tokenBalances"
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
  
  log.info("ETH_RECEIVED: {} ETH received by {} from {} in tx {}", [
    value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
    to.toHexString(),
    from.toHexString(),
    txHash
  ])
  
  // Check if the receiving safe is a service safe
  let toService = getServiceByAgent(to)
  
  if (toService !== null) {
    // This is an inflow TO a service safe
    // Check if sender is valid funding source for this service
    let isValidFundingSource = isFundingSource(from, to, event.block, txHash)
    
    log.info("ETH_FUNDING_CHECK: Checking if {} is valid funding source for {} (result: {})", [
      from.toHexString(),
      to.toHexString(),
      isValidFundingSource ? "YES" : "NO"
    ])
    
    if (isValidFundingSource) {
      // Convert ETH to USD
      let ethPrice = getEthUsd(event.block)
      let usd = value.toBigDecimal()
        .times(ethPrice)
        .div(BigDecimal.fromString("1e18")) // ETH has 18 decimals
      
      log.info("ETH_FUNDING_IN: {} ETH ({} USD at price {}) to service {}", [
        value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
        usd.toString(),
        ethPrice.toString(),
        to.toHexString()
      ])
      
      // Update funding balance
      updateFundingBalance(to, usd, true, event.block.timestamp)
      
      // Also update ETH balance in TokenBalance
      updateETHBalance(to, value, true, event.block)
    } else {
      log.info("ETH_NON_FUNDING_IN: {} ETH received by service {} from non-funding source {}", [
        value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
        to.toHexString(),
        from.toHexString()
      ])
      
      // Still update ETH balance even if not from a funding source
      updateETHBalance(to, value, true, event.block)
    }
  } else {
    // Receiver is NOT a service safe
    // Check if the sender is a service safe (this would be an ETH outflow from service safe to external address)
    let fromService = getServiceByAgent(from)
    
    if (fromService !== null) {
      // This is an ETH outflow from service safe to external address
      
      // Convert ETH to USD
      let ethPrice = getEthUsd(event.block)
      let usd = value.toBigDecimal()
        .times(ethPrice)
        .div(BigDecimal.fromString("1e18")) // ETH has 18 decimals
      
      // Check if receiver is valid funding target for this service (for funding balance tracking)
      let isValidFundingTarget = isFundingSource(to, from, event.block, txHash)
      
      log.info("ETH_FUNDING_CHECK: Checking if {} is valid funding target for {} (result: {})", [
        to.toHexString(),
        from.toHexString(),
        isValidFundingTarget ? "YES" : "NO"
      ])
      
      if (isValidFundingTarget) {
        log.info("ETH_FUNDING_OUT: {} ETH ({} USD at price {}) from service {} to {}", [
          value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
          usd.toString(),
          ethPrice.toString(),
          from.toHexString(),
          to.toHexString()
        ])
        
        // Update the funding balance for the SERVICE safe (outflow)
        updateFundingBalance(from, usd, false, event.block.timestamp)
      } else {
        log.info("ETH_NON_FUNDING_OUT: {} ETH ({} USD) from service {} to non-funding target {}", [
          value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
          usd.toString(),
          from.toHexString(),
          to.toHexString()
        ])
      }
      
      // Always update ETH balance for the service safe (outflow)
      updateETHBalance(from, value, false, event.block)
    }
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
    log.info("ETH_EXECUTION_SKIP: {} is not a service safe (event: {})", [
      serviceSafe.toHexString(),
      eventType
    ])
    return // Not a service safe
  }
  
  log.info("ETH_EXECUTION: {} event from service {} with tx {}", [
    eventType,
    serviceSafe.toHexString(),
    txHash
  ])
  
  // For ETH transfers, we need the transaction information
  let to = tx.to
  let value = tx.value
  
  // Check if this is a direct ETH transfer (value > 0 and to is valid)
  if (value.gt(BigInt.zero()) && to !== null) {
    log.info("ETH_EXECUTION_TRANSFER: {} ETH sent from {} to {} in tx {}", [
      value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
      serviceSafe.toHexString(),
      to ? to.toHexString() : "null",
      txHash
    ])
    
    // Always update ETH balance for outflows from service safe
    updateETHBalance(serviceSafe, value, false, block)
    
    // Check if receiver is valid funding source for this service
    let isValidFundingTarget = isFundingSource(to, serviceSafe, block, txHash)
    
    log.info("ETH_FUNDING_CHECK: Checking if {} is valid funding target for {} (result: {})", [
      to ? to.toHexString() : "null",
      serviceSafe.toHexString(),
      isValidFundingTarget ? "YES" : "NO"
    ])
    
    if (isValidFundingTarget) {
      // Convert ETH to USD for funding balance
      let ethPrice = getEthUsd(block)
      let usd = value.toBigDecimal()
        .times(ethPrice)
        .div(BigDecimal.fromString("1e18")) // ETH has 18 decimals
      
      log.info("ETH_EXECUTION_FUNDING_OUT: {} ETH ({} USD at price {}) from service {} to {}", [
        value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
        usd.toString(),
        ethPrice.toString(),
        serviceSafe.toHexString(),
        to ? to.toHexString() : "null"
      ])
      
      // Update funding balance for ETH outflow
      updateFundingBalance(serviceSafe, usd, false, block.timestamp)
    } else {
      log.info("ETH_EXECUTION_NON_FUNDING: {} ETH from service {} to non-funding target {}", [
        value.toBigDecimal().div(BigDecimal.fromString("1e18")).toString(),
        serviceSafe.toHexString(),
        to ? to.toHexString() : "null"
      ])
    }
  }
    
  // For complex transactions (like swaps), ETH might leave through internal calls
  // These are tracked via SafeReceived events on the receiving contracts
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
    event.transaction.hash.toHexString(), // Use actual transaction hash
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
