import { BigDecimal, Address, Bytes, log, ethereum, BigInt } from "@graphprotocol/graph-ts"
import { TokenBalance, Service, FundingBalance } from "../../../../generated/schema"
import { Transfer as TransferEvent } from "../../../../generated/USDC_Native/ERC20"
import { TOKENS } from "./tokenConfig"
import { getServiceByAgent } from "./config"
import { isFundingSource } from "./common"
import { getTokenPriceUSD } from "./priceDiscovery"
import { WETH, WHITELISTED_TOKENS, USDC_NATIVE, USDC_BRIDGED } from "./constants"

// NOTE: This subgraph is configured to track USDC Native and ETH transfers for funding balance calculations.
// While all token transfers are tracked for token balance purposes, only USDC Native and ETH flows affect
// the funding metrics. Other token outflows are logged but do not affect funding calculations.

// Calculate the total USD value of uninvested funds (tokens held in the safe)
export function calculateUninvestedValue(serviceSafe: Address): BigDecimal {
  let totalUSD = BigDecimal.zero()
  
  // Check ETH balance
  let ethAddress = Address.zero()
  let ethBalanceId = serviceSafe.toHexString() + "-" + ethAddress.toHexString()
  let ethBalance = TokenBalance.load(Bytes.fromUTF8(ethBalanceId))
  
  if (ethBalance != null && ethBalance.balance.gt(BigDecimal.zero())) {
    totalUSD = totalUSD.plus(ethBalance.balanceUSD)
  }
  
  // Check whitelisted token balances from tokenConfig
  // Use the WHITELISTED_TOKENS array from constants instead of iterating over Map
  let tokenKeysArray = WHITELISTED_TOKENS
  
  for (let i = 0; i < tokenKeysArray.length; i++) {
    let tokenAddressString = tokenKeysArray[i]
    // FIX: Convert string to Address and back to ensure proper formatting
    let tokenAddress = Address.fromString(tokenAddressString)
    let balanceId = serviceSafe.toHexString() + "-" + tokenAddress.toHexString()
    let balance = TokenBalance.load(Bytes.fromUTF8(balanceId))
    
    if (balance != null && balance.balance.gt(BigDecimal.zero())) {
      totalUSD = totalUSD.plus(balance.balanceUSD)
    }
  }
  
  
  return totalUSD
}

// Update ETH balance for a service safe
export function updateETHBalance(
  serviceSafe: Address,
  amount: BigInt,
  isIncrease: boolean,
  block: ethereum.Block
): void {
  
  let service = getServiceByAgent(serviceSafe)
  if (service == null) {
    log.warning("updateETHBalance: Service not found for safe {}", [serviceSafe.toHexString()])
    return
  }
  
  let ethAddress = Address.zero()
  let balanceId = serviceSafe.toHexString() + "-" + ethAddress.toHexString()
  let balance = TokenBalance.load(Bytes.fromUTF8(balanceId))
  
  if (balance == null) {
    balance = new TokenBalance(Bytes.fromUTF8(balanceId))
    balance.service = serviceSafe
    balance.token = ethAddress
    balance.symbol = "ETH"
    balance.decimals = 18
    balance.balance = BigDecimal.zero()
    balance.balanceUSD = BigDecimal.zero()
  }
  
  // Update balance
  let amountDecimal = amount.toBigDecimal().div(BigDecimal.fromString("1e18"))
  
  if (isIncrease) {
    balance.balance = balance.balance.plus(amountDecimal)
  } else {
    balance.balance = balance.balance.minus(amountDecimal)
    
    if (balance.balance.lt(BigDecimal.zero())) {
      balance.balance = BigDecimal.zero()
    }
  }
  
  // Update USD value using price discovery
  let ethPrice = getTokenPriceUSD(WETH, block.timestamp, false)
  balance.balanceUSD = balance.balance.times(ethPrice)
  
  balance.lastUpdated = block.timestamp
  balance.lastBlock = block.number
  balance.save()
}

// Update token balance for a service safe
export function updateTokenBalance(
  serviceSafe: Address,
  tokenAddress: Address,
  amount: BigInt,
  isIncrease: boolean,
  block: ethereum.Block
): void {
  let service = getServiceByAgent(serviceSafe)
  if (service == null) {
    log.warning("updateTokenBalance: Service not found for safe {}", [serviceSafe.toHexString()])
    return
  }
  
  // Check if token is whitelisted
  let tokenConfig = TOKENS.get(tokenAddress.toHexString().toLowerCase())
  if (tokenConfig == null) {
    log.warning("updateTokenBalance: Token {} not whitelisted", [tokenAddress.toHexString()])
    return
  }
  
  let balanceId = serviceSafe.toHexString() + "-" + tokenAddress.toHexString()
  let balance = TokenBalance.load(Bytes.fromUTF8(balanceId))
  
  if (balance == null) {
    balance = new TokenBalance(Bytes.fromUTF8(balanceId))
    balance.service = serviceSafe
    balance.token = tokenAddress
    balance.symbol = tokenConfig.symbol
    balance.decimals = tokenConfig.decimals
    balance.balance = BigDecimal.zero()
    balance.balanceUSD = BigDecimal.zero()
  }
  
  // Update balance
  let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
  let amountDecimal = amount.toBigDecimal().div(divisor)
  
  if (isIncrease) {
    balance.balance = balance.balance.plus(amountDecimal)
  } else {
    balance.balance = balance.balance.minus(amountDecimal)
    if (balance.balance.lt(BigDecimal.zero())) {
      balance.balance = BigDecimal.zero()
    }
  }
  
  // Update USD value using price discovery
  let tokenPrice = getTokenPriceUSD(tokenAddress, block.timestamp, false)
  balance.balanceUSD = balance.balance.times(tokenPrice)
  
  balance.lastUpdated = block.timestamp
  balance.lastBlock = block.number
  balance.save()
  
  log.info("updateTokenBalance: Updated {} balance for safe {} to {} ({} USD)", [
    tokenConfig.symbol,
    serviceSafe.toHexString(),
    balance.balance.toString(),
    balance.balanceUSD.toString()
  ])
}

