import { 
  BigInt, 
  BigDecimal, 
  Address, 
  Bytes,
  ethereum,
  log
} from "@graphprotocol/graph-ts"

import { ProtocolPosition, Service } from "../../../../generated/schema"
import { VelodromeV2Pool } from "../../../../generated/templates/VeloV2Pool/VelodromeV2Pool"
import { VeloV2Pool as VeloV2PoolTemplate } from "../../../../generated/templates"
import { getTokenPriceUSD } from "./priceDiscovery"
import { getServiceByAgent } from "./config"
import { updateFirstTradingTimestamp } from "./helpers"
import { getTokenDecimals, getTokenSymbol } from "./tokenUtils"

// VelodromeV2 Router address on Optimism
const VELODROME_V2_ROUTER = Address.fromString("0xa062ae8a9c5e11aaa026fc2670b0d65ccc8b2858")

// Cache for VelodromeV2 pools to avoid repeated RPC calls
let poolCache = new Map<string, boolean>()

// Helper function to convert token amount to human readable format
function toHumanAmount(amount: BigInt, decimals: i32): BigDecimal {
  if (amount.equals(BigInt.zero())) {
    return BigDecimal.zero()
  }
  
  let divisor = BigInt.fromI32(10).pow(decimals as u8)
  return amount.toBigDecimal().div(divisor.toBigDecimal())
}

// Ensure pool template is created for tracking events
export function ensureVeloV2PoolTemplate(poolAddress: Address): void {
  const poolKey = poolAddress.toHexString()
  
  if (!poolCache.has(poolKey)) {
    log.info("VELO V2: Creating pool template {}", [poolKey])
    VeloV2PoolTemplate.create(poolAddress)
    poolCache.set(poolKey, true)
  }
}

// Create or get VelodromeV2 position ID
export function getVeloV2PositionId(userAddress: Address, poolAddress: Address): Bytes {
  // For VelodromeV2, we use user-pool combination as position ID since there are no NFTs
  const positionId = userAddress.toHex() + "-velodromev2-" + poolAddress.toHex()
  return Bytes.fromUTF8(positionId)
}

