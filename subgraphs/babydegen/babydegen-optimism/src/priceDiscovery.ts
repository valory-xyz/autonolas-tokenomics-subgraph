import { Address, BigDecimal, BigInt, log, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Token, PriceSource, PriceUpdate } from "../../../../generated/schema"
import { getTokenConfig, TokenConfig, PriceSourceConfig } from "./tokenConfig"
import { CRITICAL_STABLECOINS } from "./constants"

// Cache duration: 5 minutes
const PRICE_CACHE_DURATION = BigInt.fromI32(300)
const MIN_CONFIDENCE_THRESHOLD = BigDecimal.fromString("0.5") // 50% minimum confidence

// Stablecoin fallback constants
const STABLECOIN_FALLBACK_PRICE = BigDecimal.fromString("1.0") // Default fallback for stablecoins
const STABLECOIN_FALLBACK_CONFIDENCE = BigDecimal.fromString("0.95") // 95% confidence for stablecoin fallbacks

// Simplified token validation without caching to avoid Map issues
function isTokenValidated(address: Address): boolean {
  // Direct validation without caching - simpler and safer
  let config = getTokenConfig(address)
  return config != null
}

export function getTokenPriceUSD(
  tokenAddress: Address,
  currentTimestamp: BigInt,
  forceRefresh: boolean = false
): BigDecimal {
  
  // Quick validation check first
  if (!isTokenValidated(tokenAddress)) {
    log.error("🚫 PRICE: Token not in whitelist: {}", [tokenAddress.toHexString()])
    return BigDecimal.fromString("0")
  }

  let token = Token.load(tokenAddress)
  if (token == null) {
    token = initializeToken(tokenAddress)
    if (token == null) {
      return BigDecimal.fromString("0")
    }
  }
  
  // Check cache
  if (!forceRefresh && 
      currentTimestamp.minus(token.lastPriceUpdate).lt(PRICE_CACHE_DURATION) &&
      token.priceConfidence.gt(MIN_CONFIDENCE_THRESHOLD)) {
    log.info("💾 PRICE: Using cached price for {} = ${} (confidence: {}%)", [
      token.symbol, 
      token.derivedUSD.toString(),
      token.priceConfidence.times(BigDecimal.fromString("100")).toString()
    ])
    return token.derivedUSD
  }
  
  // Get fresh price from sources
  let priceResult = getPriceFromSources(token, currentTimestamp)
  
  if (priceResult.price.gt(BigDecimal.fromString("0")) && 
      priceResult.confidence.gt(MIN_CONFIDENCE_THRESHOLD)) {
    
    // Update token with new price
    token.derivedUSD = priceResult.price
    token.priceConfidence = priceResult.confidence
    token.lastPriceUpdate = currentTimestamp
    token.save()
    
    // Create price update record
    createPriceUpdate(token, priceResult, currentTimestamp)
    
    log.info("✅ PRICE: Updated {} = ${} (confidence: {}% from {})", [
      token.symbol, 
      priceResult.price.toString(),
      priceResult.confidence.times(BigDecimal.fromString("100")).toString(),
      priceResult.source
    ])
    
    return priceResult.price
  }
  
  log.error("❌ PRICE: No reliable price found for {} (tried all sources)", [token.symbol])

  // Fallback strategy based on token type
  let tokenHex = token.id.toHexString().toLowerCase()
  
  // For critical stablecoins (USDC, USDT, DAI, LUSD), use $1.00 with high confidence
  for (let i = 0; i < CRITICAL_STABLECOINS.length; i++) {
    if (tokenHex == CRITICAL_STABLECOINS[i]) {
      log.warning("🚨 EMERGENCY: Using $1.00 fallback for critical stablecoin {}", [token.symbol])
      
      // Update token with fallback price
      token.derivedUSD = STABLECOIN_FALLBACK_PRICE
      token.priceConfidence = STABLECOIN_FALLBACK_CONFIDENCE
      token.lastPriceUpdate = currentTimestamp
      token.save()
      
      // Create fallback price update record
      let fallbackResult = new PriceResult(
        STABLECOIN_FALLBACK_PRICE,
        STABLECOIN_FALLBACK_CONFIDENCE,
        "fallback"
      )
      createPriceUpdate(token, fallbackResult, currentTimestamp)
      
      return STABLECOIN_FALLBACK_PRICE
    }
  }

  // For all other tokens, no reliable fallback
  return BigDecimal.fromString("0") // Fail gracefully for non-critical tokens
}

