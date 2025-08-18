import { Address, BigDecimal, BigInt, ethereum, Bytes, log } from "@graphprotocol/graph-ts"
import { NonfungiblePositionManager } from "../../../../generated/VeloNFTManager/NonfungiblePositionManager"
import { VelodromeCLPool }            from "../../../../generated/templates/VeloCLPool/VelodromeCLPool"
import { VelodromeCLFactory }         from "../../../../generated/VeloNFTManager/VelodromeCLFactory"
import { VeloCLPool }                 from "../../../../generated/templates"
import { LiquidityAmounts }           from "./libraries/LiquidityAmounts"
import { TickMath }                   from "./libraries/TickMath"
import { ProtocolPosition, Service }  from "../../../../generated/schema"
import { getUsd, refreshPortfolio }   from "./common"
import { addAgentNFTToPool, removeAgentNFTFromPool, getCachedPoolAddress, cachePoolAddress } from "./poolIndexCache"
import { getTokenPriceUSD } from "./priceDiscovery"
import { VELO_MANAGER, VELO_FACTORY } from "./constants"
import { isServiceAgent, getServiceByAgent } from "./config"
import { updateFirstTradingTimestamp } from "./helpers"
import { getTokenDecimals, getTokenSymbol } from "./tokenUtils"

// Helper function to convert token amount from wei to human readable
function convertTokenAmount(amount: BigInt, tokenAddress: Address): BigDecimal {
  const decimals = getTokenDecimals(tokenAddress)
  const divisor = BigDecimal.fromString("1e" + decimals.toString())
  return amount.toBigDecimal().div(divisor)
}

// Helper function to derive pool address from position data with caching
function getPoolAddress(token0: Address, token1: Address, tickSpacing: i32, tokenId: BigInt | null = null): Address {
  // Try cache first if we have a tokenId
  if (tokenId !== null) {
    const cached = getCachedPoolAddress("velodrome-cl", tokenId)
    if (cached !== null) {
      log.info("VELODROME: Pool address cache hit for tokenId: {} - pool: {}", [
        tokenId.toString(),
        cached.toHexString()
      ])
      return cached
    }
  }
  
  // Log the parameters we're using for the factory call
  log.info("VELODROME: Attempting factory.getPool with token0: {}, token1: {}, tickSpacing: {}", [
    token0.toHexString(),
    token1.toHexString(),
    tickSpacing.toString()
  ])
  
  // Factory call as last resort
  const factory = VelodromeCLFactory.bind(VELO_FACTORY)
  const poolResult = factory.try_getPool(token0, token1, tickSpacing)
  
  if (poolResult.reverted) {
    log.error("VELODROME: Factory getPool REVERTED for token0: {}, token1: {}, tickSpacing: {} - Factory address: {}", [
      token0.toHexString(),
      token1.toHexString(),
      tickSpacing.toString(),
      VELO_FACTORY.toHexString()
    ])
    
    // Try with reversed token order
    log.info("VELODROME: Trying with reversed token order", [])
    const reversedResult = factory.try_getPool(token1, token0, tickSpacing)
    
    if (reversedResult.reverted) {
      log.error("VELODROME: Factory getPool ALSO REVERTED with reversed tokens", [])
      return Address.zero()
    }
    
    const poolAddress = reversedResult.value
    log.info("VELODROME: Successfully got pool with REVERSED tokens: {}", [poolAddress.toHexString()])
    
    // Cache the result if we have a tokenId
    if (tokenId !== null) {
      cachePoolAddress("velodrome-cl", tokenId, poolAddress)
    }
    
    return poolAddress
  }
  
  const poolAddress = poolResult.value
  log.info("VELODROME: Successfully got pool address from factory: {}", [poolAddress.toHexString()])
  
  // Cache the result if we have a tokenId
  if (tokenId !== null) {
    cachePoolAddress("velodrome-cl", tokenId, poolAddress)
  }
  
  return poolAddress
}

