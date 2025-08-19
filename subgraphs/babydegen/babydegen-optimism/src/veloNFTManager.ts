import {
  IncreaseLiquidity,
  DecreaseLiquidity,
  Collect,
  Transfer,
  NonfungiblePositionManager
} from "../../../../generated/VeloNFTManager/NonfungiblePositionManager"
import { VELO_NFT_MANAGER, getServiceByAgent } from "./config"
import { ensurePoolTemplate, refreshVeloCLPosition, refreshVeloCLPositionWithEventAmounts, refreshVeloCLPositionWithExitAmounts, handleNFTTransferForCache } from "./veloCLShared"
import { isSafeOwnedNFT } from "./poolIndexCache"
import { log, Address, Bytes } from "@graphprotocol/graph-ts"
import { ProtocolPosition } from "../../../../generated/schema"
import { calculatePortfolioMetrics } from "./helpers"

const MANAGER = VELO_NFT_MANAGER

export function handleNFTTransfer(ev: Transfer): void {
  const toService = getServiceByAgent(ev.params.to)
  const fromService = getServiceByAgent(ev.params.from)

  if (!toService && !fromService) {
    return
  }

  if (toService) {
    ensurePoolTemplate(ev.params.tokenId)
  }
  
  if (fromService) {
    // Mark position as closed when NFT is transferred out
    const positionId = ev.params.from.toHex() + "-" + ev.params.tokenId.toString()
    const id = Bytes.fromUTF8(positionId)
    let position = ProtocolPosition.load(id)
    
    if (position && position.isActive) {
      position.isActive = false
      position.exitTxHash = ev.transaction.hash
      position.exitTimestamp = ev.block.timestamp
      // Keep current amounts as final amounts
      position.exitAmount0 = position.amount0
      position.exitAmount0USD = position.amount0USD
      position.exitAmount1 = position.amount1
      position.exitAmount1USD = position.amount1USD
      position.exitAmountUSD = position.usdCurrent
      
      position.save()
    }
  }
  
  // Update cache
  handleNFTTransferForCache(ev.params.tokenId, ev.params.from, ev.params.to)
  
  refreshVeloCLPosition(ev.params.tokenId, ev.block, ev.transaction.hash)
}

export function handleIncreaseLiquidity(ev: IncreaseLiquidity): void {
  // Get owner early for logging
  let owner = Address.zero()
  const mgr = NonfungiblePositionManager.bind(MANAGER)
  const ownerResult = mgr.try_ownerOf(ev.params.tokenId)
  if (!ownerResult.reverted) {
    owner = ownerResult.value
  }
  
  log.info("VELODROME[{}]: handleIncreaseLiquidity called for tokenId: {}, tx: {}", [
    owner.toHexString(),
    ev.params.tokenId.toString(),
    ev.transaction.hash.toHexString()
  ])
  
  let shouldProcess = false
  
  // PHASE 1 OPTIMIZATION: Use cache instead of ownerOf() RPC call
  const isSafeOwned = isSafeOwnedNFT("velodrome-cl", ev.params.tokenId)
  
  log.info("VELODROME[{}]: isSafeOwned check result: {} for tokenId: {}", [
    owner.toHexString(),
    isSafeOwned.toString(),
    ev.params.tokenId.toString()
  ])
  
  if (isSafeOwned) {
    shouldProcess = true
  } else {
    // FALLBACK: Check actual ownership for positions not in cache (existing positions)
    log.info("VELODROME[{}]: Cache miss for tokenId: {}, checking actual ownership", [
      owner.toHexString(),
      ev.params.tokenId.toString()
    ])
    
    if (!ownerResult.reverted && getServiceByAgent(owner) != null) {
      shouldProcess = true
      log.info("VELODROME[{}]: Actual ownership confirmed for tokenId: {}", [
        owner.toHexString(),
        ev.params.tokenId.toString()
      ])
      
      // Ensure pool template exists and populate cache for future
      ensurePoolTemplate(ev.params.tokenId)
    } else {
      log.info("VELODROME[{}]: Actual ownership check failed for tokenId: {}", [
        owner.toHexString(),
        ev.params.tokenId.toString()
      ])
    }
  }
  
  log.info("VELODROME[{}]: shouldProcess value: {} for tokenId: {}", [
    owner.toHexString(),
    shouldProcess.toString(),
    ev.params.tokenId.toString()
  ])
  
  if (shouldProcess) {
    log.info("VELODROME[{}]: Processing IncreaseLiquidity for tokenId: {}, amount0: {}, amount1: {}", [
      owner.toHexString(),
      ev.params.tokenId.toString(),
      ev.params.amount0.toString(),
      ev.params.amount1.toString()
    ])
    
    // Use event amounts for accurate entry tracking
    refreshVeloCLPositionWithEventAmounts(
      ev.params.tokenId, 
      ev.block, 
      ev.params.amount0,
      ev.params.amount1,
      ev.transaction.hash
    )
    
    log.info("VELODROME[{}]: Completed processing IncreaseLiquidity for tokenId: {}", [
      owner.toHexString(),
      ev.params.tokenId.toString()
    ])
  } else {
    log.info("VELODROME[{}]: Skipping IncreaseLiquidity for tokenId: {} - not owned by safe", [
      owner.toHexString(),
      ev.params.tokenId.toString()
    ])
  }
}

