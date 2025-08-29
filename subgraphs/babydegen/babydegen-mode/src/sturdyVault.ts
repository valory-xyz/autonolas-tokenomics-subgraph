import { 
  Address, 
  BigInt, 
  BigDecimal, 
  Bytes, 
  ethereum,
  log
} from "@graphprotocol/graph-ts"

import { 
  ProtocolPosition,
  Service
} from "../../../../generated/schema"

import { 
  calculatePortfolioMetrics,
  updateFirstTradingTimestamp
} from "./helpers"

import { getServiceByAgent } from "./config"
import { getTokenPriceUSD } from "./priceDiscovery"
import { getTokenDecimals } from "./tokenUtils"
import { STURDY_VAULT } from "./constants"

// Import the generated event types
import { Deposit, Withdraw, YearnV3Vault } from "../../../../generated/SturdyVault/YearnV3Vault"
import { ERC20 } from "../../../../generated/SturdyVault/ERC20"

// Helper function to convert token amount to human readable format
function toHumanAmount(amount: BigInt, decimals: i32): BigDecimal {
  if (amount.equals(BigInt.zero())) {
    return BigDecimal.zero()
  }
  
  let divisor = BigInt.fromI32(10).pow(decimals as u8)
  return amount.toBigDecimal().div(divisor.toBigDecimal())
}

// Handle STURDY Yearn V3 Vault deposit events
export function handleSturdyDeposit(event: Deposit): void {
  const sender = event.params.sender
  const owner = event.params.owner
  const assets = event.params.assets
  const shares = event.params.shares
  
  log.info("STURDY DEPOSIT EVENT: sender={}, owner={}, assets={}, shares={}", [
    sender.toHexString(),
    owner.toHexString(),
    assets.toString(),
    shares.toString()
  ])
  
  // Check if the owner is a tracked service
  const service = getServiceByAgent(owner)
  
  if (service != null) {
    log.info("STURDY DEPOSIT: Tracked service {} depositing {} assets", [
      owner.toHexString(),
      assets.toString()
    ])
    
    // Create or update STURDY position
    refreshSturdyPosition(
      owner,
      event.block,
      event.transaction.hash,
      assets,
      true // isDeposit
    )
  }
}

// Handle STURDY Yearn V3 Vault withdraw events
export function handleSturdyWithdraw(event: Withdraw): void {
  const sender = event.params.sender
  const receiver = event.params.receiver
  const owner = event.params.owner
  const assets = event.params.assets
  const shares = event.params.shares
  
  log.info("STURDY WITHDRAW EVENT: sender={}, receiver={}, owner={}, assets={}, shares={}", [
    sender.toHexString(),
    receiver.toHexString(),
    owner.toHexString(),
    assets.toString(),
    shares.toString()
  ])
  
  // Check if the owner is a tracked service (owner is the one withdrawing)
  const service = getServiceByAgent(owner)
  
  if (service != null) {
    log.info("STURDY WITHDRAW: Tracked service {} withdrawing {} assets", [
      owner.toHexString(),
      assets.toString()
    ])
    
    // Update STURDY position
    refreshSturdyPosition(
      owner,
      event.block,
      event.transaction.hash,
      assets,
      false // isDeposit
    )
  }
}

