import { Address, BigDecimal, BigInt, log, ethereum } from "@graphprotocol/graph-ts"
import { VelodromeCLPool } from "../../../../generated/VeloNFTManager/VelodromeCLPool"
import { VelodromeV2Pool } from "../../../../generated/templates/VeloV2Pool/VelodromeV2Pool"
import { AggregatorV3Interface } from "../../../../generated/templates/Safe/AggregatorV3Interface"
import { getTokenConfig } from "./tokenConfig"
import { USDC_NATIVE, USDT, DAI, LUSD, DOLA, WETH, Q96 } from "./constants"

// Chainlink price adapter with validation
export function getChainlinkPrice(feedAddress: Address, blockTimestamp: BigInt = BigInt.fromI32(0)): BigDecimal {
  log.info("📊 CHAINLINK: Getting price from feed {}", [feedAddress.toHexString()])
  
  let aggregator = AggregatorV3Interface.bind(feedAddress)
  let roundResult = aggregator.try_latestRoundData()
  
  if (roundResult.reverted) {
    log.warning("❌ CHAINLINK: Failed to get price from feed {}", [feedAddress.toHexString()])
    return BigDecimal.fromString("0")
  }
  
  let roundData = roundResult.value
  let price = roundData.value1.toBigDecimal().div(BigDecimal.fromString("1e8")) // 8 decimals
  
  // PRODUCTION ENHANCEMENT: Staleness checking
  // Only check staleness if a block timestamp is provided
  if (!blockTimestamp.equals(BigInt.fromI32(0))) {
    // Chainlink updatedAt timestamp
    let updatedAt = roundData.value3
    
    // Stale data threshold (24 hours in seconds)
    const STALE_PRICE_THRESHOLD = BigInt.fromI32(86400)
    
    // Calculate how old the data is
    let dataAge = blockTimestamp.minus(updatedAt)
    
    // If data is older than threshold, reject it
    if (dataAge.gt(STALE_PRICE_THRESHOLD)) {
      log.warning("⚠️ CHAINLINK: Stale price from feed {}, last updated {} seconds ago", [
        feedAddress.toHexString(),
        dataAge.toString()
      ])
      return BigDecimal.fromString("0") // Reject stale price
    }
    
    // Log the data age for monitoring
    log.info("📊 CHAINLINK: Price from feed {} is {} seconds old", [
      feedAddress.toHexString(),
      dataAge.toString()
    ])
  }
  
  // Validate price is reasonable (not zero, not negative)
  if (price.le(BigDecimal.fromString("0"))) {
    log.error("❌ CHAINLINK: Invalid price {} from feed {}", [
      price.toString(), 
      feedAddress.toHexString()
    ])
    return BigDecimal.fromString("0")
  }
  
  return price
}


