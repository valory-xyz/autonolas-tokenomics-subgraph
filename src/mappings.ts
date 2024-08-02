import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { DevIncentive, Epoch } from "../generated/schema";
import { Tokenomics } from "../generated/Tokenomics/Tokenomics";

export class EpochMapper {
  address: Address;
  blockNumber: BigInt;
  epochCounter: BigInt;
  accountTopUps: BigInt;
  availableStakingIncentives: BigInt;

  constructor(
    address: Address,
    blockNumber: BigInt,
    epochCounter: BigInt,
    accountTopUps: BigInt,
    availableStakingIncentives: BigInt
  ) {
    this.address = address;
    this.blockNumber = blockNumber;
    this.epochCounter = epochCounter;
    this.accountTopUps = accountTopUps;
    this.availableStakingIncentives = availableStakingIncentives;
  }
}

export function handleEpochSave(params: EpochMapper): void {
  // Epoch entity
  let epoch = Epoch.load(params.epochCounter.toString());

  if (!epoch) {
    epoch = new Epoch(params.epochCounter.toString());
  }

  epoch.counter = params.epochCounter.toI32();
  epoch.endBlock = params.blockNumber;

  let adjustedAccountTopUps = params.accountTopUps;

  // Manually set the first epoch startBlock and effectiveBond
  if (epoch.counter == 1) {
    epoch.startBlock = BigInt.fromString("16699195");
    epoch.effectiveBond = BigInt.fromString("376744602072265367760000");
  }

  // There was an error in the 2d epoch topUp calculation, manually reduce the value
  if (params.epochCounter.toI32() == 2) {
    adjustedAccountTopUps = adjustedAccountTopUps.minus(
      BigInt.fromString("877000006048735000000000")
    );
  }

  epoch.accountTopUps = adjustedAccountTopUps;

  // Calculate availableDevIncentives
  let availableDevIncentives = adjustedAccountTopUps;

  if (epoch.counter > 1) {
    const previousEpochId = (epoch.counter - 1).toString();
    let previousEpoch = Epoch.load(previousEpochId);

    if (previousEpoch) {
      availableDevIncentives = previousEpoch.availableDevIncentives.plus(
        adjustedAccountTopUps
      );
    }
  }

  // Reduce available incentives in the epoch by devIncentivesTotalTopUp
  if (epoch.devIncentivesTotalTopUp) {
    availableDevIncentives = availableDevIncentives.minus(
      epoch.devIncentivesTotalTopUp!
    );
  }

  // Save availableDevIncentives
  epoch.availableDevIncentives = availableDevIncentives;

  // Save availableStakingIncentives
  epoch.availableStakingIncentives = params.availableStakingIncentives;

  // Manually create next epoch to collect all data from other events correctly
  let nextEpoch = new Epoch((epoch.counter + 1).toString());
  nextEpoch.counter = epoch.counter + 1;
  nextEpoch.startBlock = params.blockNumber.plus(BigInt.fromI32(1));
  nextEpoch.endBlock = null;
  nextEpoch.accountTopUps = BigInt.fromI32(0);
  nextEpoch.availableDevIncentives = BigInt.fromI32(0);
  nextEpoch.availableStakingIncentives = BigInt.fromI32(0);

  // Access effectiveBond from the contract state when the epoch ends
  const contract = Tokenomics.bind(params.address);
  const effectiveBond = contract.effectiveBond();
  // The effectiveBond is calculated for the next epoch
  nextEpoch.effectiveBond = effectiveBond;
  nextEpoch.save();

  epoch.save();
}

export class FindEpochMapper {
  blockNumber: BigInt;

  constructor(blockNumber: BigInt) {
    this.blockNumber = blockNumber;
  }
}

export function findEpochId(params: FindEpochMapper): string {
  // Find the current epoch based on the block number
  let epochCounter = 1;
  while (true) {
    let epochId = epochCounter.toString();
    let currentEpoch = Epoch.load(epochId);
    if (!currentEpoch) {
      break;
    }

    if (
      currentEpoch.startBlock.le(params.blockNumber) &&
      (currentEpoch.endBlock === null ||
        currentEpoch.endBlock!.ge(params.blockNumber))
    ) {
      return currentEpoch.id;
    }

    epochCounter++;
  }

  return "";
}

export class DevIncentiveMapper {
  blockNumber: BigInt;
  transactionHash: Bytes;
  owner: Address;
  reward: BigInt;
  topUp: BigInt;

  constructor(
    blockNumber: BigInt,
    transactionHash: Bytes,
    owner: Address,
    reward: BigInt,
    topUp: BigInt
  ) {
    this.blockNumber = blockNumber;
    this.transactionHash = transactionHash;
    this.owner = owner;
    this.reward = reward;
    this.topUp = topUp;
  }
}

export function handleDevIncentiveSave(params: DevIncentiveMapper): void {
  const findEpochParams = new FindEpochMapper(params.blockNumber);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    const epoch = Epoch.load(currentEpochId);

    if (epoch) {
      let devIncentive = new DevIncentive(params.transactionHash.toHex());
      devIncentive.epoch = epoch.id;
      devIncentive.owner = params.owner;
      devIncentive.reward = params.reward;
      devIncentive.topUp = params.topUp;
      devIncentive.save();

      // Update the total dev incentives topUp in the epoch
      if (!epoch.devIncentivesTotalTopUp) {
        epoch.devIncentivesTotalTopUp = params.topUp;
      } else {
        epoch.devIncentivesTotalTopUp = epoch.devIncentivesTotalTopUp!.plus(
          params.topUp
        );
      }

      epoch.save();
    }
  }
}