export function handleDecreaseLiquidity(ev: DecreaseLiquidity): void {
  let shouldProcess = false
  
  // 1. Check cache first (fast path)
  const isSafeOwned = isSafeOwnedNFT("velodrome-cl", ev.params.tokenId)
  
  if (isSafeOwned) {
    shouldProcess = true
    
  } else {
    
    // 2. Final fallback: check actual ownership on-chain
    const mgr = NonfungiblePositionManager.bind(MANAGER)
    const ownerResult = mgr.try_ownerOf(ev.params.tokenId)
    
    if (!ownerResult.reverted) {
      const owner = ownerResult.value
      const ownerService = getServiceByAgent(owner)
      
      if (ownerService != null) {
        shouldProcess = true
        
        // Check for existing active position
        const positionId = owner.toHex() + "-" + ev.params.tokenId.toString()
        const id = Bytes.fromUTF8(positionId)
        const position = ProtocolPosition.load(id)
        
        if (position && position.isActive) {
          shouldProcess = true
        }
        
        // Ensure pool template exists and populate cache for future
        ensurePoolTemplate(ev.params.tokenId)
      }
    }
  }
  
  if (shouldProcess) {
    // Use refreshVeloCLPositionWithExitAmounts to handle exit with actual event amounts
    refreshVeloCLPositionWithExitAmounts(
      ev.params.tokenId,
      ev.block,
      ev.params.amount0,  // Actual amount0 from event
      ev.params.amount1,  // Actual amount1 from event
      ev.params.liquidity, // Liquidity being removed
      ev.transaction.hash
    )
  }
}

export function handleCollect(ev: Collect): void {
  // PHASE 1 OPTIMIZATION: Use cache instead of ownerOf() RPC call
  const isSafeOwned = isSafeOwnedNFT("velodrome-cl", ev.params.tokenId)
  
  if (isSafeOwned) {
    // Log fee collection
    log.info("VELODROME CL: Collected fees for tokenId {}: {} token0, {} token1", [
      ev.params.tokenId.toString(),
      ev.params.amount0.toString(),
      ev.params.amount1.toString()
    ])
    
    // Refresh position and trigger portfolio update
    refreshVeloCLPosition(ev.params.tokenId, ev.block, ev.transaction.hash)
    
    // Get the owner to trigger portfolio recalculation
    const mgr = NonfungiblePositionManager.bind(MANAGER)
    const ownerResult = mgr.try_ownerOf(ev.params.tokenId)
    
    if (!ownerResult.reverted) {
      const owner = ownerResult.value
      const ownerService = getServiceByAgent(owner)
      
      if (ownerService != null) {
        // Trigger portfolio recalculation
        calculatePortfolioMetrics(owner, ev.block)
      }
    }
  }
}
