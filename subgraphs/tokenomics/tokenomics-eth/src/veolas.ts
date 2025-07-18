import {
  Deposit,
  Withdraw,
} from "../generated/veOLAS/veOLAS";
import { VeolasDepositor } from "../generated/schema";
import { store } from "@graphprotocol/graph-ts";

export function handleDeposit(event: Deposit): void {
  let depositor = VeolasDepositor.load(event.params.account);
  if (depositor == null) {
    depositor = new VeolasDepositor(event.params.account);
  }
  depositor.unlockTimestamp = event.params.locktime;
  depositor.save();
}

export function handleWithdraw(event: Withdraw): void {
  let depositor = VeolasDepositor.load(event.params.account);
  if (depositor != null) {
    store.remove("VeolasDepositor", event.params.account.toHexString());
  }
} 