// 1.  Spawn pool template the first time we meet an NFT
export function ensurePoolTemplate(tokenId: BigInt): void {
  const mgr = NonfungiblePositionManager.bind(VELO_MANAGER)
  const posResult = mgr.try_positions(tokenId)
  
  if (posResult.reverted) {
    log.error("VELODROME: Failed to get position data for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const pos = posResult.value
  
  // Derive pool address from position data with caching
  const poolAddress = getPoolAddress(pos.value2, pos.value3, pos.value4 as i32, tokenId)
  
  if (poolAddress.equals(Address.zero())) {
    log.error("VELODROME: Failed to derive pool address for tokenId: {}", [tokenId.toString()])
    return
  }
  
  VeloCLPool.create(poolAddress)
  addAgentNFTToPool("velodrome-cl", poolAddress, tokenId)
}

// Helper function to check if position is closed
function isPositionClosed(liquidity: BigInt, amount0: BigDecimal, amount1: BigDecimal): boolean {
  const isLiquidityZero = liquidity.equals(BigInt.zero())
  const areAmountsZero = amount0.equals(BigDecimal.zero()) && amount1.equals(BigDecimal.zero())
    
  return isLiquidityZero || areAmountsZero
}

// 2a. Re-price NFT into USD + persist using actual event amounts for entry data
export function refreshVeloCLPositionWithEventAmounts(
  tokenId: BigInt, 
  block: ethereum.Block, 
  eventAmount0: BigInt,
  eventAmount1: BigInt,
  txHash: Bytes = Bytes.empty()
): void {
  const mgr = NonfungiblePositionManager.bind(VELO_MANAGER)
  
  // First, get the actual NFT owner
  const ownerResult = mgr.try_ownerOf(tokenId)
  if (ownerResult.reverted) {
    log.error("VELODROME[unknown]: Failed to get owner for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const nftOwner = ownerResult.value
  
  log.info("VELODROME[{}]: refreshVeloCLPositionWithEventAmounts ENTRY - tokenId: {}, eventAmount0: {}, eventAmount1: {}, tx: {}", [
    nftOwner.toHexString(),
    tokenId.toString(),
    eventAmount0.toString(),
    eventAmount1.toString(),
    txHash.toHexString()
  ])

  // AGENT FILTERING: Only process positions owned by a service
  if (!isServiceAgent(nftOwner)) {
    log.info("VELODROME[{}]: Skipping position {} - not owned by a service", [
      nftOwner.toHexString(),
      tokenId.toString()
    ])
    return
  }
  
  log.info("VELODROME[{}]: Agent validation passed for tokenId: {}", [
    nftOwner.toHexString(),
    tokenId.toString()
  ])

  log.info("VELODROME[{}]: Getting position data for tokenId: {}", [
    nftOwner.toHexString(),
    tokenId.toString()
  ])

  const dataResult = mgr.try_positions(tokenId)
  
  if (dataResult.reverted) {
    log.error("VELODROME[{}]: positions() call FAILED for tokenId: {}", [
      nftOwner.toHexString(),
      tokenId.toString()
    ])
    return
  }

  log.info("VELODROME[{}]: Got position data successfully for tokenId: {}", [
    nftOwner.toHexString(),
    tokenId.toString()
  ])
  
  const data = dataResult.value

  log.info("VELODROME[{}]: Getting pool address for tokenId: {}", [
    nftOwner.toHexString(),
    tokenId.toString()
  ])

  // Derive pool address from position data with caching  
  const poolAddress = getPoolAddress(data.value2, data.value3, data.value4 as i32, tokenId)
  
  if (poolAddress.equals(Address.zero())) {
    log.error("VELODROME[{}]: Failed to derive pool address for tokenId: {}", [
      nftOwner.toHexString(),
      tokenId.toString()
    ])
    return
  }

  log.info("VELODROME[{}]: Got pool address {} for tokenId: {}", [
    nftOwner.toHexString(),
    poolAddress.toHexString(),
    tokenId.toString()
  ])

  // USD pricing for event amounts
  log.info("VELODROME[{}]: Getting token prices for tokenId: {}", [
    nftOwner.toHexString(),
    tokenId.toString()
  ])
  
  const token0Price = getTokenPriceUSD(data.value2, block.timestamp, false)
  const token1Price = getTokenPriceUSD(data.value3, block.timestamp, false)
  
  log.info("VELODROME[{}]: Token prices - token0: {}, token1: {} for tokenId: {}", [
    nftOwner.toHexString(),
    token0Price.toString(),
    token1Price.toString(),
    tokenId.toString()
  ])

  // Convert event amounts from wei to human readable using proper decimals
  const eventAmount0Human = convertTokenAmount(eventAmount0, data.value2) // token0
  const eventAmount1Human = convertTokenAmount(eventAmount1, data.value3) // token1
  
  // Log the actual event amounts with transaction hash
  log.info("VELODROME[{}]: Position {} event amounts from tx {} - amount0: {} ({}), amount1: {} ({})", [
    nftOwner.toHexString(),
    tokenId.toString(),
    txHash.toHexString(),
    eventAmount0.toString(),
    eventAmount0Human.toString(),
    eventAmount1.toString(), 
    eventAmount1Human.toString()
  ])
  
  const eventUsd0 = eventAmount0Human.times(token0Price)
  const eventUsd1 = eventAmount1Human.times(token1Price)
  const eventUsd = eventUsd0.plus(eventUsd1)

  // write ProtocolPosition - use actual NFT owner and event amounts for entry
  const idString = nftOwner.toHex() + "-" + tokenId.toString()
  const id = Bytes.fromUTF8(idString)
  let pp = ProtocolPosition.load(id)
  const isNewPosition = pp == null
  
  if (pp == null) {
    pp = new ProtocolPosition(id)
    pp.agent = nftOwner
    pp.service = nftOwner // Link to service
    pp.protocol = "velodrome-cl"
    pp.pool = poolAddress
    pp.tokenId = tokenId
    pp.isActive = true
    
    // Update service positionIds array
    let service = Service.load(nftOwner)
    if (service != null) {
      if (service.positionIds == null) {
        service.positionIds = []
      }
      let positionIds = service.positionIds
      positionIds.push(idString)
      service.positionIds = positionIds
      service.save()
      
      // Update first trading timestamp
      updateFirstTradingTimestamp(nftOwner, block.timestamp)
    }
    
    // Set static position metadata
    pp.tickLower = data.value5 as i32
    pp.tickUpper = data.value6 as i32
    pp.tickSpacing = data.value4
    
    // Set entry data using ACTUAL EVENT AMOUNTS (not calculated)
    pp.entryTxHash = txHash
    pp.entryTimestamp = block.timestamp
    pp.entryAmount0 = eventAmount0Human  // Use actual event amount
    pp.entryAmount0USD = eventUsd0       // Use actual event amount
    pp.entryAmount1 = eventAmount1Human  // Use actual event amount
    pp.entryAmount1USD = eventUsd1       // Use actual event amount
    pp.entryAmountUSD = eventUsd
    
    // DEBUG: Log what we're setting as entry amounts
    log.info("VELODROME[{}]: Position {} ENTRY AMOUNTS BEING SET - entryAmount0: {}, entryAmount1: {}, entryAmountUSD: {}", [
      nftOwner.toHexString(),
      tokenId.toString(),
      pp.entryAmount0.toString(),
      pp.entryAmount1.toString(),
      pp.entryAmountUSD.toString()
    ])
    
    // For new positions, calculate current amounts using liquidity math (not event amounts)
    // Call refreshVeloCLPosition to get current calculated amounts
    pp.save() // Save entry data first
    refreshVeloCLPosition(tokenId, block, txHash) // This will update current amounts
    return // Exit early since refreshVeloCLPosition will save the entity
  } else {
    // DEBUG: Log the BEFORE values to track accumulation
    log.info("VELODROME[{}]: Position {} BEFORE UPDATE - entryAmount0: {}, entryAmount1: {}, entryAmountUSD: {}", [
      nftOwner.toHexString(),
      tokenId.toString(),
      pp.entryAmount0.toString(),
      pp.entryAmount1.toString(),
      pp.entryAmountUSD.toString()
    ])
    
    // CRITICAL FIX: Check if this is the first IncreaseLiquidity event for this position
    // The first IncreaseLiquidity event after position creation should set entry amounts
    // Subsequent IncreaseLiquidity events should add to existing entry amounts
    if (pp.entryAmountUSD.equals(BigDecimal.zero()) && pp.entryTimestamp.equals(BigInt.zero())) {
      // This is the FIRST IncreaseLiquidity event for a new position - set initial entry amounts
      pp.entryTxHash = txHash
      pp.entryTimestamp = block.timestamp
      pp.entryAmount0 = eventAmount0Human
      pp.entryAmount0USD = eventUsd0
      pp.entryAmount1 = eventAmount1Human
      pp.entryAmount1USD = eventUsd1
      pp.entryAmountUSD = eventUsd
      
      log.info("VELODROME[{}]: Position {} INITIAL ENTRY SET - entryAmount0: {}, entryAmount1: {}, entryAmountUSD: {}", [
        nftOwner.toHexString(),
        tokenId.toString(),
        pp.entryAmount0.toString(),
        pp.entryAmount1.toString(),
        pp.entryAmountUSD.toString()
      ])
    } else {
      // This is a subsequent IncreaseLiquidity event - add to existing entry amounts
      pp.entryAmount0 = pp.entryAmount0.plus(eventAmount0Human)
      pp.entryAmount0USD = pp.entryAmount0USD.plus(eventUsd0)
      pp.entryAmount1 = pp.entryAmount1.plus(eventAmount1Human)
      pp.entryAmount1USD = pp.entryAmount1USD.plus(eventUsd1)
      pp.entryAmountUSD = pp.entryAmountUSD.plus(eventUsd)
      
      log.info("VELODROME[{}]: Position {} ENTRY INCREASED - entryAmount0: {}, entryAmount1: {}, entryAmountUSD: {}", [
        nftOwner.toHexString(),
        tokenId.toString(),
        pp.entryAmount0.toString(),
        pp.entryAmount1.toString(),
        pp.entryAmountUSD.toString()
      ])
    }
    
    // Save the updated entry amounts first
    pp.save()
    
    // Update current amounts by calling the regular refresh function
    refreshVeloCLPosition(tokenId, block, txHash)
    return // Exit early since refreshVeloCLPosition will save the entity
  }
}

// 2b. Handle position exit with actual event amounts
export function refreshVeloCLPositionWithExitAmounts(
  tokenId: BigInt, 
  block: ethereum.Block, 
  eventAmount0: BigInt,
  eventAmount1: BigInt,
  liquidityRemoved: BigInt,
  txHash: Bytes = Bytes.empty()
): void {
  const mgr = NonfungiblePositionManager.bind(VELO_MANAGER)
  
  // First, get the actual NFT owner
  const ownerResult = mgr.try_ownerOf(tokenId)
  if (ownerResult.reverted) {
    log.error("VELODROME: Failed to get owner for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const nftOwner = ownerResult.value

  // AGENT FILTERING: Only process positions owned by a service
  if (!isServiceAgent(nftOwner)) {
    log.info("VELODROME: Skipping position {} - not owned by a service (owner: {})", [
      tokenId.toString(),
      nftOwner.toHexString()
    ])
    return
  }

  const dataResult = mgr.try_positions(tokenId)
  
  if (dataResult.reverted) {
    log.error("VELODROME: positions() call failed for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const data = dataResult.value
  
  // Load existing position
  const idString = nftOwner.toHex() + "-" + tokenId.toString()
  const id = Bytes.fromUTF8(idString)
  let pp = ProtocolPosition.load(id)
  
  if (pp == null) {
    log.error("VELODROME: Position {} not found for exit processing", [tokenId.toString()])
    return
  }
  
  // Check if this is a full exit (all liquidity removed)
  const remainingLiquidity = data.value7
  const isFullExit = remainingLiquidity.equals(BigInt.zero())
  
  if (isFullExit) {
    log.info("VELODROME: Processing FULL EXIT for position {} - using event amounts", [tokenId.toString()])
    
    // USD pricing for exit amounts
    const token0Price = getTokenPriceUSD(data.value2, block.timestamp, false)
    const token1Price = getTokenPriceUSD(data.value3, block.timestamp, false)
    
    // Convert exit amounts from wei to human readable
    const exitAmount0Human = convertTokenAmount(eventAmount0, data.value2)
    const exitAmount1Human = convertTokenAmount(eventAmount1, data.value3)
    
    const exitUsd0 = exitAmount0Human.times(token0Price)
    const exitUsd1 = exitAmount1Human.times(token1Price)
    const exitUsd = exitUsd0.plus(exitUsd1)
    
    // Set exit data using ACTUAL EVENT AMOUNTS
    pp.isActive = false
    pp.exitTxHash = txHash
    pp.exitTimestamp = block.timestamp
    pp.exitAmount0 = exitAmount0Human
    pp.exitAmount0USD = exitUsd0
    pp.exitAmount1 = exitAmount1Human
    pp.exitAmount1USD = exitUsd1
    pp.exitAmountUSD = exitUsd
    
    // Update current amounts to 0 (since position is closed)
    pp.amount0 = BigDecimal.zero()
    pp.amount1 = BigDecimal.zero()
    pp.amount0USD = BigDecimal.zero()
    pp.amount1USD = BigDecimal.zero()
    pp.usdCurrent = BigDecimal.zero()
    pp.liquidity = BigInt.zero()
    
    log.info("VELODROME: Position {} EXIT AMOUNTS SET - exitAmount0: {}, exitAmount1: {}, exitAmountUSD: {}", [
      tokenId.toString(),
      exitAmount0Human.toString(),
      exitAmount1Human.toString(),
      exitUsd.toString()
    ])
    
    // Remove from cache
    const poolAddress = getPoolAddress(data.value2, data.value3, data.value4 as i32, tokenId)
    removeAgentNFTFromPool("velodrome-cl", poolAddress, tokenId)
    
    pp.save()
    refreshPortfolio(nftOwner, block)
  } else {
    // Partial withdrawal - just update current amounts normally
    log.info("VELODROME: Processing partial withdrawal for position {}", [tokenId.toString()])
    refreshVeloCLPosition(tokenId, block, txHash)
  }
}

// 2c. Re-price NFT into USD + persist (for non-entry events)
export function refreshVeloCLPosition(tokenId: BigInt, block: ethereum.Block, txHash: Bytes = Bytes.empty()): void {
  const mgr = NonfungiblePositionManager.bind(VELO_MANAGER)
  
  // First, get the actual NFT owner
  const ownerResult = mgr.try_ownerOf(tokenId)
  if (ownerResult.reverted) {
    log.error("VELODROME: Failed to get owner for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const nftOwner = ownerResult.value

  // AGENT FILTERING: Only process positions owned by a service
  if (!isServiceAgent(nftOwner)) {
    log.info("VELODROME: Skipping position {} - not owned by a service (owner: {})", [
      tokenId.toString(),
      nftOwner.toHexString()
    ])
    return
  }

  // Early check - don't process closed positions
  const idString = nftOwner.toHex() + "-" + tokenId.toString()
  const id = Bytes.fromUTF8(idString)
  let position = ProtocolPosition.load(id)
  
  if (position && !position.isActive) {
    return
  }
  
  const dataResult = mgr.try_positions(tokenId)
  
  if (dataResult.reverted) {
    log.error("VELODROME: positions() call failed for tokenId: {}", [tokenId.toString()])
    return
  }
  
  const data = dataResult.value

  // Derive pool address from position data with caching
  const poolAddress = getPoolAddress(data.value2, data.value3, data.value4 as i32, tokenId)
  
  if (poolAddress.equals(Address.zero())) {
    log.error("VELODROME: Failed to derive pool address for tokenId: {}", [tokenId.toString()])
    return
  }
  
  // pool state
  const pool  = VelodromeCLPool.bind(poolAddress)
  const slot0Result = pool.try_slot0()
  
  if (slot0Result.reverted) {
    log.error("VELODROME: Failed to get slot0 from pool: {}", [poolAddress.toHexString()])
    return
  }
  
  const slot0 = slot0Result.value

  // convert liquidity → token amounts
  const tickLower = data.value5 as i32
  const tickUpper = data.value6 as i32
  
  const sqrtPa  = TickMath.getSqrtRatioAtTick(tickLower)
  const sqrtPb  = TickMath.getSqrtRatioAtTick(tickUpper)
  
  const amounts = LiquidityAmounts.getAmountsForLiquidity(
                    slot0.value0, sqrtPa, sqrtPb, data.value7)

  // USD pricing - NEW HARDCODED VERSION
  const token0Price = getTokenPriceUSD(data.value2, block.timestamp, false) // token0
  const token1Price = getTokenPriceUSD(data.value3, block.timestamp, false) // token1

  // Convert amounts from wei to human readable using proper decimals
  const amount0Human = convertTokenAmount(amounts.amount0, data.value2) // token0
  const amount1Human = convertTokenAmount(amounts.amount1, data.value3) // token1
  
  // Add debugging logs to track the conversion
  log.info("VELODROME: Position {} amounts - token0: {} ({}), token1: {} ({})", [
    tokenId.toString(),
    amounts.amount0.toString(),
    amount0Human.toString(),
    amounts.amount1.toString(), 
    amount1Human.toString()
  ])
  
  const usd0 = amount0Human.times(token0Price)
  const usd1 = amount1Human.times(token1Price)
  const usd  = usd0.plus(usd1)

  // write ProtocolPosition - use actual NFT owner, not position data owner
  let pp = ProtocolPosition.load(id)
  const isNewPosition = pp == null
  
  if (pp == null) {
    pp = new ProtocolPosition(id)
    pp.agent    = nftOwner
    pp.service  = nftOwner // Link to service
    pp.protocol = "velodrome-cl"
    pp.pool     = poolAddress
    pp.tokenId  = tokenId
    pp.isActive = true
    
    // Update service positionIds array
    let service = Service.load(nftOwner)
    if (service != null) {
      if (service.positionIds == null) {
        service.positionIds = []
      }
      let positionIds = service.positionIds
      positionIds.push(idString)
      service.positionIds = positionIds
      service.save()
      
      // Update first trading timestamp
      updateFirstTradingTimestamp(nftOwner, block.timestamp)
    }
    
    // Set static position metadata (required fields)
    pp.tickLower = tickLower
    pp.tickUpper = tickUpper
    pp.tickSpacing = data.value4
    
    // CRITICAL FIX: Initialize entry data for new positions
    // Entry amounts will be set by refreshVeloCLPositionWithEventAmounts
    // But we need to capture the initial transaction data
    pp.entryTxHash = txHash
    pp.entryTimestamp = block.timestamp
    pp.entryAmount0 = BigDecimal.zero()
    pp.entryAmount0USD = BigDecimal.zero()
    pp.entryAmount1 = BigDecimal.zero()
    pp.entryAmount1USD = BigDecimal.zero()
    pp.entryAmountUSD = BigDecimal.zero()
    
    log.info("VELODROME: Position {} created with ZERO entry amounts - will be set by event processing", [
      tokenId.toString()
    ])
  }
  
  // Update current state (for both new and existing positions)
  pp.usdCurrent = usd
  pp.token0     = data.value2
  pp.token0Symbol = getTokenSymbol(data.value2)
  pp.amount0    = amount0Human
  pp.amount0USD = usd0
  pp.token1     = data.value3
  pp.token1Symbol = getTokenSymbol(data.value3)
  pp.amount1    = amount1Human
  pp.amount1USD = usd1
  pp.liquidity  = data.value7
  
  // Check if position should be closed
  if (isPositionClosed(data.value7, amount0Human, amount1Human)) {
    pp.isActive = false
    pp.exitTxHash = txHash
    pp.exitTimestamp = block.timestamp
    pp.exitAmount0 = amount0Human
    pp.exitAmount0USD = usd0
    pp.exitAmount1 = amount1Human
    pp.exitAmount1USD = usd1
    pp.exitAmountUSD = usd
    
    // Remove from cache to prevent future swap updates
    removeAgentNFTFromPool("velodrome-cl", poolAddress, tokenId)
  }
  
  pp.save()

  // bubble up to AgentPortfolio
  refreshPortfolio(nftOwner, block)
}

// 3. Handle NFT transfers (add/remove from cache)
export function handleNFTTransferForCache(tokenId: BigInt, from: Address, to: Address): void {
  const mgr = NonfungiblePositionManager.bind(VELO_MANAGER)
  const posResult = mgr.try_positions(tokenId)
  
  if (posResult.reverted) {
    log.error("VELODROME: Failed to get position data for tokenId: {} in handleNFTTransferForCache", [tokenId.toString()])
    return
  }
  
  const pos = posResult.value
  
  // Derive pool address from position data with caching
  const poolAddress = getPoolAddress(pos.value2, pos.value3, pos.value4 as i32, tokenId)
  
  if (poolAddress.equals(Address.zero())) {
    log.error("VELODROME: Failed to derive pool address for tokenId: {} in handleNFTTransferForCache", [tokenId.toString()])
    return
  }
  
  // Remove from cache if transferring out
  if (!from.equals(Address.zero())) {
    removeAgentNFTFromPool("velodrome-cl", poolAddress, tokenId)
  }
  
  // Add to cache if transferring in
  if (!to.equals(Address.zero())) {
    addAgentNFTToPool("velodrome-cl", poolAddress, tokenId)
  }
}
