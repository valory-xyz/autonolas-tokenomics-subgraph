import { Transfer as TransferEvent } from "../generated/OLAS/OLAS";
import { BondClaim, Epoch, TokenHolder } from "../generated/schema";
import { findEpochId } from "./utils";
import { Address, BigInt } from "@graphprotocol/graph-ts";

export const BIGINT_ZERO = BigInt.fromI32(0);

// Bond claimer contract addresses from the Dune query
const BOND_CLAIMER_ADDRESSES = [
  Address.fromString("0xff8697d8d2998d6aa2e09b405795c6f4beeb0c81"),
  Address.fromString("0x52a043bcebdb2f939baef2e8b6f01652290eab3f"),
];

export function handleTransfer(event: TransferEvent): void {
  if (BOND_CLAIMER_ADDRESSES.includes(event.params.from)) {
    const currentEpochId = findEpochId(event.block.number);
    if (currentEpochId) {
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

  // Generic balance tracking
  let fromHolder = TokenHolder.load(event.params.from.toHex());
  if (fromHolder == null) {
    fromHolder = new TokenHolder(event.params.from.toHex());
    fromHolder.balance = BIGINT_ZERO;
  }
  fromHolder.balance = fromHolder.balance.minus(event.params.amount);
  fromHolder.save();

  let toHolder = TokenHolder.load(event.params.to.toHex());
  if (toHolder == null) {
    toHolder = new TokenHolder(event.params.to.toHex());
    toHolder.balance = BIGINT_ZERO;
  }
  toHolder.balance = toHolder.balance.plus(event.params.amount);
  toHolder.save();
}
