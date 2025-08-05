import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  InstanceCreated,
  InstanceRemoved,
  InstanceStatusChanged,
  OwnerUpdated,
  VerifierUpdated
} from "../generated/StakingFactory/StakingFactory"

export function createInstanceCreatedEvent(
  sender: Address,
  instance: Address,
  implementation: Address
): InstanceCreated {
  let instanceCreatedEvent = changetype<InstanceCreated>(newMockEvent())

  instanceCreatedEvent.parameters = new Array()

  instanceCreatedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  instanceCreatedEvent.parameters.push(
    new ethereum.EventParam("instance", ethereum.Value.fromAddress(instance))
  )
  instanceCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "implementation",
      ethereum.Value.fromAddress(implementation)
    )
  )

  return instanceCreatedEvent
}

export function createInstanceRemovedEvent(instance: Address): InstanceRemoved {
  let instanceRemovedEvent = changetype<InstanceRemoved>(newMockEvent())

  instanceRemovedEvent.parameters = new Array()

  instanceRemovedEvent.parameters.push(
    new ethereum.EventParam("instance", ethereum.Value.fromAddress(instance))
  )

  return instanceRemovedEvent
}

export function createInstanceStatusChangedEvent(
  instance: Address,
  isEnabled: boolean
): InstanceStatusChanged {
  let instanceStatusChangedEvent = changetype<InstanceStatusChanged>(
    newMockEvent()
  )

  instanceStatusChangedEvent.parameters = new Array()

  instanceStatusChangedEvent.parameters.push(
    new ethereum.EventParam("instance", ethereum.Value.fromAddress(instance))
  )
  instanceStatusChangedEvent.parameters.push(
    new ethereum.EventParam("isEnabled", ethereum.Value.fromBoolean(isEnabled))
  )

  return instanceStatusChangedEvent
}

export function createOwnerUpdatedEvent(owner: Address): OwnerUpdated {
  let ownerUpdatedEvent = changetype<OwnerUpdated>(newMockEvent())

  ownerUpdatedEvent.parameters = new Array()

  ownerUpdatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )

  return ownerUpdatedEvent
}

export function createVerifierUpdatedEvent(verifier: Address): VerifierUpdated {
  let verifierUpdatedEvent = changetype<VerifierUpdated>(newMockEvent())

  verifierUpdatedEvent.parameters = new Array()

  verifierUpdatedEvent.parameters.push(
    new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier))
  )

  return verifierUpdatedEvent
}