// Handle ERC20 transfer events
export function handleERC20Transfer(event: TransferEvent): void {
  let from = event.params.from
  let to = event.params.to
  let value = event.params.value
  let tokenAddress = event.address
  let txHash = event.transaction.hash.toHexString()
  
  // Check if this is a whitelisted token
  let tokenConfig = TOKENS.get(tokenAddress.toHexString().toLowerCase())
  if (tokenConfig == null) {
    return // Not a whitelisted token
  }
  
  // Log base transfer information
  let isNativeUSDC = tokenAddress.equals(USDC_NATIVE)
  let isBridgedUSDC = tokenAddress.equals(USDC_BRIDGED)
  
  // Format token amount with correct decimals
  let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
  let formattedAmount = value.toBigDecimal().div(divisor)
  
  log.info("TOKEN_TRANSFER: {} {} from {} to {} in tx {}", [
    formattedAmount.toString(),
    tokenConfig.symbol,
    from.toHexString(),
    to.toHexString(),
    txHash
  ])
  
  if (isNativeUSDC) {
    log.info("USDC_NATIVE_TRANSFER: {} USDC from {} to {} in tx {}", [
      formattedAmount.toString(),
      from.toHexString(),
      to.toHexString(),
      txHash
    ])
  } else if (isBridgedUSDC) {
    log.info("USDC_BRIDGED_TRANSFER: {} USDC.e from {} to {} in tx {}", [
      formattedAmount.toString(),
      from.toHexString(),
      to.toHexString(),
      txHash
    ])
  }
  
  // Handle transfers TO service safes (deposits)
  let toService = getServiceByAgent(to)
  if (toService != null) {
    updateTokenBalance(to, tokenAddress, value, true, event.block)
    
    // Check if sender is a valid funding source
    let isValidSource = isFundingSource(from, to, event.block, event.transaction.hash.toHexString())
    
    log.info("USDC_FUNDING_CHECK: Checking if {} is valid funding source for {} (result: {})", [
      from.toHexString(),
      to.toHexString(),
      isValidSource ? "YES" : "NO"
    ])
    
    // Check if it's a funding deposit AND is NATIVE USDC (explicitly excluding bridged USDC)
    if (isValidSource && tokenAddress.equals(USDC_NATIVE)) {
      // Calculate USD value using price discovery
      let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
      let amountDecimal = value.toBigDecimal().div(divisor)
      let tokenPrice = getTokenPriceUSD(tokenAddress, event.block.timestamp, false)
      let usdValue = amountDecimal.times(tokenPrice)
      
      log.info("USDC_FUNDING_IN: {} USDC ({} USD at price {}) to service {} from {}", [
        amountDecimal.toString(),
        usdValue.toString(),
        tokenPrice.toString(),
        to.toHexString(),
        from.toHexString()
      ])
      
      log.info("FUNDING: IN {} USD ({}) to {} from {}", [
        usdValue.toString(),
        tokenConfig.symbol,
        to.toHexString(),
        from.toHexString()
      ])
      
      // Update funding balance directly to avoid circular dependency
      updateFundingBalance(to, usdValue, true, event.block.timestamp)
    } else if (isValidSource) {
      // Calculate values for better logging
      let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
      let amountDecimal = value.toBigDecimal().div(divisor)
      let tokenPrice = getTokenPriceUSD(tokenAddress, event.block.timestamp, false)
      let usdValue = amountDecimal.times(tokenPrice)
      
      // Log non-USDC token transfers that would have been funding but are excluded
      if (tokenAddress.equals(USDC_BRIDGED)) {
        log.info("USDC_BRIDGED_EXCLUDED: {} USDC.e ({} USD) from {} to {} NOT counted as funding", [
          amountDecimal.toString(),
          usdValue.toString(),
          from.toHexString(),
          to.toHexString()
        ])
      } else {
        log.info("TOKEN_NON_FUNDING_IN: {} {} ({} USD) from {} to {} NOT counted as funding", [
          amountDecimal.toString(),
          tokenConfig.symbol,
          usdValue.toString(),
          from.toHexString(),
          to.toHexString()
        ])
      }
      
      log.info("TOKEN IN (not counted in funding): {} {} from {} to {}", [
        tokenConfig.symbol,
        value.toString(),
        from.toHexString(),
        to.toHexString()
      ])
    }
  }
  
  // Handle transfers FROM service safes (withdrawals)
  let fromService = getServiceByAgent(from)
  if (fromService != null) {
    updateTokenBalance(from, tokenAddress, value, false, event.block)
    
    // For outflows, only update funding if it's NATIVE USDC (explicitly excluding bridged USDC)
    if (tokenAddress.equals(USDC_NATIVE)) {
      // Check if receiver is valid funding source for this service
      let isValidTarget = isFundingSource(to, from, event.block, event.transaction.hash.toHexString())
      
      log.info("USDC_FUNDING_CHECK: Checking if {} is valid funding target for {} (result: {})", [
        to.toHexString(),
        from.toHexString(),
        isValidTarget ? "YES" : "NO"
      ])
      
      if (isValidTarget) {
        // Calculate USD value 
        let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
        let amountDecimal = value.toBigDecimal().div(divisor)
        let tokenPrice = getTokenPriceUSD(tokenAddress, event.block.timestamp, false)
        let usdValue = amountDecimal.times(tokenPrice)
        
        log.info("USDC_FUNDING_OUT: {} USDC ({} USD at price {}) from service {} to {}", [
          amountDecimal.toString(),
          usdValue.toString(),
          tokenPrice.toString(),
          from.toHexString(),
          to.toHexString()
        ])
        
        log.info("FUNDING: OUT {} USD ({}) from {} to {}", [
          usdValue.toString(),
          tokenConfig.symbol,
          from.toHexString(),
          to.toHexString()
        ])
        
        // Update funding balance
        updateFundingBalance(from, usdValue, false, event.block.timestamp)
      }
    } else {
      // Calculate USD value for non-USDC tokens for logging purposes only
      let divisor = BigDecimal.fromString("1" + "0".repeat(tokenConfig.decimals))
      let amountDecimal = value.toBigDecimal().div(divisor)
      let tokenPrice = getTokenPriceUSD(tokenAddress, event.block.timestamp, false)
      let usdValue = amountDecimal.times(tokenPrice)
      
      if (tokenAddress.equals(USDC_BRIDGED)) {
        log.info("USDC_BRIDGED_OUT: {} USDC.e ({} USD) from service {} to {} NOT counted as funding", [
          amountDecimal.toString(),
          usdValue.toString(),
          from.toHexString(),
          to.toHexString()
        ])
      } else {
        log.info("TOKEN_NON_FUNDING_OUT: {} {} ({} USD) from service {} to {}", [
          amountDecimal.toString(),
          tokenConfig.symbol,
          usdValue.toString(),
          from.toHexString(),
          to.toHexString()
        ])
      }
      
      log.info("TOKEN OUT (not counted in funding): {} USD ({}) from {} to {}", [
        usdValue.toString(),
        tokenConfig.symbol,
        from.toHexString(),
        to.toHexString()
      ])
    }
  }
}

