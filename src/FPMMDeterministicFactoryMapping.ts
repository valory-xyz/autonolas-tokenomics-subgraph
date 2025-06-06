import {
  BigInt,
  log,
  Address,
  BigDecimal,
  Bytes,
} from "@graphprotocol/graph-ts";

import { FixedProductMarketMakerCreation as FixedProductMarketMakerCreationEvent } from "../generated/FPMMDeterministicFactory/FPMMDeterministicFactory";
import {
  CreatorAgent,
  // FixedProductMarketMaker,
  // Condition,
  // Question,
  FixedProductMarketMakerCreation,
  Question,
} from "../generated/schema";
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from "../generated/templates";
import { CREATOR_ADDRESSES } from "./constants";
// import { zero, secondsPerHour, hoursPerDay, zeroDec } from "./utils/constants";
// import { joinDayAndVolume } from "./utils/day-volume";
// import { updateScaledVolumes, setLiquidity } from "./utils/fpmm";
// import { requireToken } from "./utils/token";
// import { requireGlobal } from "./utils/global";

const BLACKLISTED_MARKETS = [
  "0xe7ed8a5f2f0f17f7d584ae8ddd0592d1ac67791f",
  "0xbfa584b29891941c8950ce975c1f7fa595ce1b99",
];

export function handleFixedProductMarketMakerCreation(
  event: FixedProductMarketMakerCreationEvent
): void {
  let creatorAddressHexString = event.params.creator.toHexString();
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();

  if (
    // Only save data for our market creators
    CREATOR_ADDRESSES.indexOf(creatorAddressHexString.toLowerCase()) !== -1 &&
    BLACKLISTED_MARKETS.indexOf(addressHexString.toLowerCase()) !== -1
  ) {
    let entity = new FixedProductMarketMakerCreation(addressHexString);
    entity.creator = event.params.creator;
    entity.fixedProductMarketMaker = event.params.fixedProductMarketMaker;
    entity.conditionalTokens = event.params.conditionalTokens;
    entity.collateralToken = event.params.collateralToken;
    entity.conditionIds = event.params.conditionIds;
    entity.fee = event.params.fee;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;

    entity.save();

    // let condition = Condition

    // // Log question so we can get the final answer later
    // let question = Question.load(questionIdStr);
    // if (question != null) {
    //   fpmm.templateId = question.templateId;
    //   fpmm.data = question.data;
    //   fpmm.title = question.title;
    //   fpmm.outcomes = question.outcomes;
    //   fpmm.category = question.category;
    //   fpmm.language = question.language;
    //   fpmm.arbitrator = question.arbitrator;
    //   fpmm.openingTimestamp = question.openingTimestamp;
    //   fpmm.timeout = question.timeout;

    //   if (question.indexedFixedProductMarketMakers.length < 100) {
    //     fpmm.currentAnswer = question.currentAnswer;
    //     fpmm.currentAnswerBond = question.currentAnswerBond;
    //     fpmm.currentAnswerTimestamp = question.currentAnswerTimestamp;
    //     fpmm.isPendingArbitration = question.isPendingArbitration;
    //     fpmm.arbitrationOccurred = question.arbitrationOccurred;
    //     fpmm.answerFinalizedTimestamp = question.answerFinalizedTimestamp;
    //     let fpmms = question.indexedFixedProductMarketMakers;
    //     fpmms.push(addressHexString);
    //     question.indexedFixedProductMarketMakers = fpmms;
    //     question.save();
    //     fpmm.indexedOnQuestion = true;
    //   } else {
    //     log.warning(
    //       "cannot continue updating live question (id {}) properties on fpmm {}",
    //       [questionIdStr, addressHexString]
    //     );
    //   }
    // }

    let creatorAgent = CreatorAgent.load(creatorAddressHexString);
    if (creatorAgent === null) {
      creatorAgent = new CreatorAgent(creatorAddressHexString);
      creatorAgent.totalQuestions = 0;
      creatorAgent.blockNumber = event.block.number;
      creatorAgent.blockTimestamp = event.block.timestamp;
      creatorAgent.transactionHash = event.transaction.hash;
    }
    creatorAgent.totalQuestions += 1;
    creatorAgent.save();

    FixedProductMarketMakerTemplate.create(address);
  }
}