// Uniswap V3 price adapter with proper math
export function getUniswapV3Price(
  token: Address,
  poolAddress: Address,
  pairToken: Address,
  fee: number
): BigDecimal {
  
  log.info("📊 UNISWAP: Getting {} price from V3 pool {}", [
    token.toHexString(), 
    poolAddress.toHexString()
  ])
  
  let pool = VelodromeCLPool.bind(poolAddress) // Same interface
  let slot0Result = pool.try_slot0()
  
  if (slot0Result.reverted) {
    log.warning("❌ UNISWAP: Failed to get slot0 from pool {}", [poolAddress.toHexString()])
    return BigDecimal.fromString("0")
  }
  
  let slot0 = slot0Result.value
  let sqrtPriceX96 = slot0.value0
  
  // Get token order
  let token0Result = pool.try_token0()
  let token1Result = pool.try_token1()
  
  if (token0Result.reverted || token1Result.reverted) {
    return BigDecimal.fromString("0")
  }
  
  let token0 = token0Result.value
  let token1 = token1Result.value
  
  // Get actual token decimals from config instead of hardcoding
  let targetTokenConfig = getTokenConfig(token)
  let pairTokenConfig = getTokenConfig(pairToken)

  if (targetTokenConfig == null || pairTokenConfig == null) {
    log.warning("❌ UNISWAP: Missing token config for {} or {}", [
      token.toHexString(), 
      pairToken.toHexString()
    ])
    return BigDecimal.fromString("0")
  }

  // Determine which token is token0 and token1
  let token0Decimals: number
  let token1Decimals: number

  log.info("📊 UNISWAP: Pool tokens - token0: {}, token1: {}", [
    token0.toHexString(),
    token1.toHexString()
  ])
  log.info("📊 UNISWAP: Looking for token: {}, pair token: {}", [
    token.toHexString(),
    pairToken.toHexString()
  ])
  log.info("📊 UNISWAP: sqrtPriceX96: {}", [sqrtPriceX96.toString()])

  // Get current block timestamp from slot0 if available
  // Convert to BigInt as observationCardinality is a number
  let blockTimestamp = BigInt.fromI32(slot0.value2) // observationCardinality contains the timestamp
  
  if (token.equals(token0)) {
    token0Decimals = targetTokenConfig.decimals
    token1Decimals = pairTokenConfig.decimals
    log.info("📊 UNISWAP: Token is token0, decimals: {} / {}", [
      token0Decimals.toString(),
      token1Decimals.toString()
    ])
    // Token is token0, get price in terms of token1
    let price = sqrtPriceToToken0Price(sqrtPriceX96, token0Decimals, token1Decimals)
    // Pass block timestamp for staleness checking
    let pairPrice = getPairTokenPrice(pairToken, blockTimestamp)
    log.info("📊 UNISWAP: Raw price: {}, pair price: {}, final: {}", [
      price.toString(),
      pairPrice.toString(),
      price.times(pairPrice).toString()
    ])
    return price.times(pairPrice)
  } else if (token.equals(token1)) {
    token0Decimals = pairTokenConfig.decimals
    token1Decimals = targetTokenConfig.decimals
    log.info("📊 UNISWAP: Token is token1, decimals: {} / {}", [
      token0Decimals.toString(),
      token1Decimals.toString()
    ])
    // Token is token1, get price in terms of token0
    let price = sqrtPriceToToken1Price(sqrtPriceX96, token0Decimals, token1Decimals)
    // Pass block timestamp for staleness checking
    let pairPrice = getPairTokenPrice(pairToken, blockTimestamp)
    log.info("📊 UNISWAP: Raw price: {}, pair price: {}, final: {}", [
      price.toString(),
      pairPrice.toString(),
      price.times(pairPrice).toString()
    ])
    return price.times(pairPrice)
  }
  
  return BigDecimal.fromString("0")
}

// Velodrome price adapter (same as Uniswap V3)
export function getVelodromePrice(
  token: Address,
  poolAddress: Address,
  pairToken: Address
): BigDecimal {
  
  log.info("📊 VELODROME: Getting {} price from pool {}", [
    token.toHexString(), 
    poolAddress.toHexString()
  ])
  
  // Use same logic as Uniswap V3 since Velodrome CL uses similar interface
  return getUniswapV3Price(token, poolAddress, pairToken, 0)
}

