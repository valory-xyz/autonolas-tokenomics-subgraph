import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { CreateMultisigWithAgents } from "../generated/ServiceRegistryL2-Debug/ServiceRegistryL2";
import {
  ExecutionSuccess,
  ExecutionFromModuleSuccess,
} from "../generated/templates/GnosisSafe-Debug/GnosisSafe";
import { Global, Multisig } from "../generated/schema";
import { GnosisSafe as GnosisSafeTemplate } from "../generated/templates";

// Helper to get or create the Global entity
function getOrCreateGlobal(): Global {
  let global = Global.load("");
  if (global == null) {
    global = new Global("");
    global.txCount = BigInt.fromI32(0);
  }
  return global;
}

export function handleCreateMultisig(event: CreateMultisigWithAgents): void {
  // Create the Multisig entity without any agent association
  let multisig = new Multisig(event.params.multisig);
  multisig.txCount = BigInt.fromI32(0);
  multisig.save();

  // Start listening to this new multisig for execution events
  GnosisSafeTemplate.create(event.params.multisig);
}

function handleExecution(event: ethereum.Event): void {
  let multisig = Multisig.load(event.address);
  if (multisig != null) {
    // Increment the multisig's specific transaction count
    multisig.txCount = multisig.txCount.plus(BigInt.fromI32(1));
    multisig.save();

    // Increment the global transaction count
    let global = getOrCreateGlobal();
    global.txCount = global.txCount.plus(BigInt.fromI32(1));
    global.save();
  }
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  handleExecution(event);
}

export function handleExecutionFromModuleSuccess(
  event: ExecutionFromModuleSuccess
): void {
  handleExecution(event);
} 