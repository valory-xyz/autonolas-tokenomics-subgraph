import { Address, Bytes } from "@graphprotocol/graph-ts"
import { Service } from "../../../../generated/schema"

// =============================================================================
// DYNAMIC SERVICE CONFIGURATION - Supports multiple services
// =============================================================================

// Token addresses (network-specific) - Keep these as they're protocol tokens, not service-specific
export const USDC_NATIVE = Address.fromString("0xd988097fb8612cc24eec14542bc03424c656005f") // USDC on MODE
export const USDC_BRIDGED = Address.fromString("0xd988097fb8612cc24eec14542bc03424c656005f") // USDC (same as native on MODE)
export const USDT_NATIVE = Address.fromString("0xf0f161fda2712db8b566946122a5af183995e2ed") // USDT on MODE

// Chainlink price feeds (network-specific) - TODO: Add when available on MODE
export const ETH_USD_FEED = Address.fromString("0x0000000000000000000000000000000000000000") // TODO: Add MODE ETH/USD feed
export const USDC_USD_FEED = Address.fromString("0x0000000000000000000000000000000000000000") // TODO: Add MODE USDC/USD feed

// Other contract addresses
export const VELO_NFT_MANAGER = Address.fromString("0x991d5546C4B442B4c5fdc4c8B8d8d131DEB24702")

// Service lookup functions - DYNAMIC (supports multiple services)
export function getServiceByAgent(address: Address): Service | null {
  // Dynamic service lookup - works for any registered service
  return Service.load(address)
}

export function isServiceAgent(address: Address): boolean {
  return getServiceByAgent(address) !== null
}

// Legacy function name for compatibility
export function isValidAgent(address: Address): boolean {
  return isServiceAgent(address)
}
