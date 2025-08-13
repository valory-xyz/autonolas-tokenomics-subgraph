import { BigDecimal, BigInt, Address, Bytes, log, ethereum } from "@graphprotocol/graph-ts"
import { 
  FundingBalance, 
  AgentPortfolio, 
  AgentPortfolioSnapshot,
  ProtocolPosition,
  Service
} from "../../../../generated/schema"
import { calculateUninvestedValue } from "./tokenBalances"
import { getServiceByAgent } from "./config"

export function updateFunding(
  serviceSafe: Address,
  usd: BigDecimal,
  deposit: boolean,
  ts: BigInt
): void {
  let id = serviceSafe as Bytes
  let fb = FundingBalance.load(id)
  
  if (!fb) {
    fb = new FundingBalance(id)
    fb.service = serviceSafe // Link to Service entity
    fb.totalInUsd = BigDecimal.zero()
    fb.totalOutUsd = BigDecimal.zero()
    fb.netUsd = BigDecimal.zero()
    fb.firstInTimestamp = ts
  }
  
  if (deposit) {
    fb.totalInUsd = fb.totalInUsd.plus(usd)
  } else {
    fb.totalOutUsd = fb.totalOutUsd.plus(usd)
  }
  
  fb.netUsd = fb.totalInUsd.minus(fb.totalOutUsd)
  fb.lastChangeTs = ts
  
  log.info("FUNDING: {} {} USD - Net: {} USD", [
    deposit ? "IN" : "OUT",
    usd.toString(),
    fb.netUsd.toString()
  ])
  
  fb.save()
  
  // Update portfolio after funding change
  let block = new ethereum.Block(
    Bytes.empty(),
    Bytes.empty(),
    Bytes.empty(),
    Address.zero(),
    Bytes.empty(),
    Bytes.empty(),
    Bytes.empty(),
    BigInt.zero(),
    BigInt.zero(),
    BigInt.zero(),
    ts,
    BigInt.zero(),
    BigInt.zero(),
    BigInt.zero(),
    BigInt.zero()
  )
  calculatePortfolioMetrics(serviceSafe, block)
}

// Calculate portfolio metrics for an agent
export function calculatePortfolioMetrics(
  serviceSafe: Address, 
  block: ethereum.Block
): void {
  // Check if this is a valid service
  let service = getServiceByAgent(serviceSafe)
  if (service == null) {
    return
  }
  
  // Load or create AgentPortfolio
  let portfolioId = serviceSafe as Bytes
  let portfolio = AgentPortfolio.load(portfolioId)
  
  if (portfolio == null) {
    portfolio = new AgentPortfolio(portfolioId)
    portfolio.service = serviceSafe
    portfolio.firstTradingTimestamp = BigInt.zero() // Will be set on first position
    portfolio.totalPositions = 0
    portfolio.totalClosedPositions = 0
  }
  
  // 1. Get initial investment from FundingBalance
  let fundingBalance = FundingBalance.load(serviceSafe as Bytes)
  let initialValue = fundingBalance ? fundingBalance.netUsd : BigDecimal.zero()
  
  // 2. Calculate total positions value
  let positionsValue = calculatePositionsValue(serviceSafe)
  
  // 3. Calculate uninvested funds
  let uninvestedValue = calculateUninvestedValue(serviceSafe)
  
  // 4. Calculate total portfolio value (positions + uninvested)
  let finalValue = positionsValue.plus(uninvestedValue)
  
  // 5. Calculate ROI and APR
  let roi = BigDecimal.zero()
  let apr = BigDecimal.zero()
  
  if (initialValue.gt(BigDecimal.zero())) {
    // ROI = (final_value - initial_value) / initial_value * 100
    let profit = finalValue.minus(initialValue)
    roi = profit.div(initialValue).times(BigDecimal.fromString("100"))
    
    // APR calculation - only if we have a first trading timestamp
    if (portfolio.firstTradingTimestamp.gt(BigInt.zero())) {
      let secondsSinceStart = block.timestamp.minus(portfolio.firstTradingTimestamp)
      let daysSinceStart = secondsSinceStart.toBigDecimal().div(BigDecimal.fromString("86400"))
      
      if (daysSinceStart.gt(BigDecimal.zero())) {
        // APR = roi * (365 / days_invested)
        let annualizationFactor = BigDecimal.fromString("365").div(daysSinceStart)
        apr = roi.times(annualizationFactor)
      }
    }
  }
  
  // Update portfolio
  portfolio.finalValue = finalValue
  portfolio.initialValue = initialValue  
  portfolio.positionsValue = positionsValue
  portfolio.uninvestedValue = uninvestedValue
  portfolio.roi = roi
  portfolio.apr = apr
  portfolio.lastUpdated = block.timestamp
  
  // Count positions
  let activeCount = 0
  let closedCount = 0
  
  // Get the service entity for position counting
  let serviceEntity = Service.load(serviceSafe)
  if (serviceEntity != null && serviceEntity.positionIds != null) {
    // Iterate through all position IDs
    let positionIds = serviceEntity.positionIds
    for (let i = 0; i < positionIds.length; i++) {
      // Position IDs are stored as strings, convert to Bytes
      let positionId = Bytes.fromUTF8(positionIds[i])
      let position = ProtocolPosition.load(positionId)
      
      if (position != null) {
        if (position.isActive) {
          activeCount++
        } else {
          closedCount++
        }
      }
    }
  }
  
  portfolio.totalPositions = activeCount
  portfolio.totalClosedPositions = closedCount
  
  portfolio.save()
  
  // Create snapshot
  createPortfolioSnapshot(portfolio, block)
  
  log.info("PORTFOLIO: {} USD (ROI: {}%, positions: {}, uninvested: {})", [
    finalValue.toString(),
    roi.toString(),
    positionsValue.toString(),
    uninvestedValue.toString()
  ])
}

