import { Transfer as TransferEvent } from "../generated/OLAS/OLAS";
import { BondClaim, Epoch } from "../generated/schema";
import { findEpochId } from "./utils";
import { Address } from "@graphprotocol/graph-ts";

// Bond claimer contract addresses from the Dune query
const BOND_CLAIMER_ADDRESSES = [
  Address.fromString("0xff8697d8d2998d6aa2e09b405795c6f4beeb0c81"),
  Address.fromString("0x52a043bcebdb2f939baef2e8b6f01652290eab3f"),
];

export function handleTransfer(event: TransferEvent): void {
  if (BOND_CLAIMER_ADDRESSES.includes(event.params.from)) {
    const currentEpochId = findEpochId(event.block.number);
    let bondClaim = new BondClaim(
      event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    bondClaim.epoch = currentEpochId;
    bondClaim.claimer = event.params.to;
    bondClaim.amountOLAS = event.params.amount;
    bondClaim.transactionHash = event.transaction.hash;
    bondClaim.blockNumber = event.block.number;
    bondClaim.blockTimestamp = event.block.timestamp;
    bondClaim.save();

    if (currentEpochId) {
      let epoch = Epoch.load(currentEpochId);
      if (epoch) {
        // Update the total claimed bonds amount in the epoch
        if (!epoch.totalBondsClaimed) {
          epoch.totalBondsClaimed = event.params.amount;
        } else {
          epoch.totalBondsClaimed = epoch.totalBondsClaimed!.plus(
            event.params.amount
          );
        }
        epoch.save();
      }
    }
  }
}
