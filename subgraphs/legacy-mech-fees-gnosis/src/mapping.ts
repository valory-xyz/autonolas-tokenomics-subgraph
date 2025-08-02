import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ExecCall } from "../generated/templates/LegacyMech/AgentMech";
import { Request as RequestEvent } from "../generated/templates/LegacyMech/AgentMech";
import { CreateMech } from "../generated/LMFactory/Factory";
import {
  LegacyMech,
  Global,
  LegacyMechMarketPlace,
} from "../generated/schema";
import {
  LegacyMech as LegacyMechTemplate,
  LegacyMechMarketPlace as LegacyMechMarketPlaceTemplate,
} from "../generated/templates";
import { RequestCall as MarketPlaceRequestCall } from "../generated/LegacyMarketPlace/LegacyMarketPlace";
import {
  updateGlobalFeesIn,
  updateGlobalFeesOut,
} from "./utils";

const BURNER_ADDRESS = Address.fromString(
  "0x153196110040a0c729227c603db3a6c6d91851b2"
);

// Handler for standard Legacy Mechs
export function handleCreateMechLM(event: CreateMech): void {
  const mechAddress = event.params.mech;
  const agentId = event.params.agentId;
  const price = event.params.price;

  if (LegacyMech.load(mechAddress) != null) {
    return;
  }

  const mech = new LegacyMech(mechAddress);
  mech.totalFeesIn = BigInt.fromI32(0);
  mech.totalFeesOut = BigInt.fromI32(0);
  mech.agentId = agentId.toI32();
  mech.price = price;
  mech.save();

  LegacyMechTemplate.create(mechAddress);
}

// Handler for Legacy Market-Maker Mechs
export function handleCreateMechLMM(event: CreateMech): void {
  const mechAddress = event.params.mech;
  const agentId = event.params.agentId;
  const price = event.params.price;

  if (LegacyMechMarketPlace.load(mechAddress) != null) {
    return;
  }

  const mech = new LegacyMechMarketPlace(mechAddress);
  mech.totalFeesIn = BigInt.fromI32(0);
  mech.totalFeesOut = BigInt.fromI32(0);
  mech.agentId = agentId.toI32();
  mech.price = price;
  mech.save();

  LegacyMechMarketPlaceTemplate.create(mechAddress);
}

// Handler for outgoing transfers (both LM and LMM)
export function handleExec(call: ExecCall): void {
  const destination = call.inputs.to;
  const amount = call.inputs.value;

  if (destination.equals(BURNER_ADDRESS) || amount.equals(BigInt.fromI32(0))) {
    return;
  }

  const mechAddress = call.to;
  let feesOut = BigInt.fromI32(0);

  // Check if it's an LM or LMM and update accordingly
  const lm = LegacyMech.load(mechAddress);
  if (lm != null) {
    lm.totalFeesOut = lm.totalFeesOut.plus(amount);
    lm.save();
    feesOut = amount;
  } else {
    const lmm = LegacyMechMarketPlace.load(mechAddress);
    if (lmm != null) {
      lmm.totalFeesOut = lmm.totalFeesOut.plus(amount);
      lmm.save();
      feesOut = amount;
    }
  }

  updateGlobalFeesOut(feesOut);
}

// Event handler for direct requests to standard LMs
export function handleRequest(event: RequestEvent): void {
  const mechAddress = event.address;
  const mech = LegacyMech.load(mechAddress);
  if (mech == null) {
    return;
  }

  const fee = mech.price;
  mech.totalFeesIn = mech.totalFeesIn.plus(fee);
  mech.save();

  updateGlobalFeesIn(fee);
}

// Call handler for requests routed through the marketplace to LMMs
export function handleRequestFromMarketPlace(call: MarketPlaceRequestCall): void {
  const mechAddress = call.inputs.priorityMech;
  const mech = LegacyMechMarketPlace.load(mechAddress);
  if (mech == null) {
    return;
  }

  // The fee is the value sent with the transaction, which is only available in a call handler
  const fee = call.transaction.value;
  mech.totalFeesIn = mech.totalFeesIn.plus(fee);
  mech.save();

  updateGlobalFeesIn(fee);
}