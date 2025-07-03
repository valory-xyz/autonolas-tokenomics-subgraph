import { Transfer as TransferEvent } from "../generated/veOLAS/veOLAS";
import { Token } from "../generated/schema";
import { BigInt, Address } from "@graphprotocol/graph-ts";

const VEOLAS_ADDRESS = Address.fromString("0x7e01A500805f8A52Fad229b3015AD130A332B7b3");
const BIGINT_ZERO = BigInt.fromI32(0);

export function handleTransfer(event: TransferEvent): void {
  const from = event.params.from;
  const to = event.params.to;
  const value = event.params.value;

  // only track transfers to/from the veOLAS contract
  if (from.equals(VEOLAS_ADDRESS) || to.equals(VEOLAS_ADDRESS)) {
    let token = Token.load(VEOLAS_ADDRESS);
    if (token == null) {
      token = new Token(VEOLAS_ADDRESS);
      token.balance = BIGINT_ZERO;
    }

    // if 'to' is veOLAS contract, increase balance
    if (to.equals(VEOLAS_ADDRESS)) {
      token.balance = token.balance.plus(value);
    }

    // if 'from' is veOLAS contract, decrease balance
    if (from.equals(VEOLAS_ADDRESS)) {
      token.balance = token.balance.minus(value);
    }
    
    token.save();
  }
} 