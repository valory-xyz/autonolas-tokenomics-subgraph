import { BigInt } from "@graphprotocol/graph-ts";
import { Global } from "../generated/schema";

export function getOrCreateGlobal(): Global {
  let global = Global.load("global");
  if (global == null) {
    global = new Global("global");
    global.totalFeesIn = BigInt.fromI32(0);
    global.totalFeesOut = BigInt.fromI32(0);
    global.totalFeesInLegacyMech = BigInt.fromI32(0);
    global.totalFeesInLegacyMechMarketPlace = BigInt.fromI32(0);
    global.totalFeesOutLegacyMech = BigInt.fromI32(0);
    global.totalFeesOutLegacyMechMarketPlace = BigInt.fromI32(0);
    global.save();
  }
  return global;
}

export function updateGlobalFeesInLegacyMech(amount: BigInt): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.totalFeesInLegacyMech = global.totalFeesInLegacyMech.plus(amount);
  global.save();
}

export function updateGlobalFeesInLegacyMechMarketPlace(amount: BigInt): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.totalFeesInLegacyMechMarketPlace = global.totalFeesInLegacyMechMarketPlace.plus(
    amount
  );
  global.save();
}

export function updateGlobalFeesOutLegacyMech(amount: BigInt): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.totalFeesOutLegacyMech = global.totalFeesOutLegacyMech.plus(amount);
  global.save();
}

export function updateGlobalFeesOutLegacyMechMarketPlace(
  amount: BigInt
): void {
  if (amount.le(BigInt.fromI32(0))) {
    return;
  }
  const global = getOrCreateGlobal();
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.totalFeesOutLegacyMechMarketPlace = global.totalFeesOutLegacyMechMarketPlace.plus(
    amount
  );
  global.save();
} 