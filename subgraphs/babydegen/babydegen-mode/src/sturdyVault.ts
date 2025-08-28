import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Deposit, Withdraw, YearnV3Vault } from "../generated/SturdyYearnVault/YearnV3Vault"
import { ProtocolPosition, Service } from "../generated/schema"
import { getServiceByAgent } from "./config"
import { getTokenPriceUSD } from "./priceDiscovery"
import { refreshPortfolio } from "./common"
import { updateFirstTradingTimestamp } from "./helpers"
import { WETH, STURDY_YEARN_VAULT } from "./constants"

// Handle Deposit events - position entries
export function handleDeposit(event: Deposit): void {
  let sender = event.params.sender
  let owner = event.params.owner
  let assets = event.params.assets
  let shares = event.params.shares
  
  // Check if owner is a service safe
  let service = getServiceByAgent(owner)
  if (service == null) {
    log.debug("STURDY: Deposit owner {} is not a tracked service safe", [owner.toHexString()])
    return
  }

  log.info("STURDY: Processing deposit for service safe: {}, assets: {}, shares: {}", [
    owner.toHexString(),
    assets.toString(),
    shares.toString()
  ])

  // Create position ID: "<serviceSafe>-sturdy-<blockTimestamp>"
  let positionId = owner
    .concat(Bytes.fromUTF8("-sturdy-"))
    .concat(Bytes.fromUTF8(event.block.timestamp.toString()))

  // Create new STURDY position
  let position = new ProtocolPosition(positionId)
  position.agent = owner
  position.service = service.id
  position.protocol = "sturdy"
  position.pool = STURDY_YEARN_VAULT
  
  // Position status
  position.isActive = true
  
  // Token information (WETH)
  position.token0 = WETH
  position.token0Symbol = "WETH"
  position.token1 = null
  position.token1Symbol = null
  
  // Convert WETH assets to USD for entry amounts (production-level calculations)
  let wethPriceUSD = getTokenPriceUSD(WETH, event.block.timestamp)
  let assetsDecimal = assets.toBigDecimal().div(BigDecimal.fromString("1000000000000000000")) // WETH has 18 decimals
  let entryAmountUSD = assetsDecimal.times(wethPriceUSD)
  
  // Entry tracking with proper USD calculations
  position.entryTxHash = event.transaction.hash
  position.entryTimestamp = event.block.timestamp
  position.entryAmount0 = assetsDecimal
  position.entryAmount0USD = entryAmountUSD
  position.entryAmount1 = BigDecimal.fromString("0")
  position.entryAmount1USD = BigDecimal.fromString("0")
  position.entryAmountUSD = entryAmountUSD
  
  // Current state (same as entry initially)
  position.amount0 = assetsDecimal
  position.amount0USD = entryAmountUSD
  position.amount1 = BigDecimal.fromString("0")
  position.amount1USD = BigDecimal.fromString("0")
  position.usdCurrent = entryAmountUSD
  
  // Store vault shares for value calculation
  position.liquidity = shares
  
  // STURDY-specific: no ticks or fees
  position.tickLower = 0
  position.tickUpper = 0
  position.tickSpacing = 0
  position.fee = 0
  position.tokenId = BigInt.fromI32(0) // Not an NFT position
  
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
  updateFirstTradingTimestamp(owner, event.block.timestamp)
  
  position.save()
  
  // Refresh portfolio (same as Velodrome pattern)
  refreshPortfolio(owner, event.block)
  
  log.info("STURDY: Created position {} for agent {} with {} WETH (${} USD)", [
    positionId.toHexString(),
    owner.toHexString(),
    assetsDecimal.toString(),
    entryAmountUSD.toString()
  ])
}