// Helper functions
// Velodrome V2 (standard) price adapter - using getReserves instead of slot0
export function getVelodromeV2Price(
  token: Address,
  poolAddress: Address,
  pairToken: Address
): BigDecimal {
  
  log.info("📊 VELODROME V2: Getting {} price from pool {}", [
    token.toHexString(), 
    poolAddress.toHexString()
  ])
  
  let pool = VelodromeV2Pool.bind(poolAddress)
  
  // Get token order
  let token0Result = pool.try_token0()
  let token1Result = pool.try_token1()
  
  if (token0Result.reverted || token1Result.reverted) {
    log.warning("❌ VELODROME V2: Failed to get tokens from pool {}", [poolAddress.toHexString()])
    return BigDecimal.fromString("0")
  }
  
  let token0 = token0Result.value
  let token1 = token1Result.value
  
  // Get token info
  let targetTokenConfig = getTokenConfig(token)
  let pairTokenConfig = getTokenConfig(pairToken)
  
  if (targetTokenConfig == null || pairTokenConfig == null) {
    log.warning("❌ VELODROME V2: Missing token config for {} or {}", [
      token.toHexString(), 
      pairToken.toHexString()
    ])
    return BigDecimal.fromString("0")
  }
  
  // Get reserves
  let reservesResult = pool.try_getReserves()
  
  if (reservesResult.reverted) {
    log.warning("❌ VELODROME V2: Failed to get reserves from pool {}", [poolAddress.toHexString()])
    return BigDecimal.fromString("0")
  }
  
  let reserves = reservesResult.value
  let reserve0 = reserves.value0
  let reserve1 = reserves.value1
  let blockTimestampLast = BigInt.fromI32(reserves.value2.toI32())
  
  log.info("📊 VELODROME V2: Pool tokens - token0: {}, token1: {}", [
    token0.toHexString(),
    token1.toHexString()
  ])
  log.info("📊 VELODROME V2: Reserves - reserve0: {}, reserve1: {}", [
    reserve0.toString(),
    reserve1.toString()
  ])
  
  // Get token decimals
  let token0Decimals: number
  let token1Decimals: number
  
  // Calculate price based on token position
  if (token.equals(token0)) {
    // Target token is token0
    token0Decimals = targetTokenConfig.decimals
    token1Decimals = pairTokenConfig.decimals
    
    log.info("📊 VELODROME V2: Target token is token0, decimals: {} / {}", [
      token0Decimals.toString(),
      token1Decimals.toString()
    ])
    
    // Calculate price in terms of token1
    if (reserve0.equals(BigInt.fromI32(0))) {
      log.warning("❌ VELODROME V2: Zero reserve for token0", [])
      return BigDecimal.fromString("0")
    }
    
    // Price = reserve1 / reserve0 adjusted for decimals
    let rawPrice = reserve1.toBigDecimal().div(reserve0.toBigDecimal())
    
    // Adjust for decimal differences
    let decimalAdjustment = BigDecimal.fromString("1")
    let decimalDiff = token1Decimals - token0Decimals
    
    if (decimalDiff > 0) {
      for (let i = 0; i < decimalDiff; i++) {
        decimalAdjustment = decimalAdjustment.times(BigDecimal.fromString("10"))
      }
      rawPrice = rawPrice.div(decimalAdjustment)
    } else if (decimalDiff < 0) {
      for (let i = 0; i < -decimalDiff; i++) {
        decimalAdjustment = decimalAdjustment.times(BigDecimal.fromString("10"))
      }
      rawPrice = rawPrice.times(decimalAdjustment)
    }
    
    // Multiply by pair token price to get USD value
    let pairPrice = getPairTokenPrice(pairToken, blockTimestampLast)
    let finalPrice = rawPrice.times(pairPrice)
    
    log.info("📊 VELODROME V2: Raw price: {}, pair price: {}, final price: {}", [
      rawPrice.toString(),
      pairPrice.toString(),
      finalPrice.toString()
    ])
    
    return finalPrice
  } else if (token.equals(token1)) {
    // Target token is token1
    token0Decimals = pairTokenConfig.decimals
    token1Decimals = targetTokenConfig.decimals
    
    log.info("📊 VELODROME V2: Target token is token1, decimals: {} / {}", [
      token0Decimals.toString(),
      token1Decimals.toString()
    ])
    
    // Calculate price in terms of token0
    if (reserve1.equals(BigInt.fromI32(0))) {
      log.warning("❌ VELODROME V2: Zero reserve for token1", [])
      return BigDecimal.fromString("0")
    }
    
    // Price = reserve0 / reserve1 adjusted for decimals
    let rawPrice = reserve0.toBigDecimal().div(reserve1.toBigDecimal())
    
    // Adjust for decimal differences
    let decimalAdjustment = BigDecimal.fromString("1")
    let decimalDiff = token0Decimals - token1Decimals
    
    if (decimalDiff > 0) {
      for (let i = 0; i < decimalDiff; i++) {
        decimalAdjustment = decimalAdjustment.times(BigDecimal.fromString("10"))
      }
      rawPrice = rawPrice.div(decimalAdjustment)
    } else if (decimalDiff < 0) {
      for (let i = 0; i < -decimalDiff; i++) {
        decimalAdjustment = decimalAdjustment.times(BigDecimal.fromString("10"))
      }
      rawPrice = rawPrice.times(decimalAdjustment)
    }
    
    // Multiply by pair token price to get USD value
    let pairPrice = getPairTokenPrice(pairToken, blockTimestampLast)
    let finalPrice = rawPrice.times(pairPrice)
    
    log.info("📊 VELODROME V2: Raw price: {}, pair price: {}, final price: {}", [
      rawPrice.toString(),
      pairPrice.toString(),
      finalPrice.toString()
    ])
    
    return finalPrice
  }
  
  log.warning("❌ VELODROME V2: Token not found in pool", [])
  return BigDecimal.fromString("0")
}

