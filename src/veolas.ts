import { Transfer as TransferEvent, Deposit as DepositEvent } from "../generated/veOLAS/veOLAS";
import { TokenHolder, VeOLASLock } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

const BIGINT_ZERO = BigInt.fromI32(0);

export function handleDeposit(event: DepositEvent): void {
  let lockId = event.transaction.hash.toHexString().concat("-").concat(event.logIndex.toString());
  let lock = new VeOLASLock(lockId);
  lock.account = event.params.account;
  lock.amount = event.params.amount;
  lock.unlockTime = event.params.locktime;
  lock.depositType = event.params.depositType;
  lock.timestamp = event.params.ts;
  lock.isActive = event.params.locktime.gt(event.block.timestamp);
  lock.blockNumber = event.block.number;
  lock.blockTimestamp = event.block.timestamp;
  lock.save();
}

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