// Handle Withdraw events - position exits
export function handleWithdraw(event: Withdraw): void {
  let sender = event.params.sender
  let receiver = event.params.receiver
  let owner = event.params.owner
  let assets = event.params.assets
  let shares = event.params.shares
  
  // Check if owner is a service safe
  let service = getServiceByAgent(owner)
  if (service == null) {
    log.debug("STURDY: Withdraw owner {} is not a tracked service safe", [owner.toHexString()])
    return
  }

  log.info("STURDY: Processing withdraw for service safe: {}, assets: {}, shares: {}", [
    owner.toHexString(),
    assets.toString(),
    shares.toString()
  ])

  // Find the most recent active STURDY position for this agent
  let activePosition = findMostRecentActiveSturdyPosition(owner)
  
  if (activePosition == null) {
    log.warning("STURDY: No active position found for agent {} during withdraw", [owner.toHexString()])
    return
  }

  // Convert WETH assets to USD for exit amounts (production-level calculations)
  let wethPriceUSD = getTokenPriceUSD(WETH, event.block.timestamp)
  let assetsDecimal = assets.toBigDecimal().div(BigDecimal.fromString("1000000000000000000")) // WETH has 18 decimals
  let exitAmountUSD = assetsDecimal.times(wethPriceUSD)
  
  // Update position with exit data
  activePosition.exitTxHash = event.transaction.hash
  activePosition.exitTimestamp = event.block.timestamp
  activePosition.exitAmount0 = assetsDecimal
  activePosition.exitAmount0USD = exitAmountUSD
  activePosition.exitAmount1 = BigDecimal.fromString("0")
  activePosition.exitAmount1USD = BigDecimal.fromString("0")
  activePosition.exitAmountUSD = exitAmountUSD
  
  // Mark position as inactive
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
  refreshPortfolio(owner, event.block)
  
  log.info("STURDY: Updated position {} for agent {} with exit of {} WETH (${} USD)", [
    activePosition.id.toHexString(),
    owner.toHexString(),
    assetsDecimal.toString(),
    exitAmountUSD.toString()
  ])
}

// Helper function to find the most recent active STURDY position for an agent
function findMostRecentActiveSturdyPosition(agent: Address): ProtocolPosition | null {
  let service = getServiceByAgent(agent)
  if (service == null) {
    return null
  }
  
  // Iterate through the service's position IDs to find active STURDY positions
  let positionIds = service.positionIds
  for (let i = 0; i < positionIds.length; i++) {
    let positionId = Bytes.fromUTF8(positionIds[i])
    let position = ProtocolPosition.load(positionId)
    
    if (position != null && 
        position.protocol == "sturdy" && 
        position.agent.equals(agent) && 
        position.isActive) {
      return position
    }
  }
  
  return null
}

// Function to update STURDY position values (called during portfolio snapshots)
export function updateSturdyPositionValue(position: ProtocolPosition, blockTimestamp: BigInt): void {
  if (position.protocol != "sturdy" || !position.isActive) {
    return
  }
  
  // Get current vault shares
  let shares = position.liquidity
  if (shares == null || shares.equals(BigInt.fromI32(0))) {
    return
  }
  
  // Get current asset value using vault's convertToAssets function
  let vault = YearnV3Vault.bind(STURDY_YEARN_VAULT)
  let assetsResult = vault.try_convertToAssets(shares)
  
  if (assetsResult.reverted) {
    log.warning("STURDY: Failed to get convertToAssets for position {}", [position.id.toHexString()])
    return
  }
  
  let currentAssets = assetsResult.value
  let currentAssetsDecimal = currentAssets.toBigDecimal().div(BigDecimal.fromString("1000000000000000000"))
  
  // Convert to USD
  let wethPriceUSD = getTokenPriceUSD(WETH, blockTimestamp)
  let currentValueUSD = currentAssetsDecimal.times(wethPriceUSD)
  
  // Update position current values
  position.amount0 = currentAssetsDecimal
  position.amount0USD = currentValueUSD
  position.usdCurrent = currentValueUSD
  
  position.save()
  
  log.debug("STURDY: Updated position {} value to {} WETH (${} USD)", [
    position.id.toHexString(),
    currentAssetsDecimal.toString(),
    currentValueUSD.toString()
  ])
}