class PriceResult {
  price: BigDecimal
  confidence: BigDecimal
  source: string
  
  constructor(price: BigDecimal, confidence: BigDecimal, source: string) {
    this.price = price
    this.confidence = confidence
    this.source = source
  }
}

function initializeToken(address: Address): Token | null {
  let config = getTokenConfig(address)
  if (config == null) {
    return null
  }
  
  let token = new Token(address)
  token.symbol = config.symbol
  token.name = config.symbol
  token.decimals = BigInt.fromI32(config.decimals)
  token.derivedUSD = BigDecimal.fromString("0") // Start with 0, not $1
  token.priceConfidence = BigDecimal.fromString("0")
  token.priceSources = []
  token.lastPriceUpdate = BigInt.fromI32(0)
  
  // Initialize price sources
  for (let i = 0; i < config.priceSources.length; i++) {
    let sourceConfig = config.priceSources[i]
    let source = new PriceSource(sourceConfig.address)
    source.token = token.id
    source.sourceType = sourceConfig.sourceType
    source.priority = sourceConfig.priority
    source.isActive = true
    source.lastUpdate = BigInt.fromI32(0)
    source.lastPrice = BigDecimal.fromString("0")
    source.confidence = BigDecimal.fromString(sourceConfig.confidence.toString()).div(BigDecimal.fromString("100"))
    source.save()
    
    let sources = token.priceSources
    sources.push(source.id)
    token.priceSources = sources
  }
  
  token.save()
  return token
}

function getPriceFromSources(
  token: Token,
  timestamp: BigInt
): PriceResult {
  
  let config = getTokenConfig(Address.fromBytes(token.id))
  if (config == null) {
    return new PriceResult(BigDecimal.fromString("0"), BigDecimal.fromString("0"), "none")
  }
  
  // Try sources in priority order
  for (let i = 0; i < config.priceSources.length; i++) {
    let sourceConfig = config.priceSources[i]
    let result = getPriceFromSource(token, sourceConfig, timestamp)
    
    if (result.price.gt(BigDecimal.fromString("0"))) {
      log.info("✅ PRICE: Got {} price ${} from {} (confidence: {}%)", [
        token.symbol, 
        result.price.toString(), 
        sourceConfig.sourceType,
        result.confidence.times(BigDecimal.fromString("100")).toString()
      ])
      return result
    }
  }
  
  return new PriceResult(BigDecimal.fromString("0"), BigDecimal.fromString("0"), "failed")
}

