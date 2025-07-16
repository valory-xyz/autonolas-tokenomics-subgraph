import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Global, TraderAgent } from "../generated/schema";

export function updateTraderAgentActivity(
  address: Address,
  blockTimestamp: BigInt
): void {
  let agent = TraderAgent.load(address);
  if (agent !== null) {
    if (agent.firstParticipation === null) {
      agent.firstParticipation = blockTimestamp;
      let global = getGlobal();
      global.totalActiveTraderAgents += 1;
      global.save();
    }

    agent.totalBets += 1;
    agent.lastActive = blockTimestamp;
    agent.save();
  }
}

export function updateTraderAgentPayout(
  address: Address,
  payout: BigInt
): void {
  let agent = TraderAgent.load(address);
  if (agent !== null) {
    agent.totalPayout = agent.totalPayout.plus(payout);
    agent.save();
  }
}

export function getGlobal(): Global {
  let global = Global.load("");
  if (global == null) {
    global = new Global("");
    global.totalTraderAgents = 0;
    global.totalActiveTraderAgents = 0;
  }
  return global as Global;
}
