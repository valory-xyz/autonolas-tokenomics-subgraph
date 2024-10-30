import {
  InstanceCreated as InstanceCreatedEvent,
  InstanceRemoved as InstanceRemovedEvent,
  InstanceStatusChanged as InstanceStatusChangedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  VerifierUpdated as VerifierUpdatedEvent
} from "../generated/StakingFactory/StakingFactory"
import {
  InstanceCreated,
  InstanceRemoved,
  InstanceStatusChanged,
  OwnerUpdated,
  VerifierUpdated
} from "../generated/schema"
import { StakingProxy } from "../generated/templates";

export function handleInstanceCreated(event: InstanceCreatedEvent): void {

  StakingProxy.create(event.params.instance);

  let entity = new InstanceCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sender = event.params.sender
  entity.instance = event.params.instance
  entity.implementation = event.params.implementation

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

}

export function handleInstanceRemoved(event: InstanceRemovedEvent): void {
  let entity = new InstanceRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.instance = event.params.instance

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
  
}

export function handleInstanceStatusChanged(
  event: InstanceStatusChangedEvent
): void {
  let entity = new InstanceStatusChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.instance = event.params.instance
  entity.isEnabled = event.params.isEnabled

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnerUpdated(event: OwnerUpdatedEvent): void {
  let entity = new OwnerUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.owner = event.params.owner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVerifierUpdated(event: VerifierUpdatedEvent): void {
  let entity = new VerifierUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.verifier = event.params.verifier

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}