// Refresh VelodromeV2 position with event amounts (for Mint events)
export function refreshVeloV2PositionWithEventAmounts(
  userAddress: Address,
  poolAddress: Address, 
  block: ethereum.Block,
  eventAmount0: BigInt,
  eventAmount1: BigInt,
  txHash: Bytes
): void {
  // Comprehensive entry logging
  log.info("VELO_V2[{}]: === ENTERING refreshVeloV2PositionWithEventAmounts ===", [userAddress.toHexString()])
  log.info("VELO_V2[{}]: Pool: {}, Block: {}, TxHash: {}", [
    userAddress.toHexString(),
    poolAddress.toHexString(), 
    block.number.toString(),
    txHash.toHexString()
  ])
  log.info("VELO_V2[{}]: Raw event amounts - amount0: {}, amount1: {}", [
    userAddress.toHexString(),
    eventAmount0.toString(),
    eventAmount1.toString()
  ])
  
  const positionId = getVeloV2PositionId(userAddress, poolAddress)
  log.info("VELO_V2[{}]: Generated position ID: {}", [
    userAddress.toHexString(),
    positionId.toHexString()
  ])
  
  // Service validation logging
  const service = getServiceByAgent(userAddress)
  if (service == null) {
    log.info("VELO_V2[{}]: Service lookup returned null - not a tracked service", [userAddress.toHexString()])
    return
  }
  log.info("VELO_V2[{}]: Service found - ID: {}, Safe: {}", [
    userAddress.toHexString(),
    service.serviceId.toString(),
    service.serviceSafe.toHexString()
  ])
  
  let pp = ProtocolPosition.load(positionId)
  if (!pp) {
    pp = new ProtocolPosition(positionId)
    pp.agent = userAddress
    pp.service = userAddress // Link to service
    pp.protocol = "velodrome-v2"
    pp.pool = poolAddress
    pp.isActive = true
    pp.tokenId = BigInt.zero() // VelodromeV2 doesn't use tokenIds
    
    // Update service positionIds array
    let serviceEntity = Service.load(userAddress)
    if (serviceEntity != null) {
      if (serviceEntity.positionIds == null) {
        serviceEntity.positionIds = []
      }
      let positionIds = serviceEntity.positionIds
      let positionIdString = positionId.toHexString()
      if (positionIds.indexOf(positionIdString) == -1) {
        positionIds.push(positionIdString)
        serviceEntity.positionIds = positionIds
        serviceEntity.save()
      }
      
      // Update first trading timestamp
      updateFirstTradingTimestamp(userAddress, block.timestamp)
    }
    
    // Initialize all required fields
    pp.usdCurrent = BigDecimal.zero()
    pp.amount0 = BigDecimal.zero()
    pp.amount0USD = BigDecimal.zero()
    pp.amount1 = BigDecimal.zero()
    pp.amount1USD = BigDecimal.zero()
    pp.liquidity = BigInt.zero()
    
    // Initialize entry tracking fields - capture initial transaction data
    pp.entryTxHash = txHash
    pp.entryTimestamp = block.timestamp
    pp.entryAmount0 = BigDecimal.zero()
    pp.entryAmount0USD = BigDecimal.zero()
    pp.entryAmount1 = BigDecimal.zero()
    pp.entryAmount1USD = BigDecimal.zero()
    pp.entryAmountUSD = BigDecimal.zero()
    
    // Initialize static metadata fields
    pp.tickLower = 0
    pp.tickUpper = 0
    pp.tickSpacing = 0 // Not applicable for VelodromeV2
    pp.fee = 0 // Will be set based on pool type
    
    // Get pool metadata
    const poolContract = VelodromeV2Pool.bind(poolAddress)
    
    const token0Result = poolContract.try_token0()
    const token1Result = poolContract.try_token1()
    const stableResult = poolContract.try_stable()
    
    if (!token0Result.reverted && !token1Result.reverted) {
      pp.token0 = token0Result.value
      pp.token1 = token1Result.value
      pp.token0Symbol = getTokenSymbol(token0Result.value)
      pp.token1Symbol = getTokenSymbol(token1Result.value)
      
      // Set fee based on pool type (stable vs volatile)
      if (!stableResult.reverted) {
        pp.fee = stableResult.value ? 5 : 30 // 0.05% for stable, 0.30% for volatile
      }
    }
  }
  
  // Get pool metadata if not already set
  if (!pp.token0) {
    const poolContract = VelodromeV2Pool.bind(poolAddress)
    
    const token0Result = poolContract.try_token0()
    const token1Result = poolContract.try_token1()
    const stableResult = poolContract.try_stable()
    
    if (!token0Result.reverted && !token1Result.reverted) {
      pp.token0 = token0Result.value
      pp.token1 = token1Result.value
      pp.token0Symbol = getTokenSymbol(token0Result.value)
      pp.token1Symbol = getTokenSymbol(token1Result.value)
      
      // Set fee based on pool type (stable vs volatile)
      if (!stableResult.reverted) {
        pp.fee = stableResult.value ? 5 : 30 // 0.05% for stable, 0.30% for volatile
      }
    }
  }
  
  // Convert event amounts to human readable format
  const token0Decimals = getTokenDecimals(Address.fromBytes(pp.token0!))
  const token1Decimals = getTokenDecimals(Address.fromBytes(pp.token1!))
  
  log.info("VELO_V2[{}]: Token decimals - token0: {} ({}), token1: {} ({})", [
    userAddress.toHexString(),
    token0Decimals.toString(),
    pp.token0Symbol ? pp.token0Symbol! : "Unknown",
    token1Decimals.toString(),
    pp.token1Symbol ? pp.token1Symbol! : "Unknown"
  ])
  
  const eventAmount0Human = toHumanAmount(eventAmount0, token0Decimals)
  const eventAmount1Human = toHumanAmount(eventAmount1, token1Decimals)
  
  log.info("VELO_V2[{}]: Human amounts - amount0: {} {}, amount1: {} {}", [
    userAddress.toHexString(),
    eventAmount0Human.toString(),
    pp.token0Symbol ? pp.token0Symbol! : "Unknown",
    eventAmount1Human.toString(),
    pp.token1Symbol ? pp.token1Symbol! : "Unknown"
  ])
  
  // Get USD values
  let token0Price = getTokenPriceUSD(Address.fromBytes(pp.token0!), block.timestamp, false)
  let token1Price = getTokenPriceUSD(Address.fromBytes(pp.token1!), block.timestamp, false)
  
  log.info("VELO_V2[{}]: Token prices - {} price: {} USD, {} price: {} USD", [
    userAddress.toHexString(),
    pp.token0Symbol ? pp.token0Symbol! : "Unknown",
    token0Price.toString(),
    pp.token1Symbol ? pp.token1Symbol! : "Unknown",
    token1Price.toString()
  ])
  
  const eventUsd0 = token0Price.times(eventAmount0Human)
  const eventUsd1 = token1Price.times(eventAmount1Human)
  const eventUsd = eventUsd0.plus(eventUsd1)
  
  log.info("VELO_V2[{}]: USD values - amount0: {} USD, amount1: {} USD, total: {} USD", [
    userAddress.toHexString(),
    eventUsd0.toString(),
    eventUsd1.toString(),
    eventUsd.toString()
  ])
  
  // Check if this is the first time adding liquidity (new position)
  if (pp.entryAmountUSD.equals(BigDecimal.zero()) && pp.entryTimestamp.equals(BigInt.zero())) {
    // This is the FIRST Mint event for a new position - set initial entry amounts
    pp.entryTxHash = txHash
    pp.entryTimestamp = block.timestamp
    pp.entryAmount0 = eventAmount0Human
    pp.entryAmount0USD = eventUsd0
    pp.entryAmount1 = eventAmount1Human
    pp.entryAmount1USD = eventUsd1
    pp.entryAmountUSD = eventUsd
    
    log.info("VELO V2: Position {} initial entry - {} USD", [
      positionId.toHexString(),
      pp.entryAmountUSD.toString()
    ])
  } else {
    // This is a subsequent Mint event - add to existing entry amounts
    pp.entryAmount0 = pp.entryAmount0.plus(eventAmount0Human)
    pp.entryAmount0USD = pp.entryAmount0USD.plus(eventUsd0)
    pp.entryAmount1 = pp.entryAmount1.plus(eventAmount1Human)
    pp.entryAmount1USD = pp.entryAmount1USD.plus(eventUsd1)
    pp.entryAmountUSD = pp.entryAmountUSD.plus(eventUsd)
    
    log.info("VELO V2: Position {} entry increased - {} USD", [
      positionId.toHexString(),
      pp.entryAmountUSD.toString()
    ])
  }
  
  // Save the updated entry amounts first
  pp.save()
  
  // Update current amounts by calling the regular refresh function
  refreshVeloV2Position(userAddress, poolAddress, block, txHash)
}