function getPriceFromSource(
  token: Token,
  sourceConfig: PriceSourceConfig,
  timestamp: BigInt
): PriceResult {
  
  let sourceType = sourceConfig.sourceType
  let baseConfidence = BigDecimal.fromString(sourceConfig.confidence.toString()).div(BigDecimal.fromString("100"))
  
  if (sourceType == "chainlink") {
    // Pass block timestamp for staleness checking
    let price = getChainlinkPrice(sourceConfig.address, timestamp)
    if (price.gt(BigDecimal.fromString("0")) && isValidPriceResult(price, token.symbol)) {
      return new PriceResult(price, baseConfidence, "chainlink")
    }
  }
  
  if (sourceType == "chainlink_reference") {
    // Used for tokens without direct feeds (USDC.e referencing USDC)
    // Pass block timestamp for staleness checking
    let price = getChainlinkPrice(sourceConfig.address, timestamp)
    if (price.gt(BigDecimal.fromString("0")) && isValidPriceResult(price, token.symbol)) {
      // Slightly lower confidence for reference prices
      return new PriceResult(price, baseConfidence.times(BigDecimal.fromString("0.9")), "chainlink_ref")
    }
  }
  
  if (sourceType == "uniswap_v3") {
    let price = getUniswapV3Price(
      Address.fromBytes(token.id),
      sourceConfig.address,
      sourceConfig.pairToken!,
      sourceConfig.fee
    )
    if (price.gt(BigDecimal.fromString("0")) && isValidPriceResult(price, token.symbol)) {
      return new PriceResult(price, baseConfidence, "uniswap_v3")
    }
  }
  
  if (sourceType == "velodrome_v2" || sourceType == "velodrome_slipstream") {
    let price = getVelodromePrice(
      Address.fromBytes(token.id),
      sourceConfig.address,
      sourceConfig.pairToken!
    )
    if (price.gt(BigDecimal.fromString("0")) && isValidPriceResult(price, token.symbol)) {
      return new PriceResult(price, baseConfidence, "velodrome")
    }
  }
  
  return new PriceResult(BigDecimal.fromString("0"), BigDecimal.fromString("0"), "unsupported")
}

function createPriceUpdate(
  token: Token,
  result: PriceResult,
  timestamp: BigInt
): void {
  let id = token.id.concat(Bytes.fromUTF8(timestamp.toString()))
  let update = new PriceUpdate(id)
  update.token = token.id
  update.priceUSD = result.price
  update.confidence = result.confidence
  
  // Use the actual source that provided the price, not always the primary source
  // Find the source by type
  let sourceIndex = 0
  let sourceType = result.source
  
  for (let i = 0; i < token.priceSources.length; i++) {
    let source = PriceSource.load(token.priceSources[i])
    if (source != null && source.sourceType == sourceType) {
      sourceIndex = i
      break
    }
  }
  
  update.source = token.priceSources[sourceIndex]
  update.timestamp = timestamp
  update.block = BigInt.fromI32(0) // Would need block context
  update.save()
  
  log.info("PRICE UPDATE: {} price ${} from source {} (index {})", [
    token.symbol,
    result.price.toString(),
    sourceType,
    sourceIndex.toString()
  ])
}

function isValidPriceResult(price: BigDecimal, tokenSymbol: string): boolean {
  // Set price validation bounds based on token type
  let minPrice: BigDecimal
  let maxPrice: BigDecimal
  
  // Different bounds for stablecoins vs other tokens
  if (tokenSymbol == "USDC" || tokenSymbol == "USDT" || 
      tokenSymbol == "DAI" || tokenSymbol == "USDC.e") {
    // Core stablecoins should be within a very tight range around $1
    minPrice = BigDecimal.fromString("0.95")   // $0.95
    maxPrice = BigDecimal.fromString("1.05")   // $1.05
  } else if (tokenSymbol == "LUSD" || tokenSymbol == "FRAX" || 
      tokenSymbol == "DOLA") {
    // Variable stablecoins can have slightly more variation
    minPrice = BigDecimal.fromString("0.5")    // $0.50
    maxPrice = BigDecimal.fromString("1.5")    // $1.50
  } else {
    // Non-stablecoin tokens can have a wider range
    minPrice = BigDecimal.fromString("0.0001") // $0.0001
    maxPrice = BigDecimal.fromString("100000") // $100,000
  }
  
  if (price.le(minPrice)) {
    log.warning("⚠️ PRICE: Price too low for {}: ${}", [tokenSymbol, price.toString()])
    return false
  }
  
  if (price.ge(maxPrice)) {
    log.warning("⚠️ PRICE: Price too high for {}: ${}", [tokenSymbol, price.toString()])
    return false
  }
  
  return true
}

// Import price adapter functions 
import {
  getChainlinkPrice,
  getUniswapV3Price,
  getVelodromePrice
} from "./priceAdapters"