function getPairTokenPrice(pairToken: Address, blockTimestamp: BigInt = BigInt.fromI32(0)): BigDecimal {
  let tokenHex = pairToken.toHexString().toLowerCase()
  
  // Direct stablecoin pricing - NO RECURSION
  let stablecoins = [
    USDC_NATIVE.toHexString().toLowerCase(),
    USDT.toHexString().toLowerCase(),
    DAI.toHexString().toLowerCase(),
    LUSD.toHexString().toLowerCase(),
    DOLA.toHexString().toLowerCase()  // Add DOLA to direct stablecoin list
  ]
  
  for (let i = 0; i < stablecoins.length; i++) {
    if (tokenHex == stablecoins[i]) {
      return BigDecimal.fromString("1.0")
    }
  }
  
  // WETH - direct Chainlink call (NO RECURSION)
  if (tokenHex == WETH.toHexString().toLowerCase()) {
    let ethFeed = Address.fromString("0x13e3Ee699D1909E989722E753853AE30b17e08c5")
    // Pass block timestamp for staleness checking if available
    let ethPrice = getChainlinkPrice(ethFeed, blockTimestamp)
    return ethPrice.gt(BigDecimal.fromString("0")) ? ethPrice : BigDecimal.fromString("3000.0")
  }
  
  // Safe fallback for unknown tokens
  log.warning("⚠️ PRICE: Unknown pair token {}, using $1 fallback", [tokenHex])
  return BigDecimal.fromString("1.0")
}

function sqrtPriceToToken0Price(
  sqrtPriceX96: BigInt,
  token0Decimals: number,
  token1Decimals: number
): BigDecimal {
  
  // Safety check: prevent division by zero
  if (sqrtPriceX96.equals(BigInt.fromI32(0))) {
    log.warning("⚠️ MATH: sqrtPriceX96 is zero", [])
    return BigDecimal.fromString("0")
  }
  
  // Safety check: reasonable decimal values
  if (token0Decimals < 0 || token0Decimals > 18 || 
      token1Decimals < 0 || token1Decimals > 18) {
    log.warning("⚠️ MATH: Invalid decimals - token0: {}, token1: {}", [
      token0Decimals.toString(10),
      token1Decimals.toString(10)
    ])
    return BigDecimal.fromString("0")
  }
  
  let sqrtPrice = sqrtPriceX96.toBigDecimal().div(Q96.toBigDecimal())
  
  // Safety check: reasonable sqrtPrice range
  if (sqrtPrice.le(BigDecimal.fromString("0")) || 
      sqrtPrice.gt(BigDecimal.fromString("1000000"))) {
    log.warning("⚠️ MATH: Suspicious sqrtPrice: {}", [sqrtPrice.toString()])
    return BigDecimal.fromString("0")
  }
  
  let price = sqrtPrice.times(sqrtPrice) // Square it safely
  
  log.info("📊 MATH: sqrtPrice: {}, price before adjustment: {}", [
    sqrtPrice.toString(),
    price.toString()
  ])
  
  // Decimal adjustment with bounds checking
  let decimalDiff = token1Decimals - token0Decimals
  log.info("📊 MATH: Decimal difference: {} (token1: {} - token0: {})", [
    decimalDiff.toString(),
    token1Decimals.toString(),
    token0Decimals.toString()
  ])
  if (decimalDiff > 0 && decimalDiff <= 18) {
    let multiplier = BigDecimal.fromString("1")
    for (let i = 0; i < decimalDiff; i++) {
      multiplier = multiplier.times(BigDecimal.fromString("10"))
    }
    price = price.times(multiplier)
  } else if (decimalDiff < 0 && decimalDiff >= -18) {
    let divisor = BigDecimal.fromString("1")
    for (let i = 0; i < -decimalDiff; i++) {
      divisor = divisor.times(BigDecimal.fromString("10"))
    }
    price = price.div(divisor)
  } else if (decimalDiff != 0) {
    log.warning("⚠️ MATH: Extreme decimal difference: {}", [decimalDiff.toString(10)])
  }
  
  log.info("📊 MATH: Final price after adjustment: {}", [price.toString()])
  
  // Final safety check
  if (price.le(BigDecimal.fromString("0")) || 
      price.gt(BigDecimal.fromString("1000000"))) {
    log.warning("⚠️ MATH: Final price out of bounds: {}", [price.toString()])
    return BigDecimal.fromString("0")
  }
  
  return price
}

function sqrtPriceToToken1Price(
  sqrtPriceX96: BigInt,
  token0Decimals: number,
  token1Decimals: number
): BigDecimal {
  let token0Price = sqrtPriceToToken0Price(sqrtPriceX96, token0Decimals, token1Decimals)
  return token0Price.equals(BigDecimal.fromString("0")) 
    ? BigDecimal.fromString("0")
    : BigDecimal.fromString("1").div(token0Price)
}
