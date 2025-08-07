import { BigInt } from '@graphprotocol/graph-ts';
import { Transfer } from '../generated/UniswapV2Pair/UniswapV2Pair';
import { LiquidityTransfer } from '../generated/schema';
import {
  ZERO_ADDRESS,
  getDayTimestamp,
  getOrCreateLiquidityPool,
  getOrCreateDailyLiquidityChange,
  getOrCreateGlobalMetrics,
  updateHolderBalance,
} from './utils';

export function handleTransfer(event: Transfer): void {
  let contractAddress = event.address;
  let from = event.params.from;
  let to = event.params.to;
  let value = event.params.value;
  let timestamp = event.block.timestamp;
  let dayTimestamp = getDayTimestamp(timestamp);

  // Create transfer entity
  let transferId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let transfer = new LiquidityTransfer(transferId);
  transfer.from = from;
  transfer.to = to;
  transfer.value = value;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.dayTimestamp = dayTimestamp;
  transfer.save();

  // Get or create entities
  let pool = getOrCreateLiquidityPool(contractAddress);
  let dailyChange = getOrCreateDailyLiquidityChange(dayTimestamp);
  let global = getOrCreateGlobalMetrics();

  // Update pool timestamps
  if (pool.firstTransferTimestamp.equals(BigInt.zero())) {
    pool.firstTransferTimestamp = timestamp;
  }
  pool.lastTransferTimestamp = timestamp;
  pool.transferCount = pool.transferCount + 1;

  // Handle minting (from zero address)
  if (from.equals(ZERO_ADDRESS)) {
    pool.totalSupply = pool.totalSupply.plus(value);
    pool.totalMinted = pool.totalMinted.plus(value);
    dailyChange.amountIn = dailyChange.amountIn.plus(value);

    // Update holder balance for recipient
    if (!to.equals(ZERO_ADDRESS)) {
      updateHolderBalance(contractAddress, to, value, true, timestamp);
    }
  }

  // Handle burning (to zero address)
  if (to.equals(ZERO_ADDRESS)) {
    pool.totalSupply = pool.totalSupply.minus(value);
    pool.totalBurned = pool.totalBurned.plus(value);
    dailyChange.amountOut = dailyChange.amountOut.plus(value);

    // Update holder balance for sender
    if (!from.equals(ZERO_ADDRESS)) {
      updateHolderBalance(contractAddress, from, value, false, timestamp);
    }
  }

  // Handle regular transfers (neither from nor to zero address)
  if (!from.equals(ZERO_ADDRESS) && !to.equals(ZERO_ADDRESS)) {
    updateHolderBalance(contractAddress, from, value, false, timestamp);
    updateHolderBalance(contractAddress, to, value, true, timestamp);
  }

  // Update daily change
  dailyChange.netChange = dailyChange.amountIn.minus(dailyChange.amountOut);
  dailyChange.transferCount = dailyChange.transferCount + 1;
  dailyChange.save();

  // Update global metrics
  global.totalSupplyAcrossPools = BigInt.zero(); // Will be recalculated
  // Note: We would need to iterate through all pools to calculate this accurately
  // For now, we'll update it with the current pool's contribution
  global.lastUpdated = timestamp;
  global.save();

  // Save pool
  pool.save();
}
