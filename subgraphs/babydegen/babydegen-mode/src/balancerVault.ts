import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { PoolBalanceChanged, BalancerV2Vault } from "../generated/BalancerVault/BalancerV2Vault"
import { BalancerV2WeightedPool } from "../generated/BalancerVault/BalancerV2WeightedPool"
import { ProtocolPosition, Service } from "../generated/schema"
import { getServiceByAgent } from "./config"
import { getTokenConfig } from "./tokenConfig"
import { getTokenPriceUSD } from "./priceDiscovery"
import { refreshPortfolio } from "./common"
import { updateFirstTradingTimestamp } from "./helpers"
import { BALANCER_VAULT } from "./constants"

// Handle PoolBalanceChanged events - captures both entries and exits
export function handlePoolBalanceChanged(event: PoolBalanceChanged): void {
  let poolId = event.params.poolId
  let liquidityProvider = event.params.liquidityProvider
  let tokens = event.params.tokens
  let deltas = event.params.deltas
  let protocolFeeAmounts = event.params.protocolFeeAmounts
  
  // Check if liquidityProvider is a service safe
  let service = getServiceByAgent(liquidityProvider)
  if (service == null) {
    log.debug("BALANCER: LiquidityProvider {} is not a tracked service safe", [liquidityProvider.toHexString()])
    return
  }

  // Extract pool address from poolId (first 20 bytes)
  let poolAddressBytes = Bytes.fromUint8Array(poolId.subarray(0, 20))
  let poolAddress = Address.fromBytes(poolAddressBytes)
  
  log.info("BALANCER: Processing PoolBalanceChanged for service safe: {}, pool: {}, tokens: {}", [
    liquidityProvider.toHexString(),
    poolAddress.toHexString(),
    tokens.length.toString()
  ])

  // Determine if this is an entry or exit based on deltas
  let isEntry = true
  let isExit = true
  
  for (let i = 0; i < deltas.length; i++) {
    if (deltas[i].lt(BigInt.fromI32(0))) {
      isEntry = false // Found negative delta
    }
    if (deltas[i].gt(BigInt.fromI32(0))) {
      isExit = false // Found positive delta
    }
  }
  
  // Skip if mixed deltas (shouldn't happen based on user confirmation)
  if (!isEntry && !isExit) {
    log.warning("BALANCER: Mixed deltas detected for service safe {} in pool {} - skipping", [
      liquidityProvider.toHexString(),
      poolAddress.toHexString()
    ])
    return
  }
  
  if (isEntry) {
    handleBalancerEntry(event, service, poolId, poolAddress, liquidityProvider, tokens, deltas)
  } else if (isExit) {
    handleBalancerExit(event, service, poolId, poolAddress, liquidityProvider, tokens, deltas)
  }
}