// Calculate total value of all active positions
function calculatePositionsValue(serviceSafe: Address): BigDecimal {
  let totalValue = BigDecimal.zero()
  
  // Get the service entity
  let service = Service.load(serviceSafe)
  if (service == null || service.positionIds == null) {
    return totalValue
  }
  
  // Iterate through all position IDs
  let positionIds = service.positionIds
  
  for (let i = 0; i < positionIds.length; i++) {
    // Position IDs are stored as strings, convert to Bytes
    let positionId = Bytes.fromUTF8(positionIds[i])
    let position = ProtocolPosition.load(positionId)
    
    if (position != null && position.isActive) {
      totalValue = totalValue.plus(position.usdCurrent)
    }
  }
  
  return totalValue
}


// Create a portfolio snapshot
function createPortfolioSnapshot(portfolio: AgentPortfolio, block: ethereum.Block): void {
  let snapshotId = portfolio.id.toHexString() + "-" + block.timestamp.toString()
  let snapshot = new AgentPortfolioSnapshot(Bytes.fromUTF8(snapshotId))
  
  snapshot.service = portfolio.service
  snapshot.portfolio = portfolio.id
  
  // Copy values
  snapshot.finalValue = portfolio.finalValue
  snapshot.initialValue = portfolio.initialValue
  snapshot.positionsValue = portfolio.positionsValue
  snapshot.uninvestedValue = portfolio.uninvestedValue
  
  // Copy performance metrics
  snapshot.roi = portfolio.roi
  snapshot.apr = portfolio.apr
  
  // Metadata
  snapshot.timestamp = block.timestamp
  snapshot.block = block.number
  snapshot.totalPositions = portfolio.totalPositions
  snapshot.totalClosedPositions = portfolio.totalClosedPositions
  
  snapshot.save()
}

// Update first trading timestamp when a position is created
export function updateFirstTradingTimestamp(serviceSafe: Address, timestamp: BigInt): void {
  let portfolio = AgentPortfolio.load(serviceSafe as Bytes)
  if (portfolio != null && portfolio.firstTradingTimestamp.equals(BigInt.zero())) {
    portfolio.firstTradingTimestamp = timestamp
    portfolio.save()
  }
}
