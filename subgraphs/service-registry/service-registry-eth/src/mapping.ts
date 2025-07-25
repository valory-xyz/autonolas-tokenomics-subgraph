import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  CreateService,
  RegisterInstance,
  TerminateService,
} from "../generated/ServiceRegistry/ServiceRegistry";
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
} from "./utils";

function updateDailyAgentPerformance(
  event: ethereum.Event,
  multisig: Multisig
): void {
  // Process each agent associated with this multisig
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    const entity = getOrCreateDailyAgentPerformance(event, agentId);

    // CRITICAL: Validate that this entity belongs to the correct agent
    // This prevents cross-agent contamination
    if (entity.agentId != agentId) {
      log.error(
        "CRITICAL BUG: Agent ID mismatch! Entity {} has agentId {} but expected {}",
        [entity.id, entity.agentId.toString(), agentId.toString()]
      );
      // Skip this update to prevent data corruption
      continue;
    }

    // Increment transaction count for this agent
    entity.txCount = entity.txCount + 1;
    entity.save();

    createDailyAgentMultisig(entity, multisig);

    // Update global agent entity
    const agent = getOrCreateAgentPerformance(agentId);
    agent.txCount = agent.txCount.plus(BigInt.fromI32(1));
    agent.save();
  }
}

function updateDailyUniqueAgents(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dailyUniqueAgents = getOrCreateDailyUniqueAgents(event);
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    const agent = getOrCreateAgentPerformance(agentId);
    createDailyUniqueAgent(dailyUniqueAgents, agent);
  }
}

function updateDailyActivity(
  service: Service,
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dailyActivity = getOrCreateDailyServiceActivity(service.id, event);
  dailyActivity.agentIds = multisig.agentIds;
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
  global.txCount = global.txCount.plus(
    BigInt.fromI32(1)
  );
  global.lastUpdated = event.block.timestamp;
  global.save();
}

export function handleCreateService(event: CreateService): void {
  getOrCreateService(event.params.serviceId);
}

export function handleRegisterInstance(event: RegisterInstance): void {
  let service = getOrCreateService(event.params.serviceId);
  service.agentIds = [event.params.agentId.toI32()];
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
    multisig.agentIds = service.agentIds;
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
