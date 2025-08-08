import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Global, MechTransaction, Mech } from "./generated/schema";
import { 
  TOKEN_RATIO_GNOSIS,
  TOKEN_DECIMALS_GNOSIS,
  TOKEN_RATIO_BASE,
  TOKEN_DECIMALS_BASE,
  CHAINLINK_PRICE_FEED_DECIMALS,
  ETH_DECIMALS,
} from "./constants";
import { Address, Bytes, log } from "@graphprotocol/graph-ts";
import { BalancerV2Vault } from "./generated/BalanceTrackerFixedPriceToken/BalancerV2Vault";

const GLOBAL_ID = "1";
const FEE_IN = "FEE_IN";
const FEE_OUT = "FEE_OUT";

export function getOrInitialiseGlobal(): Global {
  let global = Global.load(GLOBAL_ID);
  if (global == null) {
    global = new Global(GLOBAL_ID);
    global.totalFeesInUSD = BigDecimal.fromString("0");
    global.totalFeesOutUSD = BigDecimal.fromString("0");
 }
  return global;
}

export function createMechTransactionForAccrued(
  mech: Mech,
  amountRaw: BigDecimal,
  amountUSD: BigDecimal,
  event: ethereum.Event,
  deliveryRate: BigInt,
  balance: BigInt,
  rateDiff: BigInt
): void {
  const transaction = new MechTransaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  transaction.mech = mech.id;
  transaction.type = FEE_IN;
  transaction.amountRaw = amountRaw;
  transaction.amountUSD = amountUSD;
  transaction.timestamp = event.block.timestamp;
  transaction.blockNumber = event.block.number;
  transaction.txHash = event.transaction.hash;
  transaction.deliveryRate = deliveryRate;
  transaction.balance = balance;
  transaction.rateDiff = rateDiff;
  transaction.save();
}

export function createMechTransactionForCollected(
  mech: Mech,
  amountRaw: BigDecimal,
  amountUSD: BigDecimal,
  event: ethereum.Event
): void {
  const transaction = new MechTransaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  transaction.mech = mech.id;
  transaction.type = FEE_OUT;
  transaction.amountRaw = amountRaw;
  transaction.amountUSD = amountUSD;
  transaction.timestamp = event.block.timestamp;
  transaction.blockNumber = event.block.number;
  transaction.txHash = event.transaction.hash;
  transaction.save();
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

// Helper function to get or initialize a mech entity
export function getOrInitializeMech(mechId: string): Mech {
  let mech = Mech.load(mechId);
  if (mech == null) {
    mech = new Mech(mechId);
    mech.totalFeesInUSD = BigDecimal.fromString("0");
    mech.totalFeesOutUSD = BigDecimal.fromString("0");
    mech.totalFeesInRaw = BigDecimal.fromString("0");
    mech.totalFeesOutRaw = BigDecimal.fromString("0");
  }
  return mech;
}

// Helper function to update mech fees in
export function updateMechFeesIn(mechId: string, amountUsd: BigDecimal, amountRaw: BigDecimal): void {
  const mech = getOrInitializeMech(mechId);
  mech.totalFeesInUSD = mech.totalFeesInUSD.plus(amountUsd);
  mech.totalFeesInRaw = mech.totalFeesInRaw.plus(amountRaw);
  mech.save();
}

// Helper function to update mech fees out
export function updateMechFeesOut(mechId: string, amountUsd: BigDecimal, amountRaw: BigDecimal): void {
  const mech = getOrInitializeMech(mechId);
  mech.totalFeesOutUSD = mech.totalFeesOutUSD.plus(amountUsd);
  mech.totalFeesOutRaw = mech.totalFeesOutRaw.plus(amountRaw);
  mech.save();
}

// Helper function to get token balances from Balancer pool
function getPoolTokenBalances(
  vault: BalancerV2Vault,
  poolId: Bytes,
  olasAddress: Address,
  stablecoinAddress: Address
): Array<BigInt> {
  const poolTokensResult = vault.try_getPoolTokens(poolId);
  
  if (poolTokensResult.reverted) {
    log.error("Could not get pool tokens for pool {}", [poolId.toHexString()]);
    return [BigInt.zero(), BigInt.zero()];
  }

  const tokens = poolTokensResult.value.getTokens();
  const balances = poolTokensResult.value.getBalances();
  
  let olasBalance = BigInt.zero();
  let stablecoinBalance = BigInt.zero();

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].equals(olasAddress)) {
      olasBalance = balances[i];
    } else if (tokens[i].equals(stablecoinAddress)) {
      stablecoinBalance = balances[i];
    }
  }
  
  return [olasBalance, stablecoinBalance];
}

// Helper function to calculate OLAS price from pool balances
function calculateOlasPriceFromPool(
  olasAmount: BigInt,
  olasBalance: BigInt,
  stablecoinBalance: BigInt,
  stablecoinDecimals: i32
): BigDecimal {
  const olasDecimalsBigInt = BigInt.fromI32(10).pow(18);
  const stablecoinDecimalsBigInt = BigInt.fromI32(10).pow(stablecoinDecimals as u8);
  
  const olasAmountDecimal = olasAmount.toBigDecimal().div(olasDecimalsBigInt.toBigDecimal());
  const olasBalanceDecimal = olasBalance.toBigDecimal().div(olasDecimalsBigInt.toBigDecimal());
  const stablecoinBalanceDecimal = stablecoinBalance.toBigDecimal().div(stablecoinDecimalsBigInt.toBigDecimal());
  
  const pricePerOlas = stablecoinBalanceDecimal.div(olasBalanceDecimal);
  return olasAmountDecimal.times(pricePerOlas);
}

// Common function for OLAS fees
export function calculateOlasInUsd(
  vaultAddress: Address,
  poolId: Bytes,
  olasAddress: Address,
  stablecoinAddress: Address,
  stablecoinDecimals: i32,
  olasAmount: BigInt
): BigDecimal {
  // Check for zero pool ID - return zero instead of fallback
  if (poolId.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"))) {
    log.warning("Zero pool ID provided for OLAS price calculation", []);
    return BigDecimal.fromString("0");
  }

  const vault = BalancerV2Vault.bind(vaultAddress);
  const balances = getPoolTokenBalances(vault, poolId, olasAddress, stablecoinAddress);
  const olasBalance = balances[0];
  const stablecoinBalance = balances[1];

  // Return zero if we can't get valid balances
  if (olasBalance.isZero() || stablecoinBalance.isZero()) {
    log.warning("Invalid pool balances for pool {}", [poolId.toHexString()]);
    return BigDecimal.fromString("0");
  }

  return calculateOlasPriceFromPool(olasAmount, olasBalance, stablecoinBalance, stablecoinDecimals);
} 