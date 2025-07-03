import { Transfer as TransferEvent } from "../generated/veOLAS/veOLAS";
import { TokenHolder } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

const BIGINT_ZERO = BigInt.fromI32(0);

export function handleTransfer(event: TransferEvent): void {
  // Generic balance tracking
  let fromHolder = TokenHolder.load(event.params.from.toHex());
  if (fromHolder == null) {
    fromHolder = new TokenHolder(event.params.from.toHex());
    fromHolder.balance = BIGINT_ZERO;
  }
  fromHolder.balance = fromHolder.balance.minus(event.params.value);
  fromHolder.save();

  let toHolder = TokenHolder.load(event.params.to.toHex());
  if (toHolder == null) {
    toHolder = new TokenHolder(event.params.to.toHex());
    toHolder.balance = BIGINT_ZERO;
  }
  toHolder.balance = toHolder.balance.plus(event.params.value);
  toHolder.save();
} 