import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Global } from "../generated/schema";

const GLOBAL_ID = "1";

function getOrInitialiseGlobal(): Global {
  let global = Global.load(GLOBAL_ID);
  if (global == null) {
    global = new Global(GLOBAL_ID);
    global.totalFeesIn = BigDecimal.fromString("0");
    global.totalFeesOut = BigDecimal.fromString("0");
  }
  return global;
}

export function updateTotalFeesIn(amount: BigDecimal): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.save();
}

export function updateTotalFeesOut(amount: BigDecimal): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.save();
} 