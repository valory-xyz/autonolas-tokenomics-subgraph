import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Global } from "./generated/schema";
import { 
  TOKEN_RATIO_GNOSIS,
  TOKEN_DECIMALS_GNOSIS,
  TOKEN_RATIO_BASE,
  TOKEN_DECIMALS_BASE,
  CHAINLINK_PRICE_FEED_DECIMALS,
  ETH_DECIMALS
} from "../constants";

const GLOBAL_ID = "1";

export function getOrInitialiseGlobal(): Global {
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

// For native fees on Gnosis
export function convertGnosisNativeWeiToUsd(amountInWei: BigInt): BigDecimal {
  const ethDivisor = BigInt.fromI32(10).pow(ETH_DECIMALS as u8);
  return amountInWei.toBigDecimal().div(ethDivisor.toBigDecimal());
}

// For native fees on Base
export function convertBaseNativeWeiToUsd(
  amountInWei: BigInt,
  ethPrice: BigInt
): BigDecimal {
  const priceDivisor = BigInt.fromI32(10)
    .pow(CHAINLINK_PRICE_FEED_DECIMALS as u8)
    .toBigDecimal();
  const ethDivisor = BigInt.fromI32(10)
    .pow(ETH_DECIMALS as u8)
    .toBigDecimal();

  return amountInWei.toBigDecimal().times(ethPrice.toBigDecimal()).div(priceDivisor).div(ethDivisor);
}

// For NVM fees on Gnosis
export function calculateGnosisNvmFeesIn(deliveryRate: BigInt): BigDecimal {
  const tokenDivisor = BigInt.fromI32(10).pow(TOKEN_DECIMALS_GNOSIS as u8).toBigDecimal();
  const ethDivisor = BigInt.fromI32(10).pow(18).toBigDecimal();

  return deliveryRate.toBigDecimal()
    .times(TOKEN_RATIO_GNOSIS)
    .div(ethDivisor)
    .div(tokenDivisor);
}

// For NVM fees on Base
export function calculateBaseNvmFeesIn(deliveryRate: BigInt): BigDecimal {
  const tokenDivisor = BigInt.fromI32(10).pow(TOKEN_DECIMALS_BASE as u8).toBigDecimal();
  const ethDivisor = BigInt.fromI32(10).pow(18).toBigDecimal();

  return deliveryRate.toBigDecimal()
    .times(TOKEN_RATIO_BASE)
    .div(ethDivisor)
    .div(tokenDivisor);
}

// For NVM fees on Base converted to USD
export function calculateBaseNvmFeesInUsd(
  deliveryRate: BigInt,
  ethPrice: BigInt
): BigDecimal {
  // First calculate the NVM fee amount in ETH
  const feeInEth = calculateBaseNvmFeesIn(deliveryRate);
  
  // Then convert to USD using the ETH price from Chainlink
  const priceDivisor = BigInt.fromI32(10)
    .pow(CHAINLINK_PRICE_FEED_DECIMALS as u8)
    .toBigDecimal();
  
  return feeInEth.times(ethPrice.toBigDecimal()).div(priceDivisor);
}

// For USDC withdrawals on Base (assumes 1 USDC = 1 USD)
export function convertBaseUsdcToUsd(amountInUsdc: BigInt): BigDecimal {
  const usdcDivisor = BigInt.fromI32(10).pow(6).toBigDecimal(); // USDC has 6 decimals
  return amountInUsdc.toBigDecimal().div(usdcDivisor);
} 