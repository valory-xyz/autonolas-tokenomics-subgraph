import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Epoch } from "../generated/schema";
import { Tokenomics } from "../generated/Tokenomics/Tokenomics";

export class EpochMapper {
  address: Address;
  blockNumber: BigInt;
  epochCounter: BigInt;
  accountTopUps: BigInt;

  constructor(
    address: Address,
    blockNumber: BigInt,
    epochCounter: BigInt,
    accountTopUps: BigInt
  ) {
    this.address = address;
    this.blockNumber = blockNumber;
    this.epochCounter = epochCounter;
    this.accountTopUps = accountTopUps;
  }
}

export function handleEpochSave(params: EpochMapper): void {
  // Epoch entity
  let epoch = Epoch.load(params.epochCounter.toString());

  if (!epoch) {
    epoch = new Epoch(params.epochCounter.toString());
  }

  let adjustedAccountTopUps = params.accountTopUps;

  // There was an error in the 2d epoch topUp calculation, manually reduce the value
  if (params.epochCounter.toI32() == 2) {
    adjustedAccountTopUps = adjustedAccountTopUps.minus(
      BigInt.fromString("877000006048735000000000")
    );
  }

  epoch.counter = params.epochCounter.toI32();
  epoch.startBlock = params.blockNumber;
  epoch.accountTopUps = adjustedAccountTopUps;
  epoch.endBlock = null;

  // Calculate availableDevIncentives
  let availableDevIncentives = adjustedAccountTopUps;

  if (epoch.counter > 1) {
    const previousEpochId = (epoch.counter - 1).toString();
    let previousEpoch = Epoch.load(previousEpochId);

    if (previousEpoch) {
      // Set previous Epoch's endBlock
      previousEpoch.endBlock = params.blockNumber.minus(BigInt.fromI32(1));
      previousEpoch.save();
      availableDevIncentives = previousEpoch.availableDevIncentives.plus(
        adjustedAccountTopUps
      );
    }
  }

  epoch.availableDevIncentives = availableDevIncentives;

  // Access effectiveBond from the contract state when the epoch ends
  const contract = Tokenomics.bind(params.address);
  const effectiveBond = contract.effectiveBond();
  epoch.effectiveBond = effectiveBond;

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

    // Check if EffectiveBondUpdated event happened during currentEpoch
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
