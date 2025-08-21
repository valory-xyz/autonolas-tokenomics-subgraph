import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  CreateService,
  RegisterInstance,
  TerminateService,
} from "../../common/generated/ServiceRegistryL2/ServiceRegistryL2";
import {
  ExecutionSuccess,
  ExecutionFromModuleSuccess,
} from "../../common/generated/templates/GnosisSafe/GnosisSafe";
import {
  Multisig,
  Service,
} from "../../common/generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../../common/generated/templates";
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
  getHistoricalData,
  createServiceMultisigHistory,
  createAgentMultisigHistory,
  createServiceAgentHistory,
} from "../../common/utils";

import { ServiceAgentHistory, ServiceMultisigHistory, AgentMultisigHistory } from "../../common/generated/schema";

function updateDailyAgentPerformance(
  event: ethereum.Event,
  multisig: Multisig
): void {
  // Process each agent associated with this multisig
  for (let i = 0; i < multisig.currentAgentIds.length; i++) {
    const agentId = multisig.currentAgentIds[i];
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
  for (let i = 0; i < multisig.currentAgentIds.length; i++) {
    const agentId = multisig.currentAgentIds[i];
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
  dailyActivity.agentIds = multisig.currentAgentIds;
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
  if (!service.currentAgentIds.includes(newAgentId)) {
    let agentIds = service.currentAgentIds;
    agentIds.push(newAgentId);
    service.currentAgentIds = agentIds;

    // Create historical record for agent change
    createServiceAgentHistory(
      event.params.serviceId.toString(),
      service.currentAgentIds,
      event.block.timestamp
    );
  }
  service.save();
}

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let service = Service.load(event.params.serviceId.toString());

  if (service != null) {
    const multisig = getOrCreateMultisig(event.params.multisig, event);
    service.currentMultisig = multisig.id;
    service.save();

    GnosisSafeTemplate.create(event.params.multisig);

    multisig.currentServiceId = event.params.serviceId.toI32();
    multisig.txHash = event.transaction.hash;

    // Use the most recently registered agent instead of all agents
    // This matches the SQL query logic to prevent double counting
    const mostRecentAgentId = getMostRecentAgentId(
      event.params.serviceId.toI32(),
      service.currentAgentIds,
      event.block.timestamp
    );

    let currentAgentIds: i32[] = [];
    if (mostRecentAgentId != -1) {
      currentAgentIds = [mostRecentAgentId];
    } else {
      // Fallback to existing logic if no agent found
      log.warning("No recent agent found for service {}, using all agents", [
        event.params.serviceId.toString(),
      ]);
      currentAgentIds = service.currentAgentIds;
    }
    multisig.currentAgentIds = currentAgentIds;

    // Create historical records
    createServiceMultisigHistory(
      event.params.serviceId.toString(),
      multisig,
      event.block.timestamp
    );

    createAgentMultisigHistory(
      multisig,
      currentAgentIds,
      event.block.timestamp
    );

    createServiceAgentHistory(
      event.params.serviceId.toString(),
      currentAgentIds,
      event.block.timestamp
    );

    multisig.save();
  }
}

export function handleTerminateService(event: TerminateService): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service != null) {
    service.currentAgentIds = [];
    // Create historical record for termination
    createServiceAgentHistory(
      event.params.serviceId.toString(),
      [],
      event.block.timestamp
    );
    service.save();
  }
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    const historicalData = getHistoricalData(multisig, event.block.timestamp);

    if (historicalData != null) {
      let service = Service.load(historicalData.serviceId.toString());
      if (service != null) {
        // Temporarily set the historical agent IDs for processing this event
        const latestAgentIds = multisig.currentAgentIds;
        multisig.currentAgentIds = historicalData.agentIds;

        updateDailyActivity(service, event, multisig);
        updateDailyUniqueAgents(event, multisig);
        updateDailyAgentPerformance(event, multisig);
        updateDailyActiveMultisigs(event, multisig);
        updateGlobalMetrics(event);

        // Restore agentIds to the latest state
        multisig.currentAgentIds = latestAgentIds;
      } else {
        log.error("Service {} not found for multisig {} at timestamp {}", [
          historicalData.serviceId.toString(),
          event.address.toHexString(),
          event.block.timestamp.toString(),
        ]);
      }
    } else {
      log.warning(
        "Could not find historical service/agent data for multisig {} at timestamp {}",
        [event.address.toHexString(), event.block.timestamp.toString()]
      );
    }
  }
}

export function handleExecutionFromModuleSuccess(
  event: ExecutionFromModuleSuccess
): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    const historicalData = getHistoricalData(multisig, event.block.timestamp);

    if (historicalData != null) {
      let service = Service.load(historicalData.serviceId.toString());
      if (service != null) {
        // Temporarily set the historical agent IDs for processing this event
        const latestAgentIds = multisig.currentAgentIds;
        multisig.currentAgentIds = historicalData.agentIds;

        updateDailyActivity(service, event, multisig);
        updateDailyUniqueAgents(event, multisig);
        updateDailyAgentPerformance(event, multisig);
        updateDailyActiveMultisigs(event, multisig);
        updateGlobalMetrics(event);

        // Restore agentIds to the latest state
        multisig.currentAgentIds = latestAgentIds;
      } else {
        log.error("Service {} not found for multisig {} at timestamp {}", [
          historicalData.serviceId.toString(),
          event.address.toHexString(),
          event.block.timestamp.toString(),
        ]);
      }
    } else {
      log.warning(
        "Could not find historical service/agent data for multisig {} at timestamp {}",
        [event.address.toHexString(), event.block.timestamp.toString()]
      );
    }
  }
}
