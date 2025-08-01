import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { ExecCall, RequestCall } from "../generated/templates/LegacyMech/AgentMech";
import { CreateMech } from "../generated/LegacyMechFactory1/Factory";
import { LegacyMech, Global } from "../generated/schema";
import { LegacyMech as LegacyMechTemplate } from "../generated/templates";

const BURNER_ADDRESS = Address.fromString("0x153196110040a0c729227c603db3a6c6d91851b2");


export function handleCreateMech(event: CreateMech): void {

  log.info("CreateMech Txn Hash: {}", [event.transaction.hash.toHexString()]);
  log.info("CreateMech Destination: {}", [event.transaction.to!.toHexString()]);

  const mechAddress = event.params.mech;
  const agentId = event.params.agentId;

  if (LegacyMech.load(mechAddress) != null) {
    return;
  }
  
  const mech = new LegacyMech(mechAddress);
  mech.totalFeesIn = BigInt.fromI32(0);
  mech.totalFeesOut = BigInt.fromI32(0);
  mech.agentId = agentId.toI32();
  mech.save();
  
  LegacyMechTemplate.create(mechAddress);
}


export function handleExec(call: ExecCall): void {
  
  log.info("Exec Txn Hash: {}", [call.transaction.hash.toHexString()]);
  log.info("Exec Destination: {}", [call.to.toHexString()]);
  log.info("Exec Value: {}", [call.inputs.value.toString()]);

  const destination = call.inputs.to;
  const amount = call.inputs.value;
  
  if (destination.equals(BURNER_ADDRESS)) {
    return;
  }
  
  if (amount.equals(BigInt.fromI32(0))) {
    return;
  }
  
  const mechAddress = call.to;
  const mech = LegacyMech.load(mechAddress);
  if (mech == null) { return; }
  
  mech.totalFeesOut = mech.totalFeesOut.plus(amount);
  mech.save();
  
  let global = Global.load("global");
  if (global == null) {
    global = new Global("global");
    global.totalFeesIn = BigInt.fromI32(0);
    global.totalFeesOut = BigInt.fromI32(0);
  }
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.save();
}


export function handleRequest(call: RequestCall): void {

  log.info("Request Txn Hash: {}", [call.transaction.hash.toHexString()]);
  log.info("Request Destination: {}", [call.to.toHexString()]);
  log.info("Request Value: {}", [call.transaction.value.toString()]);

  const amount = call.transaction.value;

  if (amount.equals(BigInt.fromI32(0))) {
    return;
  }
  
  const mechAddress = call.to;
  const mech = LegacyMech.load(mechAddress);
  if (mech == null) { return; }
  
  mech.totalFeesIn = mech.totalFeesIn.plus(amount);
  mech.save();
  
  let global = Global.load("global");
  if (global == null) {
    global = new Global("global");
    global.totalFeesIn = BigInt.fromI32(0);
    global.totalFeesOut = BigInt.fromI32(0);
  }
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.save();
}