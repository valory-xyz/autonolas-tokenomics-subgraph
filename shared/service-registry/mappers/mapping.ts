import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  CreateService,
  RegisterInstance,
  TerminateService,
} from "../generated/ServiceRegistryL2/ServiceRegistryL2";
import {
  ExecutionSuccess,
  ExecutionFromModuleSuccess,
} from "../generated/templates/GnosisSafe/GnosisSafe";
import {
  Multisig,
  Service,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";
import {
  getOrCreateService,
  getOrCreateMultisig,
  getOrCreateDailyServiceActivity,
  getOrCreateDailyUniqueAgents,
  getOrCreateDailyAgentPerformance,
  getOrCreateDailyActiveMultisigs,
  getGlobal,
  getOrCreateAgentPerformance,
  createDailyUniqueAgent,
  createDailyAgentMultisig,
  createDailyActiveMultisig,
  createOrUpdateAgentRegistration,
  getMostRecentAgentId,
} from "../utils";

function updateDailyAgentPerformance(
  event: ethereum.Event,
  multisig: Multisig
): void {
  // Calculate the correct agent for this transaction based on when it happened
  // This bypasses cached multisig.agentIds which may be incorrect due to service lifecycle changes
  const correctAgentId = getMostRecentAgentId(
    multisig.serviceId,
    [], // Don't use cached service.agentIds - search all possible agents
    event.block.timestamp // Use transaction time to find who was active then
  );

  if (correctAgentId != -1) {
    const entity = getOrCreateDailyAgentPerformance(event, correctAgentId);

    // CRITICAL: Validate that this entity belongs to the correct agent
    // This prevents cross-agent contamination
    if (entity.agentId != correctAgentId) {
      log.error(
        "CRITICAL BUG: Agent ID mismatch! Entity {} has agentId {} but expected {}",
        [entity.id, entity.agentId.toString(), correctAgentId.toString()]
      );
      return; // Skip this update to prevent data corruption
    }

    // Increment transaction count for this agent
    entity.txCount = entity.txCount + 1;
    entity.save();

    createDailyAgentMultisig(entity, multisig);

    // Update global agent entity
    const agent = getOrCreateAgentPerformance(correctAgentId);
    agent.txCount = agent.txCount.plus(BigInt.fromI32(1));
    agent.save();
  } else {
    // Log warning if no agent found for this transaction
    log.warning("No agent found for transaction at service {} timestamp {}", [
      multisig.serviceId.toString(),
      event.block.timestamp.toString()
    ]);
  }
}

function updateDailyUniqueAgents(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dailyUniqueAgents = getOrCreateDailyUniqueAgents(event);
  
  // Calculate the correct agent for this transaction based on when it happened
  const correctAgentId = getMostRecentAgentId(
    multisig.serviceId,
    [], // Don't use cached service.agentIds - search all possible agents
    event.block.timestamp // Use transaction time to find who was active then
  );

  if (correctAgentId != -1) {
    const agent = getOrCreateAgentPerformance(correctAgentId);
    createDailyUniqueAgent(dailyUniqueAgents, agent);
  }
}

function updateDailyActivity(
  service: Service,
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dailyActivity = getOrCreateDailyServiceActivity(service.id, event);
  
  // Calculate the correct agent for this transaction based on when it happened
  const correctAgentId = getMostRecentAgentId(
    multisig.serviceId,
    [], // Don't use cached service.agentIds - search all possible agents
    event.block.timestamp // Use transaction time to find who was active then
  );

  if (correctAgentId != -1) {
    dailyActivity.agentIds = [correctAgentId];
  } else {
    dailyActivity.agentIds = [];
  }
  dailyActivity.save();
}

function updateDailyActiveMultisigs(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dailyEntity = getOrCreateDailyActiveMultisigs(event);
  createDailyActiveMultisig(dailyEntity, multisig);
}

function updateGlobalMetrics(event: ethereum.Event): void {
  const global = getGlobal();
  global.txCount = global.txCount.plus(BigInt.fromI32(1));
  global.lastUpdated = event.block.timestamp;
  global.save();
}

export function handleCreateService(event: CreateService): void {
  getOrCreateService(event.params.serviceId);
}

export function handleRegisterInstance(event: RegisterInstance): void {
  let service = getOrCreateService(event.params.serviceId);
  const newAgentId = event.params.agentId.toI32();

  // Track agent registration timestamp for later use in multisig creation
  createOrUpdateAgentRegistration(
    event.params.serviceId.toI32(),
    newAgentId,
    event.block.timestamp
  );

  // Add agent if not already in the list to avoid duplicates
  if (!service.agentIds.includes(newAgentId)) {
    let agentIds = service.agentIds;
    agentIds.push(newAgentId);
    service.agentIds = agentIds;
  }
  service.save();
}

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let service = Service.load(event.params.serviceId.toString());

  if (service != null) {
    const multisig = getOrCreateMultisig(event.params.multisig, event);
    service.multisig = multisig.id;
    service.save();

    GnosisSafeTemplate.create(event.params.multisig);

    multisig.serviceId = event.params.serviceId.toI32();
    multisig.txHash = event.transaction.hash;

    // Use the most recently registered agent instead of all agents
    // This matches the SQL query logic to prevent double counting
    const mostRecentAgentId = getMostRecentAgentId(
      event.params.serviceId.toI32(),
      service.agentIds,
      event.block.timestamp
    );

    if (mostRecentAgentId != -1) {
      multisig.agentIds = [mostRecentAgentId];
    } else {
      // Fallback to existing logic if no agent found
      log.warning("No recent agent found for service {}, using all agents", [
        event.params.serviceId.toString(),
      ]);
      multisig.agentIds = service.agentIds;
    }

    multisig.save();
  }
}

export function handleTerminateService(event: TerminateService): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service != null) {
    service.agentIds = [];
    service.save();
  }
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    let service = Service.load(multisig.serviceId.toString());
    if (service != null) {
      updateDailyActivity(service, event, multisig);
      updateDailyUniqueAgents(event, multisig);
      updateDailyAgentPerformance(event, multisig);
      updateDailyActiveMultisigs(event, multisig);
      updateGlobalMetrics(event);
    } else {
      log.error("Service {} not found for multisig {}", [
        multisig.serviceId.toString(),
        event.address.toHexString(),
      ]);
    }
  }
}

export function handleExecutionFromModuleSuccess(
  event: ExecutionFromModuleSuccess
): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    let service = Service.load(multisig.serviceId.toString());
    if (service != null) {
      updateDailyActivity(service, event, multisig);
      updateDailyUniqueAgents(event, multisig);
      updateDailyAgentPerformance(event, multisig);
      updateDailyActiveMultisigs(event, multisig);
      updateGlobalMetrics(event);
    } else {
      log.error("Service {} not found for multisig {}", [
        multisig.serviceId.toString(),
        event.address.toHexString(),
      ]);
    }
  }
}
