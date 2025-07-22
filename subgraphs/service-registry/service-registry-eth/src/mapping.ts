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
import { Multisig, Service, DailyServiceActivity } from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

function getDayTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp.div(ONE_DAY).times(ONE_DAY);
}

function getDailyActivityId(serviceId: string, event: ethereum.Event): string {
  const dayTimestamp = getDayTimestamp(event);
  return "day-".concat(dayTimestamp.toString()).concat("-service-").concat(serviceId);
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
    let agentIds = service.agentIds;
    agentIds.push(event.params.agentId.toI32());
    service.agentIds = agentIds;
    service.save();
  }
}

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let multisigAddress = event.params.multisig;
  let multisig = Multisig.load(multisigAddress);
  let service = Service.load(event.params.serviceId.toString());

  if (multisig == null && service != null) {
    multisig = new Multisig(multisigAddress);
    multisig.creator = event.transaction.from;
    multisig.creationTimestamp = event.block.timestamp;
    multisig.txHash = event.transaction.hash;
    multisig.agentIds = service.agentIds;
    multisig.service = service.id;
    multisig.save();

    // Clear the temporary agentIds from the service
    service.agentIds = [];
    service.save();

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
  const multisigAddress = event.address;
  const multisig = Multisig.load(multisigAddress);
  if (multisig == null) {
    // This can happen for older multisigs that are not part of any service
    return;
  }

  const service = Service.load(multisig.service);
  if (service == null) {
    log.error("Service {} not found for multisig {}", [
      multisig.service,
      multisigAddress.toHexString(),
    ]);
    return;
  }

  updateDailyActivity(service, event, multisig);
}

export function handleExecutionFromModuleSuccess(
  event: ExecutionFromModuleSuccess,
): void {
  const multisigAddress = event.address;
  const multisig = Multisig.load(multisigAddress);
  if (multisig == null) {
    // This can happen for older multisigs that are not part of any service
    return;
  }

  const service = Service.load(multisig.service);
  if (service == null) {
    log.error("Service {} not found for multisig {}", [
      multisig.service,
      multisigAddress.toHexString(),
    ]);
    return;
  }

  updateDailyActivity(service, event, multisig);
} 