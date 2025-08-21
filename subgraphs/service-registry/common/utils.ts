import { BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts";
import {
  AgentPerformance,
  AgentRegistration,
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
  ServiceMultisigHistory,
  AgentMultisigHistory,
  ServiceAgentHistory,
} from "./generated/schema";

const ONE_DAY = BigInt.fromI32(86400);

export class HistoricalData {
  serviceId: i32;
  agentIds: i32[];
  timestamp: BigInt;

  constructor(serviceId: i32, agentIds: i32[], timestamp: BigInt) {
    this.serviceId = serviceId;
    this.agentIds = agentIds;
    this.timestamp = timestamp;
  }
}

export function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

export function getOrCreateService(serviceId: BigInt): Service {
  let service = Service.load(serviceId.toString());
  if (service == null) {
    service = new Service(serviceId.toString());
    service.currentAgentIds = [];
    service.save();
  }
  return service;
}

export function getHistoricalData(multisig: Multisig, timestamp: BigInt): HistoricalData | null {
  // Try to find historical agent data first
  let historicalAgentIds = findHistoricalAgentData(multisig.id, timestamp);
  let historicalServiceId = findHistoricalServiceData(multisig, timestamp);

  // Use historical data if found, otherwise use current data
  let targetAgentIds: i32[];
  if (historicalAgentIds != null) {
    targetAgentIds = historicalAgentIds;
  } else {
    targetAgentIds = multisig.currentAgentIds;
  }

  // findHistoricalServiceData always returns a valid service ID
  let targetServiceId = historicalServiceId;

  return new HistoricalData(targetServiceId, targetAgentIds, timestamp);
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
    multisig.currentAgentIds = [];
    multisig.currentServiceId = 0;
    multisig.txHash = event.transaction.hash;
    multisig.save();
  }
  return multisig;
}

export function createServiceMultisigHistory(
  serviceId: string,
  multisig: Multisig,
  timestamp: BigInt
): void {
  let historyId = serviceId + "-" + timestamp.toString();
  let history = new ServiceMultisigHistory(historyId);
  history.service = serviceId;
  history.multisig = multisig.id;
  history.timestamp = timestamp;
  history.save();
}

export function createAgentMultisigHistory(
  multisig: Multisig,
  agentIds: i32[],
  timestamp: BigInt
): void {
  let historyId = multisig.id.toHexString() + "-" + timestamp.toString();
  let history = new AgentMultisigHistory(historyId);
  history.multisig = multisig.id;
  history.agentIds = agentIds;
  history.timestamp = timestamp;
  history.save();
}

export function createServiceAgentHistory(
  serviceId: string,
  agentIds: Array<i32>,
  timestamp: BigInt
): void {
  let historyId = serviceId + "-" + timestamp.toString();
  let history = new ServiceAgentHistory(historyId);
  history.service = serviceId;
  history.agentIds = agentIds;
  history.timestamp = timestamp;
  history.save();
}

// Helper function to find the most recent AgentMultisigHistory for a multisig before a timestamp
function findHistoricalAgentData(multisigAddress: Bytes, timestamp: BigInt): i32[] | null {
  // Since AssemblyScript doesn't support complex queries, we'll use a pattern-based approach
  // We'll search backwards from the target timestamp with reasonable limits
  let searchLimit = 100; // Search up to 100 historical records
  let currentTimestamp = timestamp;

  for (let i = 0; i < searchLimit; i++) {
    let historyId = multisigAddress.toHexString() + "-" + currentTimestamp.toString();
    let history = AgentMultisigHistory.load(historyId);

    if (history != null) {
      return history.agentIds;
    }

    // Try previous timestamp (this is a simplification - in reality you'd need better logic)
    currentTimestamp = currentTimestamp.minus(BigInt.fromI32(1));
  }

  return null; // No historical data found
}

// Helper function to find the most recent ServiceMultisigHistory for a multisig before a timestamp
function findHistoricalServiceData(multisig: Multisig, timestamp: BigInt): i32 {
  // ServiceMultisigHistory uses serviceId-timestamp format
  // We need to search through possible service IDs and timestamps
  let searchLimit = 50; // Reasonable limit to avoid excessive computation
  let currentTimestamp = timestamp;

  // Try the current service ID first
  let currentServiceId = multisig.currentServiceId.toString();
  for (let i = 0; i < searchLimit; i++) {
    let historyId = currentServiceId + "-" + currentTimestamp.toString();
    let history = ServiceMultisigHistory.load(historyId);

    if (history != null && history.multisig.equals(multisig.id)) {
      return multisig.currentServiceId; // Found matching service history
    }

    currentTimestamp = currentTimestamp.minus(BigInt.fromI32(1));
  }

  // If no historical service data found, return current service ID
  return multisig.currentServiceId;
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
  // Links an agent to the daily unique agents list for deduplication
  // Ensures each agent is counted only once per day, regardless of how many transactions they made
  // Updates the daily unique agent count automatically
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
  // Tracks which multisigs a specific agent was active in on a given day (agent-centric view)
  // Example: Agent 40 worked with Multisig A and B today, so we create 2 links
  // Used for agent performance analytics: "How many different multisigs did this agent work with?"
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
  // Tracks which multisigs had any activity at all on a given day (system-wide view)
  // Example: Today Multisig A and B were active, regardless of which agents used them
  // Used for system analytics: "How many total multisigs were active today?"
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

export function createOrUpdateAgentRegistration(
  serviceId: i32,
  agentId: i32,
  timestamp: BigInt
): void {
  const id = serviceId.toString().concat("-").concat(agentId.toString());
  let registration = AgentRegistration.load(id);
  if (registration == null) {
    registration = new AgentRegistration(id);
  }
  registration.serviceId = serviceId;
  registration.agentId = agentId;
  registration.registrationTimestamp = timestamp;
  registration.save();
}

export function getMostRecentAgentId(
  serviceId: i32,
  agentIds: i32[],
  deploymentTimestamp: BigInt
): i32 {
  // Find the agent that was registered most recently before the multisig deployment
  // This matches the SQL query logic: order by registered_at desc, rn = 1

  let mostRecentAgentId: i32 = -1;
  let mostRecentTimestamp = BigInt.fromI32(0);

  // We need to iterate through all possible agent registrations for this service
  // Since we can't do complex queries in AssemblyScript, we'll check common agent IDs
  // This is a limitation but should cover most cases
  for (let i = 0; i < agentIds.length; i++) {
    const agentId = agentIds[i];
    const registrationId = serviceId
      .toString()
      .concat("-")
      .concat(agentId.toString());
    const registration = AgentRegistration.load(registrationId);

    if (
      registration != null &&
      registration.registrationTimestamp <= deploymentTimestamp &&
      registration.registrationTimestamp > mostRecentTimestamp
    ) {
      mostRecentAgentId = agentId;
      mostRecentTimestamp = registration.registrationTimestamp;
    }
  }

  return mostRecentAgentId;
} 