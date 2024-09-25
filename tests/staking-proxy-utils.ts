import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Checkpoint,
  Deposit,
  RewardClaimed,
  ServiceForceUnstaked,
  ServiceInactivityWarning,
  ServiceStaked,
  ServiceUnstaked,
  ServicesEvicted,
  Withdraw
} from "../generated/StakingProxy/StakingProxy"

export function createCheckpointEvent(
  epoch: BigInt,
  availableRewards: BigInt,
  serviceIds: Array<BigInt>,
  rewards: Array<BigInt>,
  epochLength: BigInt
): Checkpoint {
  let checkpointEvent = changetype<Checkpoint>(newMockEvent())

  checkpointEvent.parameters = new Array()

  checkpointEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  checkpointEvent.parameters.push(
    new ethereum.EventParam(
      "availableRewards",
      ethereum.Value.fromUnsignedBigInt(availableRewards)
    )
  )
  checkpointEvent.parameters.push(
    new ethereum.EventParam(
      "serviceIds",
      ethereum.Value.fromUnsignedBigIntArray(serviceIds)
    )
  )
  checkpointEvent.parameters.push(
    new ethereum.EventParam(
      "rewards",
      ethereum.Value.fromUnsignedBigIntArray(rewards)
    )
  )
  checkpointEvent.parameters.push(
    new ethereum.EventParam(
      "epochLength",
      ethereum.Value.fromUnsignedBigInt(epochLength)
    )
  )

  return checkpointEvent
}

export function createDepositEvent(
  sender: Address,
  amount: BigInt,
  balance: BigInt,
  availableRewards: BigInt
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = new Array()

  depositEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "balance",
      ethereum.Value.fromUnsignedBigInt(balance)
    )
  )
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "availableRewards",
      ethereum.Value.fromUnsignedBigInt(availableRewards)
    )
  )

  return depositEvent
}

export function createRewardClaimedEvent(
  epoch: BigInt,
  serviceId: BigInt,
  owner: Address,
  multisig: Address,
  nonces: Array<BigInt>,
  reward: BigInt
): RewardClaimed {
  let rewardClaimedEvent = changetype<RewardClaimed>(newMockEvent())

  rewardClaimedEvent.parameters = new Array()

  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceId",
      ethereum.Value.fromUnsignedBigInt(serviceId)
    )
  )
  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam("multisig", ethereum.Value.fromAddress(multisig))
  )
  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "nonces",
      ethereum.Value.fromUnsignedBigIntArray(nonces)
    )
  )
  rewardClaimedEvent.parameters.push(
    new ethereum.EventParam("reward", ethereum.Value.fromUnsignedBigInt(reward))
  )

  return rewardClaimedEvent
}

export function createServiceForceUnstakedEvent(
  epoch: BigInt,
  serviceId: BigInt,
  owner: Address,
  multisig: Address,
  nonces: Array<BigInt>,
  reward: BigInt,
  availableRewards: BigInt
): ServiceForceUnstaked {
  let serviceForceUnstakedEvent = changetype<ServiceForceUnstaked>(
    newMockEvent()
  )

  serviceForceUnstakedEvent.parameters = new Array()

  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceId",
      ethereum.Value.fromUnsignedBigInt(serviceId)
    )
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam("multisig", ethereum.Value.fromAddress(multisig))
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "nonces",
      ethereum.Value.fromUnsignedBigIntArray(nonces)
    )
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam("reward", ethereum.Value.fromUnsignedBigInt(reward))
  )
  serviceForceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "availableRewards",
      ethereum.Value.fromUnsignedBigInt(availableRewards)
    )
  )

  return serviceForceUnstakedEvent
}

export function createServiceInactivityWarningEvent(
  epoch: BigInt,
  serviceId: BigInt,
  serviceInactivity: BigInt
): ServiceInactivityWarning {
  let serviceInactivityWarningEvent = changetype<ServiceInactivityWarning>(
    newMockEvent()
  )

  serviceInactivityWarningEvent.parameters = new Array()

  serviceInactivityWarningEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  serviceInactivityWarningEvent.parameters.push(
    new ethereum.EventParam(
      "serviceId",
      ethereum.Value.fromUnsignedBigInt(serviceId)
    )
  )
  serviceInactivityWarningEvent.parameters.push(
    new ethereum.EventParam(
      "serviceInactivity",
      ethereum.Value.fromUnsignedBigInt(serviceInactivity)
    )
  )

  return serviceInactivityWarningEvent
}

export function createServiceStakedEvent(
  epoch: BigInt,
  serviceId: BigInt,
  owner: Address,
  multisig: Address,
  nonces: Array<BigInt>
): ServiceStaked {
  let serviceStakedEvent = changetype<ServiceStaked>(newMockEvent())

  serviceStakedEvent.parameters = new Array()

  serviceStakedEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  serviceStakedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceId",
      ethereum.Value.fromUnsignedBigInt(serviceId)
    )
  )
  serviceStakedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  serviceStakedEvent.parameters.push(
    new ethereum.EventParam("multisig", ethereum.Value.fromAddress(multisig))
  )
  serviceStakedEvent.parameters.push(
    new ethereum.EventParam(
      "nonces",
      ethereum.Value.fromUnsignedBigIntArray(nonces)
    )
  )

  return serviceStakedEvent
}

export function createServiceUnstakedEvent(
  epoch: BigInt,
  serviceId: BigInt,
  owner: Address,
  multisig: Address,
  nonces: Array<BigInt>,
  reward: BigInt,
  availableRewards: BigInt
): ServiceUnstaked {
  let serviceUnstakedEvent = changetype<ServiceUnstaked>(newMockEvent())

  serviceUnstakedEvent.parameters = new Array()

  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceId",
      ethereum.Value.fromUnsignedBigInt(serviceId)
    )
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam("multisig", ethereum.Value.fromAddress(multisig))
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "nonces",
      ethereum.Value.fromUnsignedBigIntArray(nonces)
    )
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam("reward", ethereum.Value.fromUnsignedBigInt(reward))
  )
  serviceUnstakedEvent.parameters.push(
    new ethereum.EventParam(
      "availableRewards",
      ethereum.Value.fromUnsignedBigInt(availableRewards)
    )
  )

  return serviceUnstakedEvent
}

export function createServicesEvictedEvent(
  epoch: BigInt,
  serviceIds: Array<BigInt>,
  owners: Array<Address>,
  multisigs: Array<Address>,
  serviceInactivity: Array<BigInt>
): ServicesEvicted {
  let servicesEvictedEvent = changetype<ServicesEvicted>(newMockEvent())

  servicesEvictedEvent.parameters = new Array()

  servicesEvictedEvent.parameters.push(
    new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(epoch))
  )
  servicesEvictedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceIds",
      ethereum.Value.fromUnsignedBigIntArray(serviceIds)
    )
  )
  servicesEvictedEvent.parameters.push(
    new ethereum.EventParam("owners", ethereum.Value.fromAddressArray(owners))
  )
  servicesEvictedEvent.parameters.push(
    new ethereum.EventParam(
      "multisigs",
      ethereum.Value.fromAddressArray(multisigs)
    )
  )
  servicesEvictedEvent.parameters.push(
    new ethereum.EventParam(
      "serviceInactivity",
      ethereum.Value.fromUnsignedBigIntArray(serviceInactivity)
    )
  )

  return servicesEvictedEvent
}

export function createWithdrawEvent(to: Address, amount: BigInt): Withdraw {
  let withdrawEvent = changetype<Withdraw>(newMockEvent())

  withdrawEvent.parameters = new Array()

  withdrawEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return withdrawEvent
}
