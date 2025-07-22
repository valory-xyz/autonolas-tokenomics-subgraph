import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  CreateService,
  RegisterInstance,
  TerminateService,
} from "../generated/ServiceRegistryL2/ServiceRegistryL2";
import {
  Multisig,
  Service,
  DailyActiveServiceCount,
  DailyServiceActivity,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

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

export function handleServiceActivity(event: ethereum.Event): void {
  let timestamp = event.block.timestamp;
  let dayID = timestamp.div(ONE_DAY).times(ONE_DAY);
  
  let serviceAddress = event.address;
  let multisig = Multisig.load(serviceAddress);

  if (multisig == null) {
    return;
  }

  let service = Service.load(multisig.service);
  if (service == null) {
    return;
  }

  let dailyServiceActivityId = "day-".concat(dayID.toString()).concat("-service-").concat(service.id);
  let dailyServiceActivity = DailyServiceActivity.load(dailyServiceActivityId);

  if (dailyServiceActivity == null) {
    const newDailyActivity = new DailyServiceActivity(dailyServiceActivityId);
    newDailyActivity.service = service.id;
    newDailyActivity.dayTimestamp = dayID;
    newDailyActivity.save();

    let dailyActiveServiceCountId = "service-count";
    let dailyActiveServiceCount = DailyActiveServiceCount.load(
      dailyActiveServiceCountId
    );
    if (dailyActiveServiceCount == null) {
      dailyActiveServiceCount = new DailyActiveServiceCount(
        dailyActiveServiceCountId
      );
      dailyActiveServiceCount.count = 0;
        }
    dailyActiveServiceCount.count += 1;
    dailyActiveServiceCount.save();
  }
} 