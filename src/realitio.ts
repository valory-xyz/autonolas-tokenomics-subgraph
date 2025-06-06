import {
  LogSetQuestionFee as LogSetQuestionFeeEvent,
  LogNewTemplate as LogNewTemplateEvent,
  LogNewQuestion as LogNewQuestionEvent,
  LogFundAnswerBounty as LogFundAnswerBountyEvent,
  LogNewAnswer as LogNewAnswerEvent,
  LogAnswerReveal as LogAnswerRevealEvent,
  LogNotifyOfArbitrationRequest as LogNotifyOfArbitrationRequestEvent,
  LogCancelArbitration as LogCancelArbitrationEvent,
  LogFinalize as LogFinalizeEvent,
  LogClaim as LogClaimEvent,
  LogWithdraw as LogWithdrawEvent,
} from "../generated/Realitio_v2_1/Realitio_v2_1"
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
  LogWithdraw,
} from "../generated/schema"

export function handleLogSetQuestionFee(event: LogSetQuestionFeeEvent): void {
  let entity = new LogSetQuestionFee(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.arbitrator = event.params.arbitrator
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogNewTemplate(event: LogNewTemplateEvent): void {
  let entity = new LogNewTemplate(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.template_id = event.params.template_id
  entity.user = event.params.user
  entity.question_text = event.params.question_text

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogNewQuestion(event: LogNewQuestionEvent): void {
  let entity = new LogNewQuestion(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.user = event.params.user
  entity.template_id = event.params.template_id
  entity.question = event.params.question
  entity.content_hash = event.params.content_hash
  entity.arbitrator = event.params.arbitrator
  entity.timeout = event.params.timeout
  entity.opening_ts = event.params.opening_ts
  entity.nonce = event.params.nonce
  entity.created = event.params.created

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogFundAnswerBounty(
  event: LogFundAnswerBountyEvent,
): void {
  let entity = new LogFundAnswerBounty(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.bounty_added = event.params.bounty_added
  entity.bounty = event.params.bounty
  entity.user = event.params.user

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogNewAnswer(event: LogNewAnswerEvent): void {
  let entity = new LogNewAnswer(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.answer = event.params.answer
  entity.question_id = event.params.question_id
  entity.history_hash = event.params.history_hash
  entity.user = event.params.user
  entity.bond = event.params.bond
  entity.ts = event.params.ts
  entity.is_commitment = event.params.is_commitment

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogAnswerReveal(event: LogAnswerRevealEvent): void {
  let entity = new LogAnswerReveal(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.user = event.params.user
  entity.answer_hash = event.params.answer_hash
  entity.answer = event.params.answer
  entity.nonce = event.params.nonce
  entity.bond = event.params.bond

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogNotifyOfArbitrationRequest(
  event: LogNotifyOfArbitrationRequestEvent,
): void {
  let entity = new LogNotifyOfArbitrationRequest(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.user = event.params.user

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogCancelArbitration(
  event: LogCancelArbitrationEvent,
): void {
  let entity = new LogCancelArbitration(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogFinalize(event: LogFinalizeEvent): void {
  let entity = new LogFinalize(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.answer = event.params.answer

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogClaim(event: LogClaimEvent): void {
  let entity = new LogClaim(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.question_id = event.params.question_id
  entity.user = event.params.user
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleLogWithdraw(event: LogWithdrawEvent): void {
  let entity = new LogWithdraw(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.user = event.params.user
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  // entity.save()
}
