import { BigInt } from "@graphprotocol/graph-ts";
import {
  IncentivesClaimed as IncentivesClaimedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  TokenomicsUpdated as TokenomicsUpdatedEvent,
  TreasuryUpdated as TreasuryUpdatedEvent,
} from "../generated/Dispenser/Dispenser";
import {
  DevIncentive,
  Epoch,
  IncentivesClaimed,
  OwnerUpdated,
  TokenomicsUpdated,
  TreasuryUpdated,
} from "../generated/schema";
import { FindEpochMapper, findEpochId } from "./mappings";

export function handleIncentivesClaimed(event: IncentivesClaimedEvent): void {
  let entity = new IncentivesClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.owner = event.params.owner;
  entity.reward = event.params.reward;
  entity.topUp = event.params.topUp;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update Epoch entity with devIncentive
  const findEpochParams = new FindEpochMapper(event.block.number);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    const epoch = Epoch.load(currentEpochId);

    if (epoch) {
      let devIncentive = new DevIncentive(event.transaction.hash.toHex());
      devIncentive.epoch = epoch.id;
      devIncentive.owner = event.params.owner;
      devIncentive.reward = event.params.reward;
      devIncentive.topUp = event.params.topUp;
      devIncentive.save();

      // Update the total dev incentives topUp in the epoch
      if (!epoch.devIncentivesTotalTopUp) {
        epoch.devIncentivesTotalTopUp = event.params.topUp;
      } else {
        epoch.devIncentivesTotalTopUp = epoch.devIncentivesTotalTopUp!.plus(
          event.params.topUp
        );
      }

      epoch.save();
    }
  }
}

export function handleOwnerUpdated(event: OwnerUpdatedEvent): void {
  let entity = new OwnerUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.owner = event.params.owner;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleTokenomicsUpdated(event: TokenomicsUpdatedEvent): void {
  let entity = new TokenomicsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.tokenomics = event.params.tokenomics;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleTreasuryUpdated(event: TreasuryUpdatedEvent): void {
  let entity = new TreasuryUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.treasury = event.params.treasury;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
