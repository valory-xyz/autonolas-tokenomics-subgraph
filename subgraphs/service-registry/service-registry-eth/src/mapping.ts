// src/mapping.ts
// This file contains the AssemblyScript functions that process blockchain events
// and update the entities defined in schema.graphql.

import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  // Import the specific event from the auto-generated types for the main contract
  CreateMultisigWithAgents
} from "../generated/ServiceRegistryL2/ServiceRegistryL2"
import {
  // Import the event from the auto-generated types for the template contract
  ExecutionSuccess
} from "../generated/templates/GnosisSafe/GnosisSafe"
import {
  // Import the entity types we defined in our schema
  Service,
  DailyActiveServiceCount,
  DailyServiceActivity
} from "../generated/schema"
import {
  // Import the template definition to create new dynamic data sources
  GnosisSafe as GnosisSafeTemplate
} from "../generated/templates"

/**
 * @dev Handles the `CreateMultisigWithAgents` event from the `ServiceRegistryL2` contract.
 * This function is responsible for creating a new `Service` entity and
 * dynamically starting to watch the new multisig address for activity.
 * @param event The `CreateMultisigWithAgents` event object.
 */
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
    service.save();

    // Start indexing the new multisig contract for activity events.
    GnosisSafeTemplate.create(event.params.multisig);
  }
}

/**
 * @dev Handles the `ExecutionSuccess` event from a service's Gnosis Safe multisig.
 * This function is triggered whenever any of the dynamically monitored services
 * successfully executes a transaction, which we define as "activity".
 * @param event The `ExecutionSuccess` event object.
 */
export function handleServiceActivity(event: ExecutionSuccess): void {
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
  // If `dailyActivity` was not null, we do nothing, because the service has already
  // been counted for today.
} 