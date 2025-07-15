import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Token, TokenHolder } from "./generated/schema";
import { Address, store } from "@graphprotocol/graph-ts";
import { EXCLUDED_ADDRESSES } from "./excludedAddresses";

const BIGINT_ZERO = BigInt.fromI32(0);
const ZERO_ADDRESS = Address.zero();

export function getOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress);

  if (token == null) {
    token = new Token(tokenAddress);
    token.balance = BIGINT_ZERO;
    token.holderCount = 0;
  }

  return token;
}

export function getOrCreateTokenHolder(
  tokenAddress: Address,
  holderAddress: Address
): TokenHolder {
  let holder = TokenHolder.load(holderAddress);

  if (holder == null) {
    holder = new TokenHolder(holderAddress);
    holder.token = tokenAddress;
    holder.balance = BIGINT_ZERO;
  }

  return holder;
}

function handleSenderBalance(
  token: Token,
  tokenAddress: Address,
  fromAddress: Address,
  amount: BigInt
): void {
  if (fromAddress.equals(ZERO_ADDRESS)) {
    // Mint
    token.balance = token.balance.plus(amount);
  } else {
    // Skip if address is in exclusion list
    if (EXCLUDED_ADDRESSES.includes(fromAddress)) {
      return;
    }

    let fromHolder = getOrCreateTokenHolder(tokenAddress, fromAddress);
    let oldBalance = fromHolder.balance;
    fromHolder.balance = fromHolder.balance.minus(amount);
    fromHolder.save();

    if (
      oldBalance.gt(BIGINT_ZERO) &&
      fromHolder.balance.equals(BIGINT_ZERO)
    ) {
      token.holderCount = token.holderCount! - 1;
      store.remove("TokenHolder", fromAddress.toHex());
    }
  }
}

function handleReceiverBalance(
  token: Token,
  tokenAddress: Address,
  toAddress: Address,
  amount: BigInt
): void {
  if (toAddress.equals(ZERO_ADDRESS)) {
    // Burn
    token.balance = token.balance.minus(amount);
  } else {
    // Skip if address is in exclusion list
    if (EXCLUDED_ADDRESSES.includes(toAddress)) {
      return;
    }

    let toHolder = getOrCreateTokenHolder(tokenAddress, toAddress);
    let oldBalance = toHolder.balance;
    toHolder.balance = toHolder.balance.plus(amount);
    toHolder.save();

    if (
      oldBalance.equals(BIGINT_ZERO) &&
      toHolder.balance.gt(BIGINT_ZERO)
    ) {
      token.holderCount = token.holderCount! + 1;
    }
  }
}

export function handleTransferBalances(
  tokenAddress: Address,
  fromAddress: Address,
  toAddress: Address,
  amount: BigInt
): void {
  let token = getOrCreateToken(tokenAddress);

  handleSenderBalance(token, tokenAddress, fromAddress, amount);
  handleReceiverBalance(token, tokenAddress, toAddress, amount);

  token.save();
} 