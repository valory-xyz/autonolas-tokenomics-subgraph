import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  CreateService,
  RegisterInstance,
  TerminateService,
  UpdateService,
} from "../generated/ServiceRegistry/ServiceRegistry";
import {
  ExecutionSuccess,
  ExecutionFromModuleSuccess,
} from "../generated/templates/GnosisSafe/GnosisSafe";
import {
  Multisig,
  Service,
  DailyMultisigActivity,
  DailyActiveAgent,
  DailyAgentActivity,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

function getDailyActivityId(multisigId: string, event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-"
    .concat(dayTimestamp.toString())
    .concat("-multisig-")
    .concat(multisigId);
}

function getDailyActiveAgentId(event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-".concat(dayTimestamp.toString());
}

function getDailyAgentActivityId(
  event: ethereum.Event,
  agentId: BigInt,
): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-"
    .concat(dayTimestamp.toString())
    .concat("-agent-")
    .concat(agentId.toString());
}

function updateDailyAgentActivity(
  event: ethereum.Event,
  service: Service,
): void {
  const dayTimestamp = getDayTimestamp(event);
  for (let i = 0; i < service.agentIds.length; i++) {
    const agentId = service.agentIds[i];
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

function updateDailyActiveAgents(
  event: ethereum.Event,
  service: Service,
): void {
  const id = getDailyActiveAgentId(event);
  let dailyActiveAgent = DailyActiveAgent.load(id);

  if (dailyActiveAgent == null) {
    dailyActiveAgent = new DailyActiveAgent(id);
    dailyActiveAgent.dayTimestamp = getDayTimestamp(event);
    dailyActiveAgent.count = 0;
    dailyActiveAgent.agentIds = [];
  }

  const newAgentIds: Array<i32> = [];
  for (let i = 0; i < service.agentIds.length; i++) {
    const agentId = service.agentIds[i];
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

function updateDailyMultisigActivity(
  multisig: Multisig,
  event: ethereum.Event,
): void {
  const id = getDailyActivityId(multisig.id.toHexString(), event);
  const dailyActivity = DailyMultisigActivity.load(id);

  if (dailyActivity == null) {
    const newDailyActivity = new DailyMultisigActivity(id);
    newDailyActivity.multisig = multisig.id;
    newDailyActivity.dayTimestamp = getDayTimestamp(event);
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

  if (service != null) {
    // Update Service entity
    service.multisig = multisigAddress;
    service.save();

    // Create Multisig entity if it does not exist, otherwise update it
    if (multisig == null) {
      multisig = new Multisig(multisigAddress);
      multisig.creator = event.transaction.from;
      multisig.creationTimestamp = event.block.timestamp;
      GnosisSafeTemplate.create(event.params.multisig);
    }
    multisig.serviceId = event.params.serviceId.toI32();
    multisig.txHash = event.transaction.hash;
    multisig.save();
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

export function handleUpdateService(event: UpdateService): void {
  let service = Service.load(event.params.serviceId.toString());
  if (service != null) {
    // Clear the agentIds when service is updated
    // New registrations after this point will be considered "latest"
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
      updateDailyMultisigActivity(multisig, event);
      updateDailyActiveAgents(event, service);
      updateDailyAgentActivity(event, service);
    } else {
      log.error("Service {} not found for multisig {}", [
        serviceId,
        event.address.toHexString(),
      ]);
    }
  }
}

export function handleExecutionFromModuleSuccess(
  event: ExecutionFromModuleSuccess,
): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    let serviceId = multisig.serviceId.toString();
    let service = Service.load(serviceId);
    if (service != null) {
      updateDailyMultisigActivity(multisig, event);
      updateDailyActiveAgents(event, service);
      updateDailyAgentActivity(event, service);
    } else {
      log.error("Service {} not found for multisig {}", [
        serviceId,
        event.address.toHexString(),
      ]);
    }
  }
}
