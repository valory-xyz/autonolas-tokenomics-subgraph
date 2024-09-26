import { Address, Bytes, BigInt } from "@graphprotocol/graph-ts"
import {
  Checkpoint as CheckpointEvent,
  Deposit as DepositEvent,
  RewardClaimed as RewardClaimedEvent,
  ServiceForceUnstaked as ServiceForceUnstakedEvent,
  ServiceInactivityWarning as ServiceInactivityWarningEvent,
  ServiceStaked as ServiceStakedEvent,
  ServiceUnstaked as ServiceUnstakedEvent,
  ServicesEvicted as ServicesEvictedEvent,
  Withdraw as WithdrawEvent,
} from "../generated/StakingProxy/StakingProxy"
import {
  Checkpoint,
  Deposit,
  RewardClaimed,
  ServiceForceUnstaked,
  ServiceInactivityWarning,
  ServiceStaked,
  ServiceUnstaked,
  ServicesEvicted,
  Withdraw,
  InstanceCreated
} from "../generated/schema"

export function handleCheckpoint(event: CheckpointEvent): void {
  let entity = new Checkpoint(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.availableRewards = event.params.availableRewards
  entity.serviceIds = event.params.serviceIds
  entity.rewards = event.params.rewards
  entity.epochLength = event.params.epochLength

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // Calculate epochStartTime
  if (event.params.epoch.equals(BigInt.fromI32(0))) {
    entity.epochStartTime = event.block.timestamp.minus(BigInt.fromI32(86400));
    // TODO: Liveness period from contract
  } else {
    let currentEpoch = event.params.epoch
    let previousEpochId = currentEpoch.minus(BigInt.fromI32(1))
    let previousEpoch = Checkpoint.load(Bytes.fromHexString(previousEpochId.toString()))

    entity.epochStartTime =
      previousEpoch === null ? BigInt.fromI32(0) : previousEpoch.blockTimestamp;
  }

  entity.save()
}

export function handleDeposit(event: DepositEvent): void {
  let entity = new Deposit(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.sender = event.params.sender
  entity.amount = event.params.amount
  entity.balance = event.params.balance
  entity.availableRewards = event.params.availableRewards

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  let entity = new RewardClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.serviceId = event.params.serviceId
  entity.owner = event.params.owner
  entity.multisig = event.params.multisig
  entity.nonces = event.params.nonces
  entity.reward = event.params.reward

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleServiceForceUnstaked(
  event: ServiceForceUnstakedEvent,
): void {
  let entity = new ServiceForceUnstaked(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.serviceId = event.params.serviceId
  entity.owner = event.params.owner
  entity.multisig = event.params.multisig
  entity.nonces = event.params.nonces
  entity.reward = event.params.reward
  entity.availableRewards = event.params.availableRewards

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleServiceInactivityWarning(
  event: ServiceInactivityWarningEvent,
): void {
  let entity = new ServiceInactivityWarning(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.serviceId = event.params.serviceId
  entity.serviceInactivity = event.params.serviceInactivity

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleServiceStaked(event: ServiceStakedEvent): void {
  let entity = new ServiceStaked(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.serviceId = event.params.serviceId
  entity.owner = event.params.owner
  entity.multisig = event.params.multisig
  entity.nonces = event.params.nonces

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleServiceUnstaked(event: ServiceUnstakedEvent): void {
  let entity = new ServiceUnstaked(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.epoch = event.params.epoch
  entity.serviceId = event.params.serviceId
  entity.owner = event.params.owner
  entity.multisig = event.params.multisig
  entity.nonces = event.params.nonces
  entity.reward = event.params.reward
  entity.availableRewards = event.params.availableRewards

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleServicesEvicted(event: ServicesEvictedEvent): void {
  let entity = new ServicesEvicted(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )

  let owners: Bytes[] = event.params.owners.map<Bytes>(
    (owner: Address): Bytes => owner as Bytes
  );
  let multisigs: Bytes[] = event.params.multisigs.map<Bytes>(
    (multisig: Address): Bytes => multisig as Bytes
  );

  entity.epoch = event.params.epoch
  entity.serviceIds = event.params.serviceIds 
  entity.owners = owners
  entity.multisigs = multisigs
  entity.serviceInactivity = event.params.serviceInactivity

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
  let entity = new Withdraw(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.to = event.params.to
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
