import { BigInt, Address } from '@graphprotocol/graph-ts';
import {
  DailyLiquidityChange,
  LiquidityPool,
  LiquidityHolder,
  GlobalLiquidityMetrics,
} from '../generated/schema';

export const ZERO_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
);
export const SECONDS_PER_DAY = BigInt.fromI32(86400);
export const GLOBAL_ID = '';

/**
 * Get day timestamp by truncating to start of day
 */
export function getDayTimestamp(timestamp: BigInt): BigInt {
  return timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY);
}

/**
 * Convert BigInt to decimal with 18 decimals
 */
export function toDecimal(value: BigInt, decimals: i32 = 18): BigInt {
  let divisor = BigInt.fromI32(10).pow(decimals as u8);
  return value.div(divisor);
}

/**
 * Check if an address is the zero address
 */
export function isZeroAddress(address: Address): boolean {
  return address.equals(ZERO_ADDRESS);
}

/**
 * Generate unique ID for holder entity
 */
export function getHolderId(
  poolAddress: Address,
  holderAddress: Address
): string {
  return poolAddress.toHexString() + '_' + holderAddress.toHexString();
}

// Helper function to get or create global metrics
export function getOrCreateGlobalMetrics(): GlobalLiquidityMetrics {
  let global = GlobalLiquidityMetrics.load(GLOBAL_ID);
  if (global == null) {
    global = new GlobalLiquidityMetrics(GLOBAL_ID);
    global.totalPools = 0;
    global.totalSupplyAcrossPools = BigInt.zero();
    global.totalHolders = 0;
    global.lastUpdated = BigInt.zero();
  }
  return global;
}

// Helper function to get or create liquidity pool
export function getOrCreateLiquidityPool(address: Address): LiquidityPool {
  let pool = LiquidityPool.load(address);
  if (pool == null) {
    pool = new LiquidityPool(address);
    pool.totalSupply = BigInt.zero();
    pool.totalMinted = BigInt.zero();
    pool.totalBurned = BigInt.zero();
    pool.holderCount = 0;
    pool.transferCount = 0;
    pool.firstTransferTimestamp = BigInt.zero();
    pool.lastTransferTimestamp = BigInt.zero();

    // Update global metrics
    let global = getOrCreateGlobalMetrics();
    global.totalPools = global.totalPools + 1;
    global.save();
  }
  return pool;
}

// Helper function to get or create daily liquidity change
export function getOrCreateDailyLiquidityChange(
  dayTimestamp: BigInt
): DailyLiquidityChange {
  let id = dayTimestamp.toString();
  let dailyChange = DailyLiquidityChange.load(id);
  if (dailyChange == null) {
    dailyChange = new DailyLiquidityChange(id);
    dailyChange.dayTimestamp = dayTimestamp;
    dailyChange.amountIn = BigInt.zero();
    dailyChange.amountOut = BigInt.zero();
    dailyChange.netChange = BigInt.zero();
    dailyChange.transferCount = 0;
  }
  return dailyChange;
}

// Helper function to get or create liquidity holder
export function getOrCreateLiquidityHolder(
  poolAddress: Address,
  holderAddress: Address
): LiquidityHolder {
  let id = getHolderId(poolAddress, holderAddress);
  let holder = LiquidityHolder.load(id);
  if (holder == null) {
    holder = new LiquidityHolder(id);
    holder.pool = poolAddress;
    holder.holder = holderAddress;
    holder.balance = BigInt.zero();
    holder.firstTransferTimestamp = BigInt.zero();
    holder.lastTransferTimestamp = BigInt.zero();
  }
  return holder;
}

// Helper function to update holder balance
export function updateHolderBalance(
  poolAddress: Address,
  holderAddress: Address,
  amount: BigInt,
  isIncoming: boolean,
  timestamp: BigInt
): void {
  let holder = getOrCreateLiquidityHolder(poolAddress, holderAddress);
  let pool = getOrCreateLiquidityPool(poolAddress);

  // Track if this is a new holder
  let wasNewHolder = holder.balance.equals(BigInt.zero());

  // Update balance
  if (isIncoming) {
    holder.balance = holder.balance.plus(amount);
  } else {
    holder.balance = holder.balance.minus(amount);
  }

  // Update timestamps
  if (holder.firstTransferTimestamp.equals(BigInt.zero())) {
    holder.firstTransferTimestamp = timestamp;
  }
  holder.lastTransferTimestamp = timestamp;

  // Update holder count in pool
  let isNowHolder = holder.balance.gt(BigInt.zero());
  if (wasNewHolder && isNowHolder) {
    pool.holderCount = pool.holderCount + 1;
  } else if (!wasNewHolder && !isNowHolder) {
    pool.holderCount = pool.holderCount - 1;
  }

  holder.save();
  pool.save();
}
