import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import { Transfer, Deposit } from "../generated/veOLAS/veOLAS"

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent())

  transferEvent.parameters = new Array()

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return transferEvent
}

export function createDepositEvent(
  account: Address,
  amount: BigInt,
  locktime: BigInt,
  depositType: BigInt,
  ts: BigInt
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = new Array()

  depositEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("locktime", ethereum.Value.fromUnsignedBigInt(locktime))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("depositType", ethereum.Value.fromUnsignedBigInt(depositType))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("ts", ethereum.Value.fromUnsignedBigInt(ts))
  )

  return depositEvent
} 