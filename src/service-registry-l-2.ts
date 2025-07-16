import { BigInt } from "@graphprotocol/graph-ts";
import { CreateMultisigWithAgents as CreateMultisigWithAgentsEvent } from "../generated/ServiceRegistryL2/ServiceRegistryL2";
import { TraderAgent } from "../generated/schema";
import { getGlobal } from "./utils";

export function handleCreateMultisigWithAgents(
  event: CreateMultisigWithAgentsEvent
): void {
  let traderAgent = TraderAgent.load(event.params.multisig);
  if (traderAgent === null) {
    traderAgent = new TraderAgent(event.params.multisig);
    traderAgent.totalBets = 0;
    traderAgent.serviceId = event.params.serviceId;
    traderAgent.totalPayout = BigInt.fromI32(0);
    traderAgent.totalTraded = BigInt.fromI32(0);
    traderAgent.totalFees = BigInt.fromI32(0);

    traderAgent.blockNumber = event.block.number;
    traderAgent.blockTimestamp = event.block.timestamp;
    traderAgent.transactionHash = event.transaction.hash;

    traderAgent.save();

    let global = getGlobal();
    global.totalTraderAgents += 1;
    global.save();
  }
}
