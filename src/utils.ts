import { BigInt } from "@graphprotocol/graph-ts";
import { Global } from "../generated/schema";

export function getGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.totalStakingRewardsClaimable = BigInt.fromI32(0);
    global.totalStakingRewardsClaimed = BigInt.fromI32(0);
  }
  return global as Global;
}
