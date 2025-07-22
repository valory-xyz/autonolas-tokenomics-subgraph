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
  DailyServiceActivity,
  DailyActiveAgent,
  DailyAgentActivity,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

function getDailyActivityId(serviceId: string, event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-".concat(dayTimestamp.toString()).concat("-service-").concat(serviceId);
}

function getDailyActiveAgentId(event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-".concat(dayTimestamp.toString());
}

function getDailyAgentActivityId(
  event: ethereum.Event,
  agentId: BigInt
): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-"
    .concat(dayTimestamp.toString())
    .concat("-agent-")
    .concat(agentId.toString());
}

function updateDailyAgentActivity(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dayTimestamp = getDayTimestamp(event);
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    const id = getDailyAgentActivityId(event, BigInt.fromI32(agentId));
    let dailyAgentActivity = DailyAgentActivity.load(id);

    if (dailyAgentActivity == null) {
      dailyAgentActivity = new DailyAgentActivity(id);
      dailyAgentActivity.agentId = agentId;
      dailyAgentActivity.dayTimestamp = dayTimestamp;
      dailyAgentActivity.txCount = 0;
    }

    dailyAgentActivity.txCount = dailyAgentActivity.txCount + 1;
    dailyAgentActivity.save();
  }
}

function updateDailyActiveAgents(event: ethereum.Event, multisig: Multisig): void {
  const id = getDailyActiveAgentId(event);
  let dailyActiveAgent = DailyActiveAgent.load(id);

  if (dailyActiveAgent == null) {
    dailyActiveAgent = new DailyActiveAgent(id);
    dailyActiveAgent.dayTimestamp = getDayTimestamp(event);
    dailyActiveAgent.count = 0;
    dailyActiveAgent.agentIds = [];
  }

  const newAgentIds: Array<i32> = [];
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    if (!dailyActiveAgent.agentIds.includes(agentId)) {
      newAgentIds.push(agentId);
    }
  }

  if (newAgentIds.length > 0) {
    dailyActiveAgent.agentIds = dailyActiveAgent.agentIds.concat(newAgentIds);
    dailyActiveAgent.count = dailyActiveAgent.agentIds.length;
  }

  dailyActiveAgent.save();
}

function updateDailyActivity(
  service: Service,
  event: ethereum.Event,
  multisig: Multisig,
): void {
  const id = getDailyActivityId(service.id, event);
  const dailyActivity = DailyServiceActivity.load(id);

  if (dailyActivity == null) {
    const newDailyActivity = new DailyServiceActivity(id);
    newDailyActivity.service = service.id;
    newDailyActivity.dayTimestamp = getDayTimestamp(event);
    newDailyActivity.agentIds = multisig.agentIds;
    newDailyActivity.save();
  }
}

export function handleCreateService(event: CreateService): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service == null) {
    service = new Service(event.params.serviceId.toString());
    service.agentIds = [];
    service.save();
  }
}

export function handleRegisterInstance(event: RegisterInstance): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service != null) {
    service.agentIds = [event.params.agentId.toI32()];
    service.save();
  }
}

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let multisigAddress = event.params.multisig;
  let multisig = Multisig.load(multisigAddress);
  let service = Service.load(event.params.serviceId.toString());

  if (multisig == null && service != null) {
    // Update Service entity
    service.multisig = multisigAddress;
    service.save();

    // Create Multisig entity
    multisig = new Multisig(multisigAddress);
    multisig.serviceId = event.params.serviceId.toI32();
    multisig.creator = event.transaction.from;
    multisig.creationTimestamp = event.block.timestamp;
    multisig.txHash = event.transaction.hash;
    multisig.agentIds = service.agentIds; // Copy agent IDs from service
    multisig.save();

    GnosisSafeTemplate.create(event.params.multisig);
  }
}

export function handleTerminateService(event: TerminateService): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service != null) {
    // Clear the agentIds to prepare for a new deployment
    service.agentIds = [];
    service.save();
  }
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    let serviceId = multisig.serviceId.toString();
    let service = Service.load(serviceId);
    if (service != null) {
      let dailyActivityId = getDailyActivityId(serviceId, event);
      let dailyServiceActivity = DailyServiceActivity.load(dailyActivityId);

      if (dailyServiceActivity == null) {
        dailyServiceActivity = new DailyServiceActivity(dailyActivityId);
        dailyServiceActivity.service = service.id;
        dailyServiceActivity.dayTimestamp = getDayTimestamp(event);
        dailyServiceActivity.agentIds = multisig.agentIds;
        dailyServiceActivity.save();
      }

      updateDailyActiveAgents(event, multisig);
      updateDailyAgentActivity(event, multisig);
    } else {
      log.error("Service {} not found for multisig {}", [
        serviceId,
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
    let serviceId = multisig.serviceId.toString();
    let service = Service.load(serviceId);
    if (service != null) {
      let dailyActivityId = getDailyActivityId(serviceId, event);
      let dailyServiceActivity = DailyServiceActivity.load(dailyActivityId);

      if (dailyServiceActivity == null) {
        dailyServiceActivity = new DailyServiceActivity(dailyActivityId);
        dailyServiceActivity.service = service.id;
        dailyServiceActivity.dayTimestamp = getDayTimestamp(event);
        dailyServiceActivity.agentIds = multisig.agentIds;
        dailyServiceActivity.save();
      }

      updateDailyActiveAgents(event, multisig);
      updateDailyAgentActivity(event, multisig);
    } else {
      log.error("Service {} not found for multisig {}", [
        serviceId,
        event.address.toHexString(),
      ]);
    }
  }
} 