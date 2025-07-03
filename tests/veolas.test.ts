import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { TokenHolder } from "../generated/schema"
import { handleTransfer } from "../src/veolas"
import { createTransferEvent } from "./veolas-utils"

describe("veOLAS token holder tracking", () => {
  beforeAll(() => {
    clearStore()
  })

  afterAll(() => {
    clearStore()
  })

  test("Transfer updates token holder balances", () => {
    const from = Address.fromString("0x0000000000000000000000000000000000000001")
    const to = Address.fromString("0x0000000000000000000000000000000000000002")
    const value = BigInt.fromI32(1000)

    // Create and handle a transfer event
    let transferEvent = createTransferEvent(from, to, value)
    handleTransfer(transferEvent)

    // Check that both holders were created
    assert.entityCount("TokenHolder", 2)

    // Check balances
    assert.fieldEquals(
      "TokenHolder",
      from.toHex(),
      "balance",
      "-1000"
    )
    assert.fieldEquals(
      "TokenHolder",
      to.toHex(),
      "balance",
      "1000"
    )
  })

  test("Multiple transfers accumulate balances correctly", () => {
    const alice = Address.fromString("0x0000000000000000000000000000000000000001")
    const bob = Address.fromString("0x0000000000000000000000000000000000000002")
    const charlie = Address.fromString("0x0000000000000000000000000000000000000003")

    // Alice sends 500 to Bob
    let transfer1 = createTransferEvent(alice, bob, BigInt.fromI32(500))
    handleTransfer(transfer1)

    // Bob sends 200 to Charlie
    let transfer2 = createTransferEvent(bob, charlie, BigInt.fromI32(200))
    handleTransfer(transfer2)

    // Check final balances
    assert.fieldEquals(
      "TokenHolder",
      alice.toHex(),
      "balance",
      "-500"
    )
    assert.fieldEquals(
      "TokenHolder",
      bob.toHex(),
      "balance",
      "300" // 500 received - 200 sent
    )
    assert.fieldEquals(
      "TokenHolder",
      charlie.toHex(),
      "balance",
      "200"
    )
  })
}) 