// Handle Balancer position entries (positive deltas)
function handleBalancerEntry(
  event: PoolBalanceChanged,
  service: Service,
  poolId: Bytes,
  poolAddress: Address,
  liquidityProvider: Address,
  tokens: Address[],
  deltas: BigInt[]
): void {
  
  log.info("BALANCER: Processing entry for service safe: {}, pool: {}", [
    liquidityProvider.toHexString(),
    poolAddress.toHexString()
  ])

  // Create position ID: "<serviceSafe>-balancer-<poolId>-<timestamp>"
  let positionId = liquidityProvider
    .concat(Bytes.fromUTF8("-balancer-"))
    .concat(poolId)
    .concat(Bytes.fromUTF8("-"))
    .concat(Bytes.fromUTF8(event.block.timestamp.toString()))

  // Create new Balancer position
  let position = new ProtocolPosition(positionId)
  position.agent = liquidityProvider
  position.service = service.id
  position.protocol = "balancer"
  position.pool = poolAddress
  
  // Position status
  position.isActive = true
  
  // Handle first two tokens (token0 and token1)
  if (tokens.length >= 1) {
    position.token0 = tokens[0]
    let token0Config = getTokenConfig(tokens[0])
    position.token0Symbol = token0Config != null ? token0Config.symbol : "UNKNOWN"
  }
  
  if (tokens.length >= 2) {
    position.token1 = tokens[1]
    let token1Config = getTokenConfig(tokens[1])
    position.token1Symbol = token1Config != null ? token1Config.symbol : "UNKNOWN"
  } else {
    position.token1 = null
    position.token1Symbol = null
  }
  
  // Calculate entry amounts and USD values (production-level calculations)
  let entryAmount0 = BigDecimal.fromString("0")
  let entryAmount0USD = BigDecimal.fromString("0")
  let entryAmount1 = BigDecimal.fromString("0")
  let entryAmount1USD = BigDecimal.fromString("0")
  
  // Process token0 (first token)
  if (tokens.length >= 1 && deltas.length >= 1) {
    let token0Config = getTokenConfig(tokens[0])
    if (token0Config != null) {
      let decimals = BigDecimal.fromString("1")
      for (let i = 0; i < token0Config.decimals; i++) {
        decimals = decimals.times(BigDecimal.fromString("10"))
      }
      entryAmount0 = deltas[0].toBigDecimal().div(decimals)
      let token0Price = getTokenPriceUSD(tokens[0], event.block.timestamp)
      entryAmount0USD = entryAmount0.times(token0Price)
    }
  }
  
  // Process token1 (second token)
  if (tokens.length >= 2 && deltas.length >= 2) {
    let token1Config = getTokenConfig(tokens[1])
    if (token1Config != null) {
      let decimals = BigDecimal.fromString("1")
      for (let i = 0; i < token1Config.decimals; i++) {
        decimals = decimals.times(BigDecimal.fromString("10"))
      }
      entryAmount1 = deltas[1].toBigDecimal().div(decimals)
      let token1Price = getTokenPriceUSD(tokens[1], event.block.timestamp)
      entryAmount1USD = entryAmount1.times(token1Price)
    }
  }
  
  let totalEntryUSD = entryAmount0USD.plus(entryAmount1USD)
  
  // Entry tracking
  position.entryTxHash = event.transaction.hash
  position.entryTimestamp = event.block.timestamp
  position.entryAmount0 = entryAmount0
  position.entryAmount0USD = entryAmount0USD
  position.entryAmount1 = entryAmount1
  position.entryAmount1USD = entryAmount1USD
  position.entryAmountUSD = totalEntryUSD
  
  // Current state (same as entry initially)
  position.amount0 = entryAmount0
  position.amount0USD = entryAmount0USD
  position.amount1 = entryAmount1
  position.amount1USD = entryAmount1USD
  position.usdCurrent = totalEntryUSD
  
  // Get BPT balance via RPC call (production-level)
  let pool = BalancerV2WeightedPool.bind(poolAddress)
  let bptBalanceResult = pool.try_balanceOf(liquidityProvider)
  
  if (!bptBalanceResult.reverted) {
    position.liquidity = bptBalanceResult.value
    log.info("BALANCER: Got BPT balance {} for position {}", [
      bptBalanceResult.value.toString(),
      positionId.toHexString()
    ])
  } else {
    position.liquidity = BigInt.fromI32(0)
    log.warning("BALANCER: Failed to get BPT balance for position {}", [positionId.toHexString()])
  }
  
  // Balancer-specific: no ticks, store poolId as tokenId for reference
  position.tickLower = 0
  position.tickUpper = 0
  position.tickSpacing = 0
  position.fee = 0
  position.tokenId = BigInt.fromI32(0) // Could store pool ID hash if needed
  
  // Clear exit data
  position.exitTxHash = null
  position.exitTimestamp = null
  position.exitAmount0 = null
  position.exitAmount0USD = null
  position.exitAmount1 = null
  position.exitAmount1USD = null
  position.exitAmountUSD = null
  
  // Add position ID to service's position list
  let positionIds = service.positionIds
  positionIds.push(positionId.toHexString())
  service.positionIds = positionIds
  service.save()
  
  // Update first trading timestamp
  updateFirstTradingTimestamp(liquidityProvider, event.block.timestamp)
  
  position.save()
  
  // Refresh portfolio (same as Velodrome pattern)
  refreshPortfolio(liquidityProvider, event.block)
  
  log.info("BALANCER: Created position {} for agent {} with ${} USD total entry", [
    positionId.toHexString(),
    liquidityProvider.toHexString(),
    totalEntryUSD.toString()
  ])
}

