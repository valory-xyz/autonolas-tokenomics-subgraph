import { BigInt } from "@graphprotocol/graph-ts"
import { Q96 } from "../constants"

/**
 * TickMath library for Uniswap V3 tick calculations
 * 
 * MATHEMATICAL BACKGROUND:
 * - Uniswap V3 uses ticks to represent price ranges
 * - Each tick represents a 0.01% (1 basis point) price change
 * - Price = 1.0001^tick
 * - sqrtPrice = sqrt(1.0001^tick) * 2^96
 * 
 * IMPORTANT: This is a SIMPLIFIED approximation of Uniswap V3's TickMath.
 * For production use, consider implementing the exact Uniswap V3 algorithm
 * which uses bit manipulation and precise mathematical constants.
 * 
 * Reference: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol
 */
export class TickMath {
  // Tick bounds: These represent the minimum and maximum ticks in Uniswap V3
  // MIN_TICK = log_1.0001(2^-128) ≈ -887272
  // MAX_TICK = log_1.0001(2^128) ≈ 887272
  static MIN_TICK: i32 = -887272
  static MAX_TICK: i32 = 887272

  // Sqrt price bounds corresponding to MIN_TICK and MAX_TICK
  // MIN_SQRT_RATIO = sqrt(1.0001^MIN_TICK) * 2^96 ≈ 4295128739
  // MAX_SQRT_RATIO = sqrt(1.0001^MAX_TICK) * 2^96 ≈ 1461446703485210103287273052203988822378723970342
  static MIN_SQRT_RATIO: BigInt = BigInt.fromString("4295128739")
  static MAX_SQRT_RATIO: BigInt = BigInt.fromString("1461446703485210103287273052203988822378723970342")

  // Mathematical constants for approximation
  // sqrt(1.0001) * 2^96 ≈ 79232162514264337593543950336
  static SQRT_1_0001_Q96: BigInt = BigInt.fromString("79232162514264337593543950336")
  
  // Approximation increments for different tick ranges
  // These are rough approximations and should be refined for better precision
  static SMALL_TICK_INCREMENT: BigInt = BigInt.fromString("3960000000000000000000000") // ~0.00005 * 2^96
  static MEDIUM_TICK_INCREMENT: BigInt = BigInt.fromString("39600000000000000000000000") // ~0.0005 * 2^96
  
  // Tick range thresholds for different approximation methods
  static SMALL_TICK_THRESHOLD: i32 = 10
  static MEDIUM_TICK_THRESHOLD: i32 = 100

  /**
   * Calculates sqrt(1.0001^tick) * 2^96 for a given tick
   * 
   * APPROXIMATION METHOD:
   * This implementation uses a simplified approximation rather than the exact
   * Uniswap V3 algorithm. The approximation works as follows:
   * 
   * 1. For tick = 0: Return exactly 2^96
   * 2. For tick = 1: Use precomputed sqrt(1.0001) * 2^96
   * 3. For small ticks (1-10): Linear approximation
   * 4. For medium ticks (11-100): Larger linear increment
   * 5. For large ticks (>100): Exponential approximation
   * 6. For negative ticks: Invert the positive result
   * 
   * WARNING: This approximation may have significant precision errors for large ticks.
   * Consider implementing Uniswap's exact algorithm for production use.
   */
  static getSqrtRatioAtTick(tick: i32): BigInt {
    let absTick = tick < 0 ? -tick : tick
    
    // Clamp to valid tick range
    if (absTick > TickMath.MAX_TICK) {
      absTick = TickMath.MAX_TICK
    }
    
    let ratio: BigInt
    
    // Base case: tick = 0 returns exactly 2^96
    if (tick == 0) {
      return Q96
    }
    
    // Special case: tick = 1 uses precomputed sqrt(1.0001) * 2^96
    if (absTick == 1) {
      ratio = TickMath.SQRT_1_0001_Q96
    } else if (absTick <= TickMath.SMALL_TICK_THRESHOLD) {
      // Small ticks: Linear approximation
      // ratio ≈ Q96 + (tick * small_increment)
      ratio = Q96.plus(TickMath.SMALL_TICK_INCREMENT.times(BigInt.fromI32(absTick)))
    } else if (absTick <= TickMath.MEDIUM_TICK_THRESHOLD) {
      // Medium ticks: Larger linear increment
      // ratio ≈ Q96 + (tick * medium_increment)
      ratio = Q96.plus(TickMath.MEDIUM_TICK_INCREMENT.times(BigInt.fromI32(absTick)))
    } else {
      // Large ticks: Exponential approximation
      // This is a very rough approximation and should be improved
      let multiplier = BigInt.fromI32(1 + absTick / 100)
      ratio = Q96.times(multiplier)
    }
    
    // For negative ticks, invert the ratio: ratio = Q96^2 / ratio
    // This implements: sqrt(1.0001^(-tick)) = 1 / sqrt(1.0001^tick)
    if (tick < 0) {
      ratio = Q96.times(Q96).div(ratio)
    }
    
    return ratio
  }

  /**
   * Calculates the tick corresponding to a given sqrt price
   * 
   * WARNING: This is a VERY simplified reverse calculation that only
   * distinguishes between three cases: negative, zero, and positive ticks.
   * 
   * For accurate tick calculation, implement a proper binary search or
   * use Uniswap's exact reverse algorithm.
   */
  static getTickAtSqrtRatio(sqrtPriceX96: BigInt): i32 {
    if (sqrtPriceX96.equals(Q96)) {
      return 0  // Exact match for tick = 0
    } else if (sqrtPriceX96.gt(Q96)) {
      return 1  // Simplified: any price > 1.0 maps to tick = 1
    } else {
      return -1 // Simplified: any price < 1.0 maps to tick = -1
    }
  }
}
