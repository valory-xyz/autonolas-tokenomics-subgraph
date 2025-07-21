import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  CreateMultisigWithAgents,
  RegisterInstance,
} from "../generated/ServiceRegistry/ServiceRegistry";
import {
  Multisig,
  Service,
  DailyActiveServiceCount,
  DailyServiceActivity,
  DailyActiveAgentCount,
  DailyAgentActivity,
} from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

const ONE_DAY = BigInt.fromI32(86400);

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let multisigAddress = event.params.multisig;
  let multisig = Multisig.load(multisigAddress);

  if (multisig == null) {
    let serviceId = event.params.serviceId.toString();
    let service = Service.load(serviceId);
    if (service == null) {
      service = new Service(serviceId);
    }

    multisig = new Multisig(multisigAddress);
    multisig.creator = event.transaction.from;
    multisig.creationTimestamp = event.block.timestamp;
    multisig.txHash = event.transaction.hash;
    multisig.agentIds = [];
    multisig.service = service.id;

    service.multisig = multisig.id;

    multisig.save();
    service.save();

    GnosisSafeTemplate.create(event.params.multisig);
  }
}

export function handleRegisterInstance(event: RegisterInstance): void {
  let serviceId = event.params.serviceId.toString();
  let service = Service.load(serviceId);

  if (service) {
    let multisig = Multisig.load(service.multisig);
    if (multisig) {
      let agentIds = multisig.agentIds;
      let agentId = event.params.agentId.toI32();
      if (!agentIds.includes(agentId)) {
        agentIds.push(agentId);
        multisig.agentIds = agentIds;
        multisig.save();
      }
    }
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

  let dailyActivityId = dayID.toString() + "-" + service.id;
  let dailyActivity = DailyServiceActivity.load(dailyActivityId);

  if (dailyActivity == null) {
    dailyActivity = new DailyServiceActivity(dailyActivityId);
    dailyActivity.service = service.id;
    dailyActivity.dayTimestamp = dayID;
    dailyActivity.save();

    let dailyCount = DailyActiveServiceCount.load(dayID.toString());
    if (dailyCount == null) {
      dailyCount = new DailyActiveServiceCount(dayID.toString());
      dailyCount.count = 0;
    }

    dailyCount.count = dailyCount.count + 1;
    dailyCount.save();
  }

  let agentIds = multisig.agentIds;
  for (let i = 0; i < agentIds.length; i++) {
    let agentId = agentIds[i];
    let dailyAgentActivityId =
      dayID.toString() +
      "-" +
      agentId.toString() +
      "-" +
      serviceAddress.toHexString();
    let dailyAgentActivity = DailyAgentActivity.load(dailyAgentActivityId);

    if (dailyAgentActivity == null) {
      dailyAgentActivity = new DailyAgentActivity(dailyAgentActivityId);
      dailyAgentActivity.save();

      let dailyActiveAgentCountId = dayID.toString() + "-" + agentId.toString();
      let dailyActiveAgentCount = DailyActiveAgentCount.load(
        dailyActiveAgentCountId
      );
      if (dailyActiveAgentCount == null) {
        dailyActiveAgentCount = new DailyActiveAgentCount(
          dailyActiveAgentCountId
        );
        dailyActiveAgentCount.dayTimestamp = dayID;
        dailyActiveAgentCount.agentId = agentId;
        dailyActiveAgentCount.count = 0;
      }
      dailyActiveAgentCount.count = dailyActiveAgentCount.count + 1;
      dailyActiveAgentCount.save();
    }
  }
} 