// Helper function to update funding balance without circular dependency
// Exported to be the single source of truth for funding balance updates
export function updateFundingBalance(
  serviceSafe: Address,
  usd: BigDecimal,
  deposit: boolean,
  ts: BigInt
): void {
  let id = serviceSafe as Bytes
  let fb = FundingBalance.load(id)
  
  if (!fb) {
    fb = new FundingBalance(id)
    fb.service = serviceSafe
    fb.totalInUsd = BigDecimal.zero()
    fb.totalOutUsd = BigDecimal.zero()
    fb.netUsd = BigDecimal.zero()
    fb.firstInTimestamp = ts
    
    log.info("FUNDING_INIT: Created new funding balance tracking for service safe {}", [
      serviceSafe.toHexString()
    ])
  }
  
  let oldTotalIn = fb.totalInUsd
  let oldTotalOut = fb.totalOutUsd
  
  if (deposit) {
    fb.totalInUsd = fb.totalInUsd.plus(usd)
    log.info("FUNDING_DETAIL: Adding {} USD to totalIn for service {}", [
      usd.toString(),
      serviceSafe.toHexString()
    ])
  } else {
    fb.totalOutUsd = fb.totalOutUsd.plus(usd)
    log.info("FUNDING_DETAIL: Adding {} USD to totalOut for service {}", [
      usd.toString(),
      serviceSafe.toHexString()
    ])
  }
  
  fb.netUsd = fb.totalInUsd.minus(fb.totalOutUsd)
  fb.lastChangeTs = ts
  fb.save()
  
  log.info("FUNDING_SUMMARY: Updated funding balance for {} - totalIn: {} → {} USD, totalOut: {} → {} USD, net: {} USD", [
    serviceSafe.toHexString(),
    oldTotalIn.toString(),
    fb.totalInUsd.toString(),
    oldTotalOut.toString(), 
    fb.totalOutUsd.toString(),
    fb.netUsd.toString()
  ])
}
