import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { Checkpoint } from "../generated/schema"
import { Checkpoint as CheckpointEvent } from "../generated/StakingProxy/StakingProxy"
import { handleCheckpoint } from "../src/staking-proxy"
import { createCheckpointEvent } from "./staking-proxy-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let epoch = BigInt.fromI32(234)
    let availableRewards = BigInt.fromI32(234)
    let serviceIds = [BigInt.fromI32(234)]
    let rewards = [BigInt.fromI32(234)]
    let epochLength = BigInt.fromI32(234)
    let newCheckpointEvent = createCheckpointEvent(
      epoch,
      availableRewards,
      serviceIds,
      rewards,
      epochLength
    )
    handleCheckpoint(newCheckpointEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("Checkpoint created and stored", () => {
    assert.entityCount("Checkpoint", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Checkpoint",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "epoch",
      "234"
    )
    assert.fieldEquals(
      "Checkpoint",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "availableRewards",
      "234"
    )
    assert.fieldEquals(
      "Checkpoint",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "serviceIds",
      "[234]"
    )
    assert.fieldEquals(
      "Checkpoint",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "rewards",
      "[234]"
    )
    assert.fieldEquals(
      "Checkpoint",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "epochLength",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