// Create or update STURDY position
function refreshSturdyPosition(
  agent: Address,
  block: ethereum.Block,
  txHash: Bytes,
  assets: BigInt,
  isDeposit: boolean
): void {
  // Position ID format: <agent>-sturdy
  // For STURDY, we use a single position per agent (similar to Velodrome V2 pattern)
  const positionId = agent.toHex() + "-sturdy"
  const positionIdBytes = Bytes.fromUTF8(positionId)
  
  let position = ProtocolPosition.load(positionIdBytes)
  
  // Get vault contract to access underlying asset
  let vaultContract = YearnV3Vault.bind(STURDY_VAULT)
  let underlyingAsset = vaultContract.asset()
  
  if (position == null) {
    // Create new position
    position = new ProtocolPosition(positionIdBytes)
    position.agent = agent
    position.protocol = "STURDY"
    position.pool = STURDY_VAULT
    position.isActive = true
    
    // Initialize amounts
    position.entryAmount0 = BigDecimal.zero()
    position.entryAmount0USD = BigDecimal.zero()
    position.entryAmount1 = BigDecimal.zero()
    position.entryAmount1USD = BigDecimal.zero()
    position.entryAmountUSD = BigDecimal.zero()
    
    position.amount0 = BigDecimal.zero()
    position.amount0USD = BigDecimal.zero()
    position.amount1 = BigDecimal.zero()
    position.amount1USD = BigDecimal.zero()
    position.usdCurrent = BigDecimal.zero()
    
    // Entry tracking
    position.entryTxHash = txHash
    position.entryTimestamp = block.timestamp
    
    // Required fields for schema
    position.tokenId = BigInt.zero() // Not applicable for vault positions
    position.tickLower = 0 // Not applicable for vault positions
    position.tickUpper = 0 // Not applicable for vault positions
    position.liquidity = BigInt.zero() // Store vault shares in liquidity field
    
    // Set token0 as the underlying asset (e.g., WETH), token1 as null
    position.token0 = underlyingAsset
    position.token1 = null
    
    // Add position to service
    let service = Service.load(agent)
    if (service != null) {
      let positionIds = service.positionIds
      if (positionIds == null) {
        positionIds = []
      }
      positionIds.push(positionId)
      service.positionIds = positionIds
      service.save()
    }
    
    // Update first trading timestamp
    updateFirstTradingTimestamp(agent, block.timestamp)
    
    log.info("STURDY: Created new position {} for agent {} with underlying asset {}", [
      positionId,
      agent.toHexString(),
      underlyingAsset.toHexString()
    ])
  }
  
  // Get underlying asset decimals
  let assetContract = ERC20.bind(underlyingAsset)
  let assetDecimals = assetContract.decimals()
  let assetsHuman = toHumanAmount(assets, assetDecimals)
  
  // Get USD price of underlying asset (not vault shares)
  let assetPrice = getTokenPriceUSD(underlyingAsset, block.timestamp, false)
  let assetsUSD = assetPrice.times(assetsHuman)
  
  if (isDeposit) {
    // Handle deposit - increase position
    position.amount0 = position.amount0!.plus(assetsHuman)
    position.amount0USD = position.amount0USD.plus(assetsUSD)
    
    // Update entry amounts if this is the first deposit or position was closed
    if (position.entryAmountUSD.equals(BigDecimal.zero())) {
      position.entryAmount0 = assetsHuman
      position.entryAmount0USD = assetsUSD
      position.entryAmountUSD = assetsUSD
    } else {
      // Add to existing entry amounts
      position.entryAmount0 = position.entryAmount0.plus(assetsHuman)
      position.entryAmount0USD = position.entryAmount0USD.plus(assetsUSD)
      position.entryAmountUSD = position.entryAmountUSD.plus(assetsUSD)
    }
    
    // Ensure position is active
    position.isActive = true
    
    log.info("STURDY DEPOSIT: Added {} {} (${} USD) to position {}", [
      assetsHuman.toString(),
      underlyingAsset.toHexString(),
      assetsUSD.toString(),
      positionId
    ])
  } else {
    // Handle withdraw - decrease position
    position.amount0 = position.amount0!.minus(assetsHuman)
    position.amount0USD = position.amount0USD.minus(assetsUSD)
    
    // Check if position should be closed
    if (position.amount0!.le(BigDecimal.fromString("0.001"))) {
      position.isActive = false
      position.amount0 = BigDecimal.zero()
      position.amount0USD = BigDecimal.zero()
      
      log.info("STURDY WITHDRAW: Closed position {} (remaining balance too small)", [
        positionId
      ])
    } else {
      log.info("STURDY WITHDRAW: Removed {} {} (${} USD) from position {}", [
        assetsHuman.toString(),
        underlyingAsset.toHexString(),
        assetsUSD.toString(),
        positionId
      ])
    }
  }
  
  // Calculate current USD value by getting current vault balance and converting to assets
  let currentUSDValue = calculateSturdyPositionValue(agent, underlyingAsset, block.timestamp)
  position.usdCurrent = currentUSDValue
  position.amount0USD = currentUSDValue // Update current amount0USD to match
  
  position.save()
  
  // Update portfolio metrics
  calculatePortfolioMetrics(agent, block)
  
  log.info("STURDY: Updated position {} - Current: {} {} (${} USD)", [
    positionId,
    position.amount0!.toString(),
    underlyingAsset.toHexString(),
    position.usdCurrent.toString()
  ])
}

// Calculate current USD value of STURDY position
function calculateSturdyPositionValue(agent: Address, underlyingAsset: Address, timestamp: BigInt): BigDecimal {
  let vaultContract = YearnV3Vault.bind(STURDY_VAULT)
  
  // Get agent's vault share balance
  let shareBalance = vaultContract.balanceOf(agent)
  
  if (shareBalance.equals(BigInt.zero())) {
    return BigDecimal.zero()
  }
  
  // Convert shares to underlying assets using convertToAssets
  let underlyingAmount = vaultContract.convertToAssets(shareBalance)
  
  // Get underlying asset decimals and convert to human readable
  let assetContract = ERC20.bind(underlyingAsset)
  let assetDecimals = assetContract.decimals()
  let underlyingHuman = toHumanAmount(underlyingAmount, assetDecimals)
  
  // Get USD price of underlying asset
  let assetPrice = getTokenPriceUSD(underlyingAsset, timestamp, false)
  let usdValue = assetPrice.times(underlyingHuman)
  
  log.info("STURDY VALUE: Agent {} has {} shares = {} {} = ${} USD", [
    agent.toHexString(),
    shareBalance.toString(),
    underlyingHuman.toString(),
    underlyingAsset.toHexString(),
    usdValue.toString()
  ])
  
  return usdValue
}