// Refresh VelodromeV2 position (for current state updates)
export function refreshVeloV2Position(
  userAddress: Address,
  poolAddress: Address,
  block: ethereum.Block,
  txHash: Bytes
): void {
  log.info("VELO_V2[{}]: === ENTERING refreshVeloV2Position ===", [userAddress.toHexString()])
  log.info("VELO_V2[{}]: Pool: {}, Block: {}", [
    userAddress.toHexString(),
    poolAddress.toHexString(),
    block.number.toString()
  ])
  
  const positionId = getVeloV2PositionId(userAddress, poolAddress)
  
  // Only track positions owned by a service
  const service = getServiceByAgent(userAddress)
  if (service == null) {
    log.info("VELO_V2[{}]: Service not found for position refresh", [userAddress.toHexString()])
    return
  }
  
  let pp = ProtocolPosition.load(positionId)
  if (!pp) {
    
    // Create a new position if it doesn't exist
    pp = new ProtocolPosition(positionId)
    pp.agent = userAddress
    pp.service = userAddress // Link to service
    pp.protocol = "velodrome-v2"
    pp.pool = poolAddress
    pp.isActive = true
    pp.tokenId = BigInt.zero() // VelodromeV2 doesn't use tokenIds
    
    // Update service positionIds array
    let serviceEntity = Service.load(userAddress)
    if (serviceEntity != null) {
      if (serviceEntity.positionIds == null) {
        serviceEntity.positionIds = []
      }
      let positionIds = serviceEntity.positionIds
      let positionIdString = positionId.toHexString()
      if (positionIds.indexOf(positionIdString) == -1) {
        positionIds.push(positionIdString)
        serviceEntity.positionIds = positionIds
        serviceEntity.save()
      }
      
      // Update first trading timestamp
      updateFirstTradingTimestamp(userAddress, block.timestamp)
    }
    
    // Initialize all required fields
    pp.usdCurrent = BigDecimal.zero()
    pp.amount0 = BigDecimal.zero()
    pp.amount0USD = BigDecimal.zero()
    pp.amount1 = BigDecimal.zero()
    pp.amount1USD = BigDecimal.zero()
    pp.liquidity = BigInt.zero()
    
    // Initialize entry tracking fields - capture initial transaction data
    pp.entryTxHash = txHash
    pp.entryTimestamp = block.timestamp
    pp.entryAmount0 = BigDecimal.zero()
    pp.entryAmount0USD = BigDecimal.zero()
    pp.entryAmount1 = BigDecimal.zero()
    pp.entryAmount1USD = BigDecimal.zero()
    pp.entryAmountUSD = BigDecimal.zero()
    
    // Initialize static metadata fields
    pp.tickLower = 0
    pp.tickUpper = 0
    pp.tickSpacing = 0 // Not applicable for VelodromeV2
    pp.fee = 0 // Will be set based on pool type
    
    // Get pool metadata for new position
    const poolContract = VelodromeV2Pool.bind(poolAddress)
    
    const token0Result = poolContract.try_token0()
    const token1Result = poolContract.try_token1()
    const stableResult = poolContract.try_stable()
    
    if (!token0Result.reverted && !token1Result.reverted) {
      pp.token0 = token0Result.value
      pp.token1 = token1Result.value
      pp.token0Symbol = getTokenSymbol(token0Result.value)
      pp.token1Symbol = getTokenSymbol(token1Result.value)
      
      // Set fee based on pool type (stable vs volatile)
      if (!stableResult.reverted) {
        pp.fee = stableResult.value ? 5 : 30 // 0.05% for stable, 0.30% for volatile
      }
    } else {
      log.error("VELO V2: Failed to get pool tokens {}", [poolAddress.toHexString()])
      return
    }
  }
  
  const poolContract = VelodromeV2Pool.bind(poolAddress)
  
  // Get user's LP token balance
  const balanceResult = poolContract.try_balanceOf(userAddress)
  const totalSupplyResult = poolContract.try_totalSupply()
  const reservesResult = poolContract.try_getReserves()
  
  if (balanceResult.reverted || totalSupplyResult.reverted || reservesResult.reverted) {
    log.error("VELO V2: Failed to get pool data {}", [poolAddress.toHexString()])
    return
  }
  
  const userBalance = balanceResult.value
  const totalSupply = totalSupplyResult.value
  const reserves = reservesResult.value
  
  log.info("VELO_V2[{}]: LP Token data - User balance: {}, Total supply: {}", [
    userAddress.toHexString(),
    userBalance.toString(),
    totalSupply.toString()
  ])
  
  log.info("VELO_V2[{}]: Pool reserves - reserve0: {}, reserve1: {}", [
    userAddress.toHexString(),
    reserves.value0.toString(),
    reserves.value1.toString()
  ])
  
  // If user has no LP tokens, mark position as inactive
  if (userBalance.equals(BigInt.zero())) {
    log.info("VELO_V2[{}]: User has no LP tokens - marking position as inactive", [userAddress.toHexString()])
    pp.isActive = false
    
    // No fallback mechanism for exit data - we'll rely on Burn events only
    
    // Zero out current amounts
    pp.usdCurrent = BigDecimal.zero()
    pp.amount0 = BigDecimal.zero()
    pp.amount0USD = BigDecimal.zero()
    pp.amount1 = BigDecimal.zero()
    pp.amount1USD = BigDecimal.zero()
    pp.liquidity = BigInt.zero()
  } else {
    // Calculate user's share of the pool
    const userShare = userBalance.toBigDecimal().div(totalSupply.toBigDecimal())
    const userSharePercent = userShare.times(BigDecimal.fromString("100"))
    
    log.info("VELO_V2[{}]: User share of pool: {}%", [
      userAddress.toHexString(),
      userSharePercent.toString()
    ])
    
    // Calculate current token amounts based on reserves and user's share
    const token0Decimals = getTokenDecimals(Address.fromBytes(pp.token0!))
    const token1Decimals = getTokenDecimals(Address.fromBytes(pp.token1!))
    
    const reserve0Human = toHumanAmount(reserves.value0, token0Decimals)
    const reserve1Human = toHumanAmount(reserves.value1, token1Decimals)
    
    log.info("VELO_V2[{}]: Pool reserves (human) - reserve0: {} {}, reserve1: {} {}", [
      userAddress.toHexString(),
      reserve0Human.toString(),
      pp.token0Symbol ? pp.token0Symbol! : "Unknown",
      reserve1Human.toString(),
      pp.token1Symbol ? pp.token1Symbol! : "Unknown"
    ])
    
    pp.amount0 = reserve0Human.times(userShare)
    pp.amount1 = reserve1Human.times(userShare)
    
    log.info("VELO_V2[{}]: User token amounts - amount0: {} {}, amount1: {} {}", [
      userAddress.toHexString(),
      pp.amount0!.toString(),
      pp.token0Symbol ? pp.token0Symbol! : "Unknown",
      pp.amount1!.toString(),
      pp.token1Symbol ? pp.token1Symbol! : "Unknown"
    ])
    
    // Calculate USD values
    let token0Price = getTokenPriceUSD(Address.fromBytes(pp.token0!), block.timestamp, false)
    let token1Price = getTokenPriceUSD(Address.fromBytes(pp.token1!), block.timestamp, false)
    
    pp.amount0USD = token0Price.times(pp.amount0!)
    pp.amount1USD = token1Price.times(pp.amount1!)
    pp.usdCurrent = pp.amount0USD.plus(pp.amount1USD)
    pp.liquidity = userBalance // Store LP token balance as liquidity
    
    log.info("VELO_V2[{}]: Current USD values - amount0: {} USD, amount1: {} USD, total: {} USD", [
      userAddress.toHexString(),
      pp.amount0USD.toString(),
      pp.amount1USD.toString(),
      pp.usdCurrent.toString()
    ])
    
    pp.isActive = true
    
    // If this is a new position (entry amounts not set), use current amounts as entry
    if (pp.entryAmountUSD.equals(BigDecimal.zero()) && pp.entryTimestamp.equals(BigInt.zero())) {
      pp.entryTxHash = txHash
      pp.entryTimestamp = block.timestamp
      pp.entryAmount0 = pp.amount0!
      pp.entryAmount0USD = pp.amount0USD
      pp.entryAmount1 = pp.amount1!
      pp.entryAmount1USD = pp.amount1USD
      pp.entryAmountUSD = pp.usdCurrent
      
      log.info("VELO V2: Position {} entry set - {} USD", [
        positionId.toHexString(),
        pp.entryAmountUSD.toString()
      ])
    }
  }
  
  log.info("VELO_V2[{}]: Saving position with final state - active: {}, USD: {}", [
    userAddress.toHexString(),
    pp.isActive ? "true" : "false",
    pp.usdCurrent.toString()
  ])
  
  pp.save()
  
  log.info("VELO_V2[{}]: === EXITING refreshVeloV2Position ===", [userAddress.toHexString()])
}

