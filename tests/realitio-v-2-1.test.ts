import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { LogSetQuestionFee } from "../generated/schema"
import { LogSetQuestionFee as LogSetQuestionFeeEvent } from "../generated/Realitio_v2_1/Realitio_v2_1"
import { handleLogSetQuestionFee } from "../src/realitio-v-2-1"
import { createLogSetQuestionFeeEvent } from "./realitio-v-2-1-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let arbitrator = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let amount = BigInt.fromI32(234)
    let newLogSetQuestionFeeEvent = createLogSetQuestionFeeEvent(
      arbitrator,
      amount
    )
    handleLogSetQuestionFee(newLogSetQuestionFeeEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("LogSetQuestionFee created and stored", () => {
    assert.entityCount("LogSetQuestionFee", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "LogSetQuestionFee",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "arbitrator",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "LogSetQuestionFee",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "amount",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
