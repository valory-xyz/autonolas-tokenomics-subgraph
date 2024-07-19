import {
  IncentivesClaimed as IncentivesClaimedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  TokenomicsUpdated as TokenomicsUpdatedEvent,
  TreasuryUpdated as TreasuryUpdatedEvent,
} from "../generated/Dispenser/Dispenser"
import {
  IncentivesClaimed,
  OwnerUpdated,
  TokenomicsUpdated,
  TreasuryUpdated,
} from "../generated/schema"

export function handleIncentivesClaimed(event: IncentivesClaimedEvent): void {
  let entity = new IncentivesClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.owner = event.params.owner
  entity.reward = event.params.reward
  entity.topUp = event.params.topUp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnerUpdated(event: OwnerUpdatedEvent): void {
  let entity = new OwnerUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.owner = event.params.owner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTokenomicsUpdated(event: TokenomicsUpdatedEvent): void {
  let entity = new TokenomicsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.tokenomics = event.params.tokenomics

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTreasuryUpdated(event: TreasuryUpdatedEvent): void {
  let entity = new TreasuryUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.treasury = event.params.treasury

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
