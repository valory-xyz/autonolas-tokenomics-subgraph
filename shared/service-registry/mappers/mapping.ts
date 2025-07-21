import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  CreateMultisigWithAgents,
  RegisterInstance
} from "../generated/ServiceRegistryL2/ServiceRegistryL2"
import {
  Service,
  DailyActiveServiceCount,
  DailyServiceActivity,
  ServiceIdLink,
  DailyActiveAgentCount,
  DailyAgentActivity
} from "../generated/schema"
import {
  GnosisSafe as GnosisSafeTemplate
} from "../generated/templates"


export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  let serviceId = event.params.multisig;

  let service = Service.load(serviceId);

  if (service == null) {
    service = new Service(serviceId);
    service.creator = event.transaction.from;
    service.creationTimestamp = event.block.timestamp;
    service.txHash = event.transaction.hash;
    service.agentIds = [];
    service.save();

    let serviceIdLink = ServiceIdLink.load(event.params.serviceId.toString());
    if (serviceIdLink == null) {
      serviceIdLink = new ServiceIdLink(event.params.serviceId.toString());
    }
    serviceIdLink.service = service.id;
    serviceIdLink.save();

    GnosisSafeTemplate.create(event.params.multisig);
  }
}

export function handleRegisterInstance(event: RegisterInstance): void {
  let serviceIdLink = ServiceIdLink.load(event.params.serviceId.toString());

  if (serviceIdLink) {
    let service = Service.load(serviceIdLink.service);
    if (service) {
      let agentIds = service.agentIds;
      let agentId = event.params.agentId.toI32();
      if (!agentIds.includes(agentId)) {
        agentIds.push(agentId);
        service.agentIds = agentIds;
        service.save();
      }
    }
  }
}


export function handleServiceActivity(event: ethereum.Event): void {
  let timestamp = event.block.timestamp
  let dayID = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400))
  
  let serviceAddress = event.address

  let dailyActivityId = dayID.toString() + "-" + serviceAddress.toHexString()
  let dailyActivity = DailyServiceActivity.load(dailyActivityId)

  if (dailyActivity == null) {
    dailyActivity = new DailyServiceActivity(dailyActivityId)
    dailyActivity.service = serviceAddress 
    dailyActivity.dayTimestamp = dayID
    dailyActivity.save()

    let dailyCount = DailyActiveServiceCount.load(dayID.toString())
    if (dailyCount == null) {
      dailyCount = new DailyActiveServiceCount(dayID.toString())
      dailyCount.count = 0
    }

    dailyCount.count = dailyCount.count + 1
    dailyCount.save()
  }

  let service = Service.load(serviceAddress);
  if (service) {
    let agentIds = service.agentIds;
    for (let i = 0; i < agentIds.length; i++) {
      let agentId = agentIds[i];
      let dailyAgentActivityId = dayID.toString() + "-" + agentId.toString() + "-" + serviceAddress.toHexString();
      let dailyAgentActivity = DailyAgentActivity.load(dailyAgentActivityId);

      if (dailyAgentActivity == null) {
        dailyAgentActivity = new DailyAgentActivity(dailyAgentActivityId);
        dailyAgentActivity.save();

        let dailyActiveAgentCountId = dayID.toString() + "-" + agentId.toString();
        let dailyActiveAgentCount = DailyActiveAgentCount.load(dailyActiveAgentCountId);
        if (dailyActiveAgentCount == null) {
          dailyActiveAgentCount = new DailyActiveAgentCount(dailyActiveAgentCountId);
          dailyActiveAgentCount.dayTimestamp = dayID;
          dailyActiveAgentCount.agentId = agentId;
          dailyActiveAgentCount.count = 0;
        }
        dailyActiveAgentCount.count = dailyActiveAgentCount.count + 1;
        dailyActiveAgentCount.save();
      }
    }
  }
} 