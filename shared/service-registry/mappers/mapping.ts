// src/mapping.ts
// This file contains the AssemblyScript functions that process blockchain events
// and update the entities defined in schema.graphql.

import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import {
  // Import the specific event from the auto-generated types for the main contract
  CreateMultisigWithAgents,
  RegisterInstance
} from "../generated/ServiceRegistryL2/ServiceRegistryL2"
import {
  // Import the event from the auto-generated types for the template contract
  ExecutionSuccess
} from "../generated/templates/GnosisSafe/GnosisSafe"
import {
  // Import the entity types we defined in our schema
  Service,
  DailyActiveServiceCount,
  DailyServiceActivity,
  ServiceIdLink,
  DailyActiveAgentCount,
  DailyAgentActivity
} from "../generated/schema"
import {
  // Import the template definition to create new dynamic data sources
  GnosisSafe as GnosisSafeTemplate
} from "../generated/templates"


export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  // The multisig address is the unique ID for the service.
  let serviceId = event.params.multisig;

  // Check if the Service entity already exists.
  let service = Service.load(serviceId);

  // If the service does not exist, create it.
  // This prevents overwriting an existing immutable entity if the event is fired more than once
  // for the same multisig address.
  if (service == null) {
    service = new Service(serviceId);
    service.creator = event.transaction.from;
    service.creationTimestamp = event.block.timestamp;
    service.txHash = event.transaction.hash;
    service.agentIds = [];
    service.save();

    // Create or update the link between the serviceId and the service entity
    let serviceIdLink = ServiceIdLink.load(event.params.serviceId.toString());
    if (serviceIdLink == null) {
      serviceIdLink = new ServiceIdLink(event.params.serviceId.toString());
    }
    serviceIdLink.service = service.id;
    serviceIdLink.save();

    // Start indexing the new multisig contract for activity events.
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
  // Calculate the timestamp for the beginning of the day by using integer division.
  // 86400 is the number of seconds in a day.
  let dayID = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400))
  
  // The address of the contract that emitted this event is the service's multisig address.
  let serviceAddress = event.address

  // Create a unique ID for this day's activity for this specific service.
  // This replicates the `COUNT(DISTINCT service_address)` logic from your SQL query.
  let dailyActivityId = dayID.toString() + "-" + serviceAddress.toHexString()
  let dailyActivity = DailyServiceActivity.load(dailyActivityId)

  // If `dailyActivity` is null, it means this is the first time this service
  // has been active today. We should process it and update the daily count.
  if (dailyActivity == null) {
    // 1. Create the activity record to prevent future double-counting for this day.
    dailyActivity = new DailyServiceActivity(dailyActivityId)
    dailyActivity.service = serviceAddress // Link to the Service entity
    dailyActivity.dayTimestamp = dayID
    dailyActivity.save()

    // 2. Load or create the master counter for the day.
    // The ID is the day's start timestamp, converted to a string.
    let dailyCount = DailyActiveServiceCount.load(dayID.toString())
    if (dailyCount == null) {
      // If it's the first active service of the day, create the counter entity.
      dailyCount = new DailyActiveServiceCount(dayID.toString())
      dailyCount.count = 0
    }

    // 3. Increment the count of unique active services for the day and save.
    dailyCount.count = dailyCount.count + 1
    dailyCount.save()
  }

  // Handle agent-specific activity
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