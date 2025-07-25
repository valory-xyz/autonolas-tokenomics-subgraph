import { BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts";
import {
  AgentPerformance,
  DailyActiveMultisig,
  DailyActiveMultisigs,
  DailyAgentMultisig,
  DailyAgentPerformance,
  DailyServiceActivity,
  DailyUniqueAgent,
  DailyUniqueAgents,
  Global,
  Multisig,
  Service,
} from "./generated/schema";

const ONE_DAY = BigInt.fromI32(86400);

export function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

export function getOrCreateService(serviceId: BigInt): Service {
  let service = Service.load(serviceId.toString());
  if (service == null) {
    service = new Service(serviceId.toString());
    service.agentIds = [];
    service.save();
  }
  return service;
}

export function getOrCreateMultisig(
  multisigAddress: Bytes,
  event: ethereum.Event
): Multisig {
  let multisig = Multisig.load(multisigAddress);
  if (multisig == null) {
    multisig = new Multisig(multisigAddress);
    multisig.creator = event.transaction.from;
    multisig.creationTimestamp = event.block.timestamp;
    multisig.agentIds = [];
    multisig.serviceId = 0;
    multisig.txHash = event.transaction.hash;
    multisig.save();
  }
  return multisig;
}

export function getOrCreateDailyServiceActivity(
  serviceId: string,
  event: ethereum.Event
): DailyServiceActivity {
  const dayTimestamp = getDayTimestamp(event);
  const id = "day-"
    .concat(dayTimestamp.toString())
    .concat("-service-")
    .concat(serviceId);
  let dailyActivity = DailyServiceActivity.load(id);
  if (dailyActivity == null) {
    dailyActivity = new DailyServiceActivity(id);
    dailyActivity.service = serviceId;
    dailyActivity.dayTimestamp = dayTimestamp;
    dailyActivity.agentIds = [];
    dailyActivity.save();
  }
  return dailyActivity;
}

export function getOrCreateDailyUniqueAgents(
  event: ethereum.Event
): DailyUniqueAgents {
  const dayTimestamp = getDayTimestamp(event);
  const id = "day-".concat(dayTimestamp.toString());
  let dailyUniqueAgents = DailyUniqueAgents.load(id);
  if (dailyUniqueAgents == null) {
    dailyUniqueAgents = new DailyUniqueAgents(id);
    dailyUniqueAgents.dayTimestamp = dayTimestamp;
    dailyUniqueAgents.count = 0;
    dailyUniqueAgents.save();
  }
  return dailyUniqueAgents;
}

export function getOrCreateDailyAgentPerformance(
  event: ethereum.Event,
  agentId: i32
): DailyAgentPerformance {
  const dayTimestamp = getDayTimestamp(event);
  const id = "day-"
    .concat(dayTimestamp.toString())
    .concat("-agent-")
    .concat(agentId.toString());
  let entity = DailyAgentPerformance.load(id);
  if (entity == null) {
    entity = new DailyAgentPerformance(id);
    entity.agentId = agentId;
    entity.dayTimestamp = dayTimestamp;
    entity.txCount = 0;
    entity.activeMultisigCount = 0;
    entity.save();
  }
  return entity;
}

export function getOrCreateDailyActiveMultisigs(
  event: ethereum.Event
): DailyActiveMultisigs {
  const dayTimestamp = getDayTimestamp(event);
  const dailyId = "day-" + dayTimestamp.toString();
  let dailyEntity = DailyActiveMultisigs.load(dailyId);
  if (dailyEntity == null) {
    dailyEntity = new DailyActiveMultisigs(dailyId);
    dailyEntity.dayTimestamp = dayTimestamp;
    dailyEntity.count = 0;
    dailyEntity.save();
  }
  return dailyEntity;
}

export function getGlobal(): Global {
  let global = Global.load("");
  if (global == null) {
    global = new Global("");
    global.txCount = BigInt.fromI32(0);
    global.lastUpdated = BigInt.fromI32(0);
    global.save();
  }
  return global;
}

export function getOrCreateAgentPerformance(
  agentId: i32
): AgentPerformance {
  let agent = AgentPerformance.load(agentId.toString());
  if (agent == null) {
    agent = new AgentPerformance(agentId.toString());
    agent.txCount = BigInt.fromI32(0);
    agent.save();
  }
  return agent;
}

export function createDailyUniqueAgent(
  dailyUniqueAgents: DailyUniqueAgents,
  agent: AgentPerformance
): void {
  const id = dailyUniqueAgents.id
    .concat("-")
    .concat(agent.id);
  let dailyUniqueAgent = DailyUniqueAgent.load(id);
  if (dailyUniqueAgent == null) {
    dailyUniqueAgent = new DailyUniqueAgent(id);
    dailyUniqueAgent.dailyUniqueAgents = dailyUniqueAgents.id;
    dailyUniqueAgent.agent = agent.id;
    dailyUniqueAgent.save();

    dailyUniqueAgents.count = dailyUniqueAgents.count + 1;
    dailyUniqueAgents.save();
  }
}

export function createDailyAgentMultisig(
  dailyAgentPerformance: DailyAgentPerformance,
  multisig: Multisig
): void {
  const id = dailyAgentPerformance.id
    .concat("-")
    .concat(multisig.id.toHexString());
  let dailyAgentMultisig = DailyAgentMultisig.load(id);
  if (dailyAgentMultisig == null) {
    dailyAgentMultisig = new DailyAgentMultisig(id);
    dailyAgentMultisig.dailyAgentPerformance = dailyAgentPerformance.id;
    dailyAgentMultisig.multisig = multisig.id;
    dailyAgentMultisig.save();

    dailyAgentPerformance.activeMultisigCount =
      dailyAgentPerformance.activeMultisigCount + 1;
    dailyAgentPerformance.save();
  }
}

export function createDailyActiveMultisig(
  dailyActiveMultisigs: DailyActiveMultisigs,
  multisig: Multisig
): void {
  const id = dailyActiveMultisigs.id
    .concat("-")
    .concat(multisig.id.toHexString());
  let dailyActiveMultisig = DailyActiveMultisig.load(id);
  if (dailyActiveMultisig == null) {
    dailyActiveMultisig = new DailyActiveMultisig(id);
    dailyActiveMultisig.dailyActiveMultisigs = dailyActiveMultisigs.id;
    dailyActiveMultisig.multisig = multisig.id;
    dailyActiveMultisig.save();

    dailyActiveMultisigs.count = dailyActiveMultisigs.count + 1;
    dailyActiveMultisigs.save();
  }
} 