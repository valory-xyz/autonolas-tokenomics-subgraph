import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Global, TraderAgent } from "../generated/schema";

export function updateTraderAgent(
  address: Address,
  blockTimestamp: BigInt,
  tradeAmount: BigInt,
  payout: BigInt,
  betsCount: number,
): void {
  let addressHex = address.toHexString();
  let agent = TraderAgent.load(addressHex);
  if (agent !== null) {
    if (agent.firstParticipation === null) {
      agent.firstParticipation = blockTimestamp;
      let global = getGlobal();
      global.totalActiveTraderAgents += 1;
      global.save()
    }

    agent.totalBets += <i32>betsCount;
    agent.totalTraded = agent.totalTraded.plus(tradeAmount)
    agent.totalPayout = agent.totalPayout.plus(payout);

    agent.lastActive = blockTimestamp;
    agent.save();
  }
}

export function getGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.totalTraderAgents = 0;
    global.totalActiveTraderAgents = 0;
  }
  return global as Global;
}
