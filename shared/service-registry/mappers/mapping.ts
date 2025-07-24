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
  Agent,
  Multisig,
  Service,
  DailyServiceActivity,
  DailyUniqueAgents,
  DailyAgentPerformance,
  DailyActiveMultisigs,
  GlobalMetrics,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

function getDailyActivityId(serviceId: string, event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-"
    .concat(dayTimestamp.toString())
    .concat("-service-")
    .concat(serviceId);
}

function getDailyUniqueAgentsId(event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-".concat(dayTimestamp.toString());
}

function getDailyAgentPerformanceId(
  event: ethereum.Event,
  agentId: BigInt
): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-"
    .concat(dayTimestamp.toString())
    .concat("-agent-")
    .concat(agentId.toString());
}

function updateDailyAgentPerformance(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dayTimestamp = getDayTimestamp(event);
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    const id = getDailyAgentPerformanceId(event, BigInt.fromI32(agentId));
    let entity = DailyAgentPerformance.load(id);

    if (entity == null) {
      entity = new DailyAgentPerformance(id);
      entity.agentId = agentId;
      entity.dayTimestamp = dayTimestamp;
      entity.txCount = 0;
      entity.activeMultisigs = [];
      entity.uniqueActiveMultisigCount = 0;
    }

    entity.txCount = entity.txCount + 1;

    if (!entity.activeMultisigs.includes(multisig.id)) {
      let multisigs = entity.activeMultisigs;
      multisigs.push(multisig.id);
      entity.activeMultisigs = multisigs;
      entity.uniqueActiveMultisigCount = entity.activeMultisigs.length;
    }
    entity.save();

    // Update global agent entity
    let agent = Agent.load(agentId.toString());
    if (agent == null) {
      agent = new Agent(agentId.toString());
      agent.totalTxCount = BigInt.fromI32(0);
    }
    agent.totalTxCount = agent.totalTxCount.plus(BigInt.fromI32(1));
    agent.save();
  }
}

function updateDailyUniqueAgents(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const id = getDailyUniqueAgentsId(event);
  let dailyUniqueAgents = DailyUniqueAgents.load(id);

  if (dailyUniqueAgents == null) {
    dailyUniqueAgents = new DailyUniqueAgents(id);
    dailyUniqueAgents.dayTimestamp = getDayTimestamp(event);
    dailyUniqueAgents.count = 0;
    dailyUniqueAgents.agentIds = [];
  }

  const newAgentIds: Array<i32> = [];
  for (let i = 0; i < multisig.agentIds.length; i++) {
    const agentId = multisig.agentIds[i];
    if (!dailyUniqueAgents.agentIds.includes(agentId)) {
      newAgentIds.push(agentId);
    }
  }

  if (newAgentIds.length > 0) {
    dailyUniqueAgents.agentIds = dailyUniqueAgents.agentIds.concat(newAgentIds);
    dailyUniqueAgents.count = dailyUniqueAgents.agentIds.length;
  }

  dailyUniqueAgents.save();
}

function updateDailyActivity(
  service: Service,
  event: ethereum.Event,
  multisig: Multisig
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

function updateDailyActiveMultisigs(
  event: ethereum.Event,
  multisig: Multisig
): void {
  const dayTimestamp = getDayTimestamp(event);
  const dailyId = "day-" + dayTimestamp.toString();

  let dailyEntity = DailyActiveMultisigs.load(dailyId);
  if (dailyEntity == null) {
    dailyEntity = new DailyActiveMultisigs(dailyId);
    dailyEntity.dayTimestamp = dayTimestamp;
    dailyEntity.activeMultisigs = [];
    dailyEntity.count = 0;
  }

  if (!dailyEntity.activeMultisigs.includes(multisig.id)) {
    let multisigs = dailyEntity.activeMultisigs;
    multisigs.push(multisig.id);
    dailyEntity.activeMultisigs = multisigs;
    dailyEntity.count = dailyEntity.activeMultisigs.length;
  }
  dailyEntity.save();
}

function updateGlobalMetrics(event: ethereum.Event): void {
  let globalMetrics = GlobalMetrics.load("1");

  if (globalMetrics == null) {
    globalMetrics = new GlobalMetrics("1");
    globalMetrics.totalTxCount = BigInt.fromI32(0);
  }

  globalMetrics.totalTxCount = globalMetrics.totalTxCount.plus(
    BigInt.fromI32(1)
  );
  globalMetrics.lastUpdated = event.block.timestamp;
  globalMetrics.save();
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
    service.multisig = multisigAddress;
    service.save();

    if (multisig == null) {
      multisig = new Multisig(multisigAddress);
      multisig.creator = event.transaction.from;
      multisig.creationTimestamp = event.block.timestamp;
      GnosisSafeTemplate.create(event.params.multisig);
    }

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
