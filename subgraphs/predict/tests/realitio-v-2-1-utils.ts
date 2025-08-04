import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  LogSetQuestionFee,
  LogNewTemplate,
  LogNewQuestion,
  LogFundAnswerBounty,
  LogNewAnswer,
  LogAnswerReveal,
  LogNotifyOfArbitrationRequest,
  LogCancelArbitration,
  LogFinalize,
  LogClaim,
  LogWithdraw
} from "../generated/Realitio_v2_1/Realitio_v2_1"

export function createLogSetQuestionFeeEvent(
  arbitrator: Address,
  amount: BigInt
): LogSetQuestionFee {
  let logSetQuestionFeeEvent = changetype<LogSetQuestionFee>(newMockEvent())

  logSetQuestionFeeEvent.parameters = new Array()

  logSetQuestionFeeEvent.parameters.push(
    new ethereum.EventParam(
      "arbitrator",
      ethereum.Value.fromAddress(arbitrator)
    )
  )
  logSetQuestionFeeEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return logSetQuestionFeeEvent
}

export function createLogNewTemplateEvent(
  template_id: BigInt,
  user: Address,
  question_text: string
): LogNewTemplate {
  let logNewTemplateEvent = changetype<LogNewTemplate>(newMockEvent())

  logNewTemplateEvent.parameters = new Array()

  logNewTemplateEvent.parameters.push(
    new ethereum.EventParam(
      "template_id",
      ethereum.Value.fromUnsignedBigInt(template_id)
    )
  )
  logNewTemplateEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logNewTemplateEvent.parameters.push(
    new ethereum.EventParam(
      "question_text",
      ethereum.Value.fromString(question_text)
    )
  )

  return logNewTemplateEvent
}

export function createLogNewQuestionEvent(
  question_id: Bytes,
  user: Address,
  template_id: BigInt,
  question: string,
  content_hash: Bytes,
  arbitrator: Address,
  timeout: BigInt,
  opening_ts: BigInt,
  nonce: BigInt,
  created: BigInt
): LogNewQuestion {
  let logNewQuestionEvent = changetype<LogNewQuestion>(newMockEvent())

  logNewQuestionEvent.parameters = new Array()

  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "template_id",
      ethereum.Value.fromUnsignedBigInt(template_id)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam("question", ethereum.Value.fromString(question))
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "content_hash",
      ethereum.Value.fromFixedBytes(content_hash)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "arbitrator",
      ethereum.Value.fromAddress(arbitrator)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "timeout",
      ethereum.Value.fromUnsignedBigInt(timeout)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "opening_ts",
      ethereum.Value.fromUnsignedBigInt(opening_ts)
    )
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce))
  )
  logNewQuestionEvent.parameters.push(
    new ethereum.EventParam(
      "created",
      ethereum.Value.fromUnsignedBigInt(created)
    )
  )

  return logNewQuestionEvent
}

export function createLogFundAnswerBountyEvent(
  question_id: Bytes,
  bounty_added: BigInt,
  bounty: BigInt,
  user: Address
): LogFundAnswerBounty {
  let logFundAnswerBountyEvent = changetype<LogFundAnswerBounty>(newMockEvent())

  logFundAnswerBountyEvent.parameters = new Array()

  logFundAnswerBountyEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logFundAnswerBountyEvent.parameters.push(
    new ethereum.EventParam(
      "bounty_added",
      ethereum.Value.fromUnsignedBigInt(bounty_added)
    )
  )
  logFundAnswerBountyEvent.parameters.push(
    new ethereum.EventParam("bounty", ethereum.Value.fromUnsignedBigInt(bounty))
  )
  logFundAnswerBountyEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )

  return logFundAnswerBountyEvent
}

export function createLogNewAnswerEvent(
  answer: Bytes,
  question_id: Bytes,
  history_hash: Bytes,
  user: Address,
  bond: BigInt,
  ts: BigInt,
  is_commitment: boolean
): LogNewAnswer {
  let logNewAnswerEvent = changetype<LogNewAnswer>(newMockEvent())

  logNewAnswerEvent.parameters = new Array()

  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam("answer", ethereum.Value.fromFixedBytes(answer))
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam(
      "history_hash",
      ethereum.Value.fromFixedBytes(history_hash)
    )
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam("bond", ethereum.Value.fromUnsignedBigInt(bond))
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam("ts", ethereum.Value.fromUnsignedBigInt(ts))
  )
  logNewAnswerEvent.parameters.push(
    new ethereum.EventParam(
      "is_commitment",
      ethereum.Value.fromBoolean(is_commitment)
    )
  )

  return logNewAnswerEvent
}

export function createLogAnswerRevealEvent(
  question_id: Bytes,
  user: Address,
  answer_hash: Bytes,
  answer: Bytes,
  nonce: BigInt,
  bond: BigInt
): LogAnswerReveal {
  let logAnswerRevealEvent = changetype<LogAnswerReveal>(newMockEvent())

  logAnswerRevealEvent.parameters = new Array()

  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam(
      "answer_hash",
      ethereum.Value.fromFixedBytes(answer_hash)
    )
  )
  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam("answer", ethereum.Value.fromFixedBytes(answer))
  )
  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce))
  )
  logAnswerRevealEvent.parameters.push(
    new ethereum.EventParam("bond", ethereum.Value.fromUnsignedBigInt(bond))
  )

  return logAnswerRevealEvent
}

export function createLogNotifyOfArbitrationRequestEvent(
  question_id: Bytes,
  user: Address
): LogNotifyOfArbitrationRequest {
  let logNotifyOfArbitrationRequestEvent =
    changetype<LogNotifyOfArbitrationRequest>(newMockEvent())

  logNotifyOfArbitrationRequestEvent.parameters = new Array()

  logNotifyOfArbitrationRequestEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logNotifyOfArbitrationRequestEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )

  return logNotifyOfArbitrationRequestEvent
}

export function createLogCancelArbitrationEvent(
  question_id: Bytes
): LogCancelArbitration {
  let logCancelArbitrationEvent = changetype<LogCancelArbitration>(
    newMockEvent()
  )

  logCancelArbitrationEvent.parameters = new Array()

  logCancelArbitrationEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )

  return logCancelArbitrationEvent
}

export function createLogFinalizeEvent(
  question_id: Bytes,
  answer: Bytes
): LogFinalize {
  let logFinalizeEvent = changetype<LogFinalize>(newMockEvent())

  logFinalizeEvent.parameters = new Array()

  logFinalizeEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logFinalizeEvent.parameters.push(
    new ethereum.EventParam("answer", ethereum.Value.fromFixedBytes(answer))
  )

  return logFinalizeEvent
}

export function createLogClaimEvent(
  question_id: Bytes,
  user: Address,
  amount: BigInt
): LogClaim {
  let logClaimEvent = changetype<LogClaim>(newMockEvent())

  logClaimEvent.parameters = new Array()

  logClaimEvent.parameters.push(
    new ethereum.EventParam(
      "question_id",
      ethereum.Value.fromFixedBytes(question_id)
    )
  )
  logClaimEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logClaimEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return logClaimEvent
}

export function createLogWithdrawEvent(
  user: Address,
  amount: BigInt
): LogWithdraw {
  let logWithdrawEvent = changetype<LogWithdraw>(newMockEvent())

  logWithdrawEvent.parameters = new Array()

  logWithdrawEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  logWithdrawEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return logWithdrawEvent
}