// Handle Balancer position exits (negative deltas)
function handleBalancerExit(
  event: PoolBalanceChanged,
  service: Service,
  poolId: Bytes,
  poolAddress: Address,
  liquidityProvider: Address,
  tokens: Address[],
  deltas: BigInt[]
): void {
  
  log.info("BALANCER: Processing exit for service safe: {}, pool: {}", [
    liquidityProvider.toHexString(),
    poolAddress.toHexString()
  ])

  // Find active Balancer position for this agent and pool
  let activePosition = findActiveBalancerPosition(liquidityProvider, poolAddress)
  
  if (activePosition == null) {
    log.warning("BALANCER: No active position found for agent {} in pool {} during exit", [
      liquidityProvider.toHexString(),
      poolAddress.toHexString()
    ])
    return
  }

  // Calculate exit amounts and USD values (use absolute values of negative deltas)
  let exitAmount0 = BigDecimal.fromString("0")
  let exitAmount0USD = BigDecimal.fromString("0")
  let exitAmount1 = BigDecimal.fromString("0")
  let exitAmount1USD = BigDecimal.fromString("0")
  
  // Process token0 (first token)
  if (tokens.length >= 1 && deltas.length >= 1) {
    let token0Config = getTokenConfig(tokens[0])
    if (token0Config != null) {
      let decimals = BigDecimal.fromString("1")
      for (let i = 0; i < token0Config.decimals; i++) {
        decimals = decimals.times(BigDecimal.fromString("10"))
      }
      // Use absolute value of negative delta
      exitAmount0 = deltas[0].neg().toBigDecimal().div(decimals)
      let token0Price = getTokenPriceUSD(tokens[0], event.block.timestamp)
      exitAmount0USD = exitAmount0.times(token0Price)
    }
  }
  
  // Process token1 (second token)
  if (tokens.length >= 2 && deltas.length >= 2) {
    let token1Config = getTokenConfig(tokens[1])
    if (token1Config != null) {
      let decimals = BigDecimal.fromString("1")
      for (let i = 0; i < token1Config.decimals; i++) {
        decimals = decimals.times(BigDecimal.fromString("10"))
      }
      // Use absolute value of negative delta
      exitAmount1 = deltas[1].neg().toBigDecimal().div(decimals)
      let token1Price = getTokenPriceUSD(tokens[1], event.block.timestamp)
      exitAmount1USD = exitAmount1.times(token1Price)
    }
  }
  
  let totalExitUSD = exitAmount0USD.plus(exitAmount1USD)
  
  // Update position with exit data
  activePosition.exitTxHash = event.transaction.hash
  activePosition.exitTimestamp = event.block.timestamp
  activePosition.exitAmount0 = exitAmount0
  activePosition.exitAmount0USD = exitAmount0USD
  activePosition.exitAmount1 = exitAmount1
  activePosition.exitAmount1USD = exitAmount1USD
  activePosition.exitAmountUSD = totalExitUSD
  
  // Mark position as inactive (full withdrawal)
  activePosition.isActive = false
  
  // Update current amounts to zero (position closed)
  activePosition.amount0 = BigDecimal.fromString("0")
  activePosition.amount0USD = BigDecimal.fromString("0")
  activePosition.amount1 = BigDecimal.fromString("0")
  activePosition.amount1USD = BigDecimal.fromString("0")
  activePosition.usdCurrent = BigDecimal.fromString("0")
  activePosition.liquidity = BigInt.fromI32(0)
  
  activePosition.save()
  
  // Refresh portfolio (same as Velodrome pattern)
  refreshPortfolio(liquidityProvider, event.block)
  
  log.info("BALANCER: Updated position {} for agent {} with exit of ${} USD", [
    activePosition.id.toHexString(),
    liquidityProvider.toHexString(),
    totalExitUSD.toString()
  ])
}

