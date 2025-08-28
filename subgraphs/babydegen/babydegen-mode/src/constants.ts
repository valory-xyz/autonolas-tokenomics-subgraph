import { Address, BigInt } from "@graphprotocol/graph-ts"

// =============================================================================
// MATHEMATICAL CONSTANTS
// =============================================================================

// Q96 constant used in Uniswap V3 math (2^96)
export const Q96 = BigInt.fromString("79228162514264337593543950336")

// =============================================================================
// NETWORK-SPECIFIC CONSTANTS FOR MODE
// =============================================================================

// Token addresses (MODE mainnet)
export const WETH = Address.fromString("0x4200000000000000000000000000000000000006") // WETH
export const MODE = Address.fromString("0xdfc7c877a950e49d2610114102175a06c2e3167a") // MODE
export const OLAS = Address.fromString("0xcfd1d50ce23c46d3cf6407487b2f8934e96dc8f9") // OLAS
export const EZETH = Address.fromString("0x2416092f143378750bb29b79ed961ab195cceea5") // ezETH
export const UNIBTC = Address.fromString("0x6b2a01a5f79deb4c2f3c0eda7b01df456fbd726a") // uniBTC
export const WEETH_MODE = Address.fromString("0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A") // weETH.mode
export const STONE = Address.fromString("0x80137510979822322193FC997d400D5A6C747bf7") // STONE
export const WRSETH = Address.fromString("0xe7903B1F75C534Dd8159b313d92cDCfbC62cB3Cd") // wrsETH
export const WMLT = Address.fromString("0x8b2EeA0999876AAB1E7955fe01A5D261b570452C") // wMLT
export const BMX = Address.fromString("0x66eEd5FF1701E6ed8470DC391F05e27B1d0657eb") // BMX
export const XVELO = Address.fromString("0x7f9AdFbd38b669F03d1d11000Bc76b9AaEA28A81") // XVELO
export const USDC = Address.fromString("0xd988097fb8612cc24eec14542bc03424c656005f") // USDC
export const USDT = Address.fromString("0xf0f161fda2712db8b566946122a5af183995e2ed") // USDT
export const OUSDT = Address.fromString("0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189") // oUSDT

// Legacy aliases for compatibility with existing code
export const USDC_NATIVE = USDC // MODE only has one USDC
export const USDC_BRIDGED = USDC // MODE only has one USDC (no bridged version)

// Chainlink price feeds (MODE mainnet) - TODO: Add when available
// export const ETH_USD_FEED = Address.fromString("") // TODO: Add MODE ETH/USD feed
// export const USDC_USD_FEED = Address.fromString("") // TODO: Add MODE USDC/USD feed

// DeFi protocol addresses
export const VELO_NFT_MANAGER = Address.fromString("0x991d5546C4B442B4c5fdc4c8B8d8d131DEB24702")
export const VELO_V2_SUGAR = Address.fromString("0x9ECd2f44f72E969fa3F3C4e4F63bc61E0C08F31F")
export const VELO_V2_FACTORY = Address.fromString("0x31832f2a97Fd20664D76Cc421207669b55CE4BC0") // Velodrome V2 Factory on MODE

// STURDY protocol addresses
export const STURDY_YEARN_VAULT = Address.fromString("0x2dE57F6432Ac67A99aF5aB17017005048AE7A24C")

// Balancer protocol addresses
export const BALANCER_VAULT = Address.fromString("0xBA12222222228d8Ba445958a75a0704d566BF2C8")

// Velodrome CL (Concentrated Liquidity) addresses
export const VELO_MANAGER = Address.fromString("0x991d5546C4B442B4c5fdc4c8B8d8d131DEB24702") // Velodrome CL NFT Position Manager
export const VELO_FACTORY = Address.fromString("0x04625B046C69577EfC40e6c0Bb83CDBAfab5a55F") // Velodrome CL Factory on MODE

// OLAS-related addresses (TODO: Update with MODE addresses when available)
// export const OLAS_TOKEN = Address.fromString("") // TODO: Add MODE OLAS token address
// export const STAKING_FACTORY = Address.fromString("") // TODO: Add MODE staking factory

// Service configuration
export const OPTIMUS_AGENT_ID = BigInt.fromI32(40)

// Whitelisted tokens array (for easy iteration) - MODE tokens
export const WHITELISTED_TOKENS: string[] = [
  WETH.toHexString(),
  MODE.toHexString(),
  OLAS.toHexString(),
  EZETH.toHexString(),
  UNIBTC.toHexString(),
  WEETH_MODE.toHexString(),
  STONE.toHexString(),
  WRSETH.toHexString(),
  WMLT.toHexString(),
  BMX.toHexString(),
  XVELO.toHexString(),
  USDC.toHexString(),
  USDT.toHexString(),
  OUSDT.toHexString()
]

// Stablecoin addresses (for price fallbacks) - MODE stablecoins
export const STABLECOINS: string[] = [
  USDC.toHexString(),
  USDT.toHexString(),
  OUSDT.toHexString()
]

// Critical stablecoins (for emergency fallbacks) - MODE stablecoins
export const CRITICAL_STABLECOINS: string[] = [
  USDC.toHexString(),
  USDT.toHexString(),
  OUSDT.toHexString()
]
