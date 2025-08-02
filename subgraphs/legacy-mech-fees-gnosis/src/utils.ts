import { BigInt } from "@graphprotocol/graph-ts";
import { Global } from "../generated/schema";

export function getOrCreateGlobal(): Global {
  let global = Global.load("global");
  if (global == null) {
    global = new Global("global");
    global.totalFeesIn = BigInt.fromI32(0);
    global.totalFeesOut = BigInt.fromI32(0);
    global.save();
  }
  return global;
}

export function updateGlobalFeesIn(amount: BigInt): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.save();
}

export function updateGlobalFeesOut(amount: BigInt): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.save();
} 