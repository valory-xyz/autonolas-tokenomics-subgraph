import { BigInt } from "@graphprotocol/graph-ts";
import { Global } from "../generated/schema";

const GLOBAL_ID = "1";

function getOrInitialiseGlobal(): Global {
  let global = Global.load(GLOBAL_ID);
  if (global == null) {
    global = new Global(GLOBAL_ID);
    global.totalFeesIn = BigInt.fromI32(0);
    global.totalFeesOut = BigInt.fromI32(0);
  }
  return global;
}

export function updateTotalFeesIn(amount: BigInt): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesIn = global.totalFeesIn.plus(amount);
  global.save();
}

export function updateTotalFeesOut(amount: BigInt): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesOut = global.totalFeesOut.plus(amount);
  global.save();
}

export function convertWeiToUsd(
  amountInWei: BigInt,
  ethPrice: BigInt,
  priceFeedDecimals: number,
  ethDecimals: number
): BigInt {
  const priceDivisor = BigInt.fromI32(10).pow(priceFeedDecimals as u8);
  const ethDivisor = BigInt.fromI32(10).pow(ethDecimals as u8);

  return amountInWei.times(ethPrice).div(priceDivisor).div(ethDivisor);
} 