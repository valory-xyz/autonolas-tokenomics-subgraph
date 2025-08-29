import { Address, BigDecimal, ethereum, log } from "@graphprotocol/graph-ts"
import { AggregatorV3Interface } from "../../../../generated/templates/Safe/AggregatorV3Interface"
import { AddressType, Service } from "../../../../generated/schema"
import { 
  USDC_NATIVE,
  USDC_BRIDGED,
  ETH_USD_FEED,
  USDC_USD_FEED,
  getServiceByAgent
} from "./config"
import { getTokenPriceUSD } from "./priceDiscovery"
import { calculatePortfolioMetrics } from "./helpers"

export const FUNDING_TOKENS: Address[] = [
  USDC_NATIVE // Native USDC on Optimism only (USDC.e/Bridged excluded from funding)
]

export function isEOA(addr: Address, block: ethereum.Block, txHash: string = ""): boolean {
  // Use the official Graph Protocol method to check if address has code
  let hasCode = ethereum.hasCode(addr).inner
  let isEOA = !hasCode // Invert: hasCode=true means contract, so isEOA=false
  
  return isEOA
}

// 🚀 PERFORMANCE OPTIMIZATION: Cached EOA check to avoid repeated RPC calls
export function isEOACached(addr: Address, block: ethereum.Block, txHash: string = ""): boolean {
  let addressId = addr
  let addressType = AddressType.load(addressId)
  
  if (addressType != null) {
    // Cache hit - return stored result (fast DB read)
    let isEOA = !addressType.isContract
    return isEOA
  }
  
  // Cache miss - check blockchain and store result (one-time RPC call)
  let hasCode = ethereum.hasCode(addr).inner
  let isContract = hasCode
  let isEOA = !isContract
  
  // Create and save cache entry
  addressType = new AddressType(addressId)
  addressType.isContract = isContract ? true : false
  addressType.checkedAt = block.number
  addressType.save()
  
  return isEOA
}

// Updated funding source check - now service-specific
export function isFundingSource(
  addr: Address, 
  serviceSafe: Address,
  block: ethereum.Block, 
  txHash: string = ""
): boolean {
  // Get the service
  let service = getServiceByAgent(serviceSafe)
  if (service == null) {
    log.warning("[FUNDING_SOURCE] txHash: {} - No service found for safe {}", [txHash, serviceSafe.toHexString()])
    return false
  }
  
  // Check if address is this service's operator
  let isOperator = addr.equals(Address.fromBytes(service.operatorSafe))
  
  // Check if address is an EOA
  let eoa = isEOACached(addr, block, txHash)
  
  let result = isOperator || eoa
  return result
}

// Legacy isSafe function - now checks if address is any service safe
export function isSafe(addr: Address, txHash: string = ""): boolean {
  return getServiceByAgent(addr) !== null
}

function fetchFeedUsd(feed: Address): BigDecimal {
  let oracle = AggregatorV3Interface.bind(feed)
  let roundResult = oracle.try_latestRoundData()
  
  if (roundResult.reverted) {
    log.warning("[CHAINLINK_FEED] Failed to fetch price from feed: {}", [feed.toHexString()])
    return BigDecimal.fromString("0")
  }
  
  let round = roundResult.value
  let price = round.value1.toBigDecimal().div(BigDecimal.fromString("1e8"))
  
  // Validate price is reasonable (not zero, not negative)
  if (price.le(BigDecimal.fromString("0"))) {
    log.warning("[CHAINLINK_FEED] Invalid price from feed {}: {}", [feed.toHexString(), price.toString()])
    return BigDecimal.fromString("0")
  }
  
  return price
}

export function getEthUsd(block: ethereum.Block): BigDecimal {
  // Try Chainlink feed first
  let chainlinkPrice = fetchFeedUsd(ETH_USD_FEED)
  
  if (chainlinkPrice.gt(BigDecimal.fromString("0"))) {
    return chainlinkPrice
  }
  
  // Fallback to Velodrome pool pricing
  log.info("[ETH_PRICE] Chainlink feed failed, using Velodrome pool fallback", [])
  return getUsd(Address.fromString("0x4200000000000000000000000000000000000006"), block) // WETH address from constants
}

export function getUsdcUsd(_b: ethereum.Block): BigDecimal {
  return BigDecimal.fromString("1.0")
}

// Generic USD price function for any token
export function getUsd(token: Address, block: ethereum.Block): BigDecimal {
  // Use hardcoded pool pricing for all whitelisted tokens
  return getTokenPriceUSD(token, block.timestamp, false)
}

// Portfolio refresh function
export function refreshPortfolio(agent: Address, block: ethereum.Block): void {
  calculatePortfolioMetrics(agent, block)
}
