import { Address, BigInt } from "@graphprotocol/graph-ts"
import { WETH, MODE, OLAS, EZETH, UNIBTC, WEETH_MODE, STONE, WRSETH, WMLT, BMX, XVELO, USDC, USDT, OUSDT } from "./constants"

// Token configurations with empty price sources for MODE chain
export const TOKENS = new Map<string, TokenConfig>()

export class TokenConfig {
  address: Address
  symbol: string
  decimals: i32
  priceSources: PriceSourceConfig[]
  
  constructor(
    address: Address,
    symbol: string,
    decimals: i32,
    priceSources: PriceSourceConfig[]
  ) {
    this.address = address
    this.symbol = symbol
    this.decimals = decimals
    this.priceSources = priceSources
  }
}

export class PriceSourceConfig {
  address: Address
  sourceType: string
  priority: i32
  pairToken: Address | null
  fee: i32
  confidence: i32  // Expected confidence level (0-100)
  
  constructor(
    address: Address,
    sourceType: string,
    priority: i32,
    confidence: i32 = 95,
    pairToken: Address | null = null,
    fee: i32 = 0
  ) {
    this.address = address
    this.sourceType = sourceType
    this.priority = priority
    this.confidence = confidence
    this.pairToken = pairToken
    this.fee = fee
  }
}

export function getTokenConfig(address: Address): TokenConfig | null {
  let key = address.toHexString().toLowerCase()
  if (TOKENS.has(key)) {
    let config = TOKENS.get(key)
    return config ? config : null
  }
  return null
}

// Initialize token configurations with empty price sources
function initializeTokens(): void {
  
  // WETH - Empty price sources for now
  TOKENS.set(WETH.toHexString().toLowerCase(), new TokenConfig(
    WETH,
    "WETH",
    18,
    [] // Empty price sources
  ))

  // MODE - Empty price sources for now
  TOKENS.set(MODE.toHexString().toLowerCase(), new TokenConfig(
    MODE,
    "MODE",
    18,
    [] // Empty price sources
  ))

  // OLAS - Empty price sources for now
  TOKENS.set(OLAS.toHexString().toLowerCase(), new TokenConfig(
    OLAS,
    "OLAS",
    18,
    [] // Empty price sources
  ))

  // ezETH - Empty price sources for now
  TOKENS.set(EZETH.toHexString().toLowerCase(), new TokenConfig(
    EZETH,
    "ezETH",
    18,
    [] // Empty price sources
  ))

  // uniBTC - Empty price sources for now
  TOKENS.set(UNIBTC.toHexString().toLowerCase(), new TokenConfig(
    UNIBTC,
    "uniBTC",
    8,
    [] // Empty price sources
  ))

  // weETH.mode - Empty price sources for now
  TOKENS.set(WEETH_MODE.toHexString().toLowerCase(), new TokenConfig(
    WEETH_MODE,
    "weETH.mode",
    18,
    [] // Empty price sources
  ))

  // STONE - Empty price sources for now
  TOKENS.set(STONE.toHexString().toLowerCase(), new TokenConfig(
    STONE,
    "STONE",
    18,
    [] // Empty price sources
  ))

  // wrsETH - Empty price sources for now
  TOKENS.set(WRSETH.toHexString().toLowerCase(), new TokenConfig(
    WRSETH,
    "wrsETH",
    18,
    [] // Empty price sources
  ))

  // wMLT - Empty price sources for now
  TOKENS.set(WMLT.toHexString().toLowerCase(), new TokenConfig(
    WMLT,
    "wMLT",
    18,
    [] // Empty price sources
  ))

  // BMX - Empty price sources for now
  TOKENS.set(BMX.toHexString().toLowerCase(), new TokenConfig(
    BMX,
    "BMX",
    18,
    [] // Empty price sources
  ))

  // XVELO - Empty price sources for now
  TOKENS.set(XVELO.toHexString().toLowerCase(), new TokenConfig(
    XVELO,
    "XVELO",
    18,
    [] // Empty price sources
  ))

  // USDC - Empty price sources for now
  TOKENS.set(USDC.toHexString().toLowerCase(), new TokenConfig(
    USDC,
    "USDC",
    6,
    [] // Empty price sources
  ))

  // USDT - Empty price sources for now
  TOKENS.set(USDT.toHexString().toLowerCase(), new TokenConfig(
    USDT,
    "USDT",
    6,
    [] // Empty price sources
  ))

  // oUSDT - Empty price sources for now
  TOKENS.set(OUSDT.toHexString().toLowerCase(), new TokenConfig(
    OUSDT,
    "oUSDT",
    6,
    [] // Empty price sources
  ))
}

// Call initialization
initializeTokens()