// Handle VelodromeV2 Burn events (liquidity removal)
export function refreshVeloV2PositionWithBurnAmounts(
  userAddress: Address,
  poolAddress: Address,
  block: ethereum.Block,
  eventAmount0: BigInt,
  eventAmount1: BigInt,
  txHash: Bytes
): void {
  const positionId = getVeloV2PositionId(userAddress, poolAddress)
  
  // Only track positions owned by a service
  const service = getServiceByAgent(userAddress)
  if (service == null) {
    return
  }
  
  let pp = ProtocolPosition.load(positionId)
  if (!pp) {
    log.error("VELO V2: Position {} not found for burn", [positionId.toHexString()])
    return
  }
  
  // Convert event amounts to human readable format
  const token0Decimals = getTokenDecimals(Address.fromBytes(pp.token0!))
  const token1Decimals = getTokenDecimals(Address.fromBytes(pp.token1!))
  
  const eventAmount0Human = toHumanAmount(eventAmount0, token0Decimals)
  const eventAmount1Human = toHumanAmount(eventAmount1, token1Decimals)
  
  // Get USD values for exit tracking
  let token0Price = getTokenPriceUSD(Address.fromBytes(pp.token0!), block.timestamp, false)
  let token1Price = getTokenPriceUSD(Address.fromBytes(pp.token1!), block.timestamp, false)
  
  const eventUsd0 = token0Price.times(eventAmount0Human)
  const eventUsd1 = token1Price.times(eventAmount1Human)
  const eventUsd = eventUsd0.plus(eventUsd1)
  
  // Update exit tracking
  pp.exitTxHash = txHash
  pp.exitTimestamp = block.timestamp
  pp.exitAmount0 = eventAmount0Human
  pp.exitAmount0USD = eventUsd0
  pp.exitAmount1 = eventAmount1Human
  pp.exitAmount1USD = eventUsd1
  pp.exitAmountUSD = eventUsd
  
  // Calculate PnL for logging
  const pnlUSD = pp.exitAmountUSD!.minus(pp.entryAmountUSD)
  
  log.info("VELO V2: Position {} burn - {} USD (PnL: {} USD)", [
    positionId.toHexString(),
    eventUsd.toString(),
    pnlUSD.toString()
  ])
  
  // Save and refresh current state
  pp.save()
  refreshVeloV2Position(userAddress, poolAddress, block, txHash)
}
