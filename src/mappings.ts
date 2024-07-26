import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Epoch } from "../generated/schema";

export class EpochMapper {
  blockNumber: BigInt;
  epochCounter: BigInt;
  accountTopUps: BigInt;

  constructor(
    blockNumber: BigInt,
    epochCounter: BigInt,
    accountTopUps: BigInt
  ) {
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
    let previousEpochId = (epoch.counter - 1).toString();
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
  epoch.save();
}
