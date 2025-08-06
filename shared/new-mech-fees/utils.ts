import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Global } from "./generated/schema";
import { 
  TOKEN_RATIO_GNOSIS,
  TOKEN_DECIMALS_GNOSIS,
  TOKEN_RATIO_BASE,
  TOKEN_DECIMALS_BASE,
  CHAINLINK_PRICE_FEED_DECIMALS,
  ETH_DECIMALS,
  BALANCER_VAULT_ADDRESS_GNOSIS,
  OLAS_WXDAI_POOL_ADDRESS_GNOSIS,
  OLAS_ADDRESS_GNOSIS,
  WXDAI_ADDRESS_GNOSIS
} from "../constants";
import { Address, Bytes } from "@graphprotocol/graph-ts";
import { BalancerV2Vault } from "./generated/BalanceTrackerFixedPriceToken/BalancerV2Vault";
import { log } from "@graphprotocol/graph-ts";

const GLOBAL_ID = "1";

export function getOrInitialiseGlobal(): Global {
  let global = Global.load(GLOBAL_ID);
  if (global == null) {
    global = new Global(GLOBAL_ID);
    global.totalFeesInUSD = BigDecimal.fromString("0");
    global.totalFeesOutUSD = BigDecimal.fromString("0");
  }
  return global;
}

export function updateTotalFeesIn(amount: BigDecimal): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesInUSD = global.totalFeesInUSD.plus(amount);
  global.save();
}

export function updateTotalFeesOut(amount: BigDecimal): void {
  const global = getOrInitialiseGlobal();
  global.totalFeesOutUSD = global.totalFeesOutUSD.plus(amount);
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

// For OLAS fees on Gnosis - working version
export function getOlasInUsd(
  vaultAddress: Address,
  poolId: Bytes,
  olasAddress: Address,
  wxdaiAddress: Address,
  olasAmount: BigInt
): BigDecimal {
  // Skip actual pool lookup if poolId is zero (our placeholder)
  if (poolId.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"))) {
    const fixedOlasPrice = BigDecimal.fromString("0.01");
    const olasDecimals = BigInt.fromI32(10).pow(18).toBigDecimal();
    return olasAmount.toBigDecimal().div(olasDecimals).times(fixedOlasPrice);
  }

  const vault = BalancerV2Vault.bind(vaultAddress);
  const poolTokensResult = vault.try_getPoolTokens(poolId);

  if (poolTokensResult.reverted) {
    log.warning("Could not get pool tokens for pool {}, using fallback price", [poolId.toHexString()]);
    const fallbackPrice = BigDecimal.fromString("0.01");
    const olasDecimals = BigInt.fromI32(10).pow(18).toBigDecimal();
    return olasAmount.toBigDecimal().div(olasDecimals).times(fallbackPrice);
  }

  const tokens = poolTokensResult.value.getTokens();
  const balances = poolTokensResult.value.getBalances();

  let olasBalance = BigInt.zero();
  let wxdaiBalance = BigInt.zero();

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].equals(olasAddress)) {
      olasBalance = balances[i];
    } else if (tokens[i].equals(wxdaiAddress)) {
      wxdaiBalance = balances[i];
    }
  }

  if (olasBalance.isZero()) {
    log.warning("OLAS balance is zero in pool {}, using fallback price", [poolId.toHexString()]);
    const fallbackPrice = BigDecimal.fromString("0.01");
    const olasDecimals = BigInt.fromI32(10).pow(18).toBigDecimal();
    return olasAmount.toBigDecimal().div(olasDecimals).times(fallbackPrice);
  }

  // Calculate price: (wxdaiBalance / olasBalance) * (olasAmount / 10^18)
  const olasDecimals = BigInt.fromI32(10).pow(18);
  const wxdaiDecimals = BigInt.fromI32(10).pow(18);
  
  // Convert to proper decimal values
  const olasAmountDecimal = olasAmount.toBigDecimal().div(olasDecimals.toBigDecimal());
  const olasBalanceDecimal = olasBalance.toBigDecimal().div(olasDecimals.toBigDecimal());
  const wxdaiBalanceDecimal = wxdaiBalance.toBigDecimal().div(wxdaiDecimals.toBigDecimal());
  
  const pricePerOlas = wxdaiBalanceDecimal.div(olasBalanceDecimal);
  
  return olasAmountDecimal.times(pricePerOlas);
} 