// Helper function to find active Balancer position for an agent in a specific pool
function findActiveBalancerPosition(agent: Address, poolAddress: Address): ProtocolPosition | null {
  let service = getServiceByAgent(agent)
  if (service == null) {
    return null
  }
  
  // Iterate through the service's position IDs to find active Balancer positions for this pool
  let positionIds = service.positionIds
  for (let i = 0; i < positionIds.length; i++) {
    let positionId = Bytes.fromUTF8(positionIds[i])
    let position = ProtocolPosition.load(positionId)
    
    if (position != null && 
        position.protocol == "balancer" && 
        position.agent.equals(agent) && 
        position.pool.equals(poolAddress) &&
        position.isActive) {
      return position
    }
  }
  
  return null
}

// Function to update Balancer position values (called during portfolio snapshots)
export function updateBalancerPositionValue(position: ProtocolPosition, blockTimestamp: BigInt): void {
  if (position.protocol != "balancer" || !position.isActive) {
    return
  }
  
  // Get current BPT balance
  let bptShares = position.liquidity
  if (bptShares == null || bptShares.equals(BigInt.fromI32(0))) {
    return
  }
  
  let poolAddress = Address.fromBytes(position.pool)
  let pool = BalancerV2WeightedPool.bind(poolAddress)
  
  // Get total BPT supply
  let totalSupplyResult = pool.try_totalSupply()
  if (totalSupplyResult.reverted) {
    log.warning("BALANCER: Failed to get totalSupply for pool {}", [poolAddress.toHexString()])
    return
  }
  let totalSupply = totalSupplyResult.value
  
  if (totalSupply.equals(BigInt.fromI32(0))) {
    log.warning("BALANCER: Total supply is zero for pool {}", [poolAddress.toHexString()])
    return
  }
  
  // Get pool tokens and balances from vault
  let vault = BalancerV2Vault.bind(BALANCER_VAULT)
  
  // Reconstruct poolId from pool address (reverse of extraction)
  // For now, we'll use a simplified approach and get the poolId from the position
  // In a production system, you might want to store the full poolId in the position
  let poolTokensResult = vault.try_getPoolTokens(Bytes.fromHexString(poolAddress.toHexString()).concat(Bytes.fromHexString("000200000000000000000000000000000000000000000000000000000000")))
  
  // If the above doesn't work, we'll need to store the full poolId in the position
  // For now, let's use a simpler approach with just the stored token information
  
  // Calculate position value using stored token amounts and current prices
  let currentValue0USD = BigDecimal.fromString("0")
  let currentValue1USD = BigDecimal.fromString("0")
  
  // Update token0 value
  if (position.token0 != null) {
    let token0Price = getTokenPriceUSD(Address.fromBytes(position.token0!), blockTimestamp)
    currentValue0USD = position.amount0!.times(token0Price)
  }
  
  // Update token1 value
  if (position.token1 != null) {
    let token1Price = getTokenPriceUSD(Address.fromBytes(position.token1!), blockTimestamp)
    currentValue1USD = position.amount1!.times(token1Price)
  }
  
  let totalCurrentUSD = currentValue0USD.plus(currentValue1USD)
  
  // Update position current values
  position.amount0USD = currentValue0USD
  position.amount1USD = currentValue1USD
  position.usdCurrent = totalCurrentUSD
  
  position.save()
  
  log.debug("BALANCER: Updated position {} value to ${} USD", [
    position.id.toHexString(),
    totalCurrentUSD.toString()
  ])
}

// Helper function to get token decimals from config
function getTokenDecimals(tokenAddress: Address): i32 {
  let config = getTokenConfig(tokenAddress)
  return config != null ? config.decimals : 18 // Default to 18 if unknown
}
