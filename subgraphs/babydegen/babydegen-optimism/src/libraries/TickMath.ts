import { BigInt, log } from "@graphprotocol/graph-ts"
import { mostSignificantBit, MAX_UINT256, ZERO } from "./mostSignificantBit"

// Constants
const ONE = BigInt.fromI32(1)
const Q32 = BigInt.fromI32(2).pow(32)

/**
 * Helper function to multiply a value by a string literal and shift right by 128 bits
 * Adapted from Uniswap's mulShift function
 */
function mulShift(val: BigInt, mulBy: string): BigInt {
  // Safely convert mulBy from hex to decimal string if needed
  let mulByStr = mulBy
  if (mulBy.startsWith("0x")) {
    // For safety, use the decimal value directly based on the known constants
    if (mulBy == "0xfffcb933bd6fad37aa2d162d1a594001") {
      mulByStr = "340282366920938463463374607431768211456" // 2^128 - 1/sqrt(1.0001)
    } else if (mulBy == "0x100000000000000000000000000000000") {
      mulByStr = "340282366920938463463374607431768211456" // 2^128
    } else if (mulBy == "0xfff97272373d413259a46990580e213a") {
      mulByStr = "340282366920938463444927863358058659386"
    } else if (mulBy == "0xfff2e50f5f656932ef12357cf3c7fdcc") {
      mulByStr = "340282366920938463426012132904853621708"
    } else if (mulBy == "0xffe5caca7e10e4e61c3624eaa0941cd0") {
      mulByStr = "340282366920938463388174418176250650832"
    } else if (mulBy == "0xffcb9843d60f6159c9db58835c926644") {
      mulByStr = "340282366920938463312858859344898412100"
    } else if (mulBy == "0xff973b41fa98c081472e6896dfb254c0") {
      mulByStr = "340282366920938463163385285496958482752"
    } else if (mulBy == "0xff2ea16466c96a3843ec78b326b52861") {
      mulByStr = "340282366920938462868041657296010071137"
    } else if (mulBy == "0xfe5dee046a99a2a811c461f1969c3053") {
      mulByStr = "340282366920938462287798353553726322771"
    } else if (mulBy == "0xfcbe86c7900a88aedcffc83b479aa3a4") {
      mulByStr = "340282366920938461149141838622126584740"
    } else if (mulBy == "0xf987a7253ac413176f2b074cf7815e54") {
      mulByStr = "340282366920938458922275841753671720532"
    } else if (mulBy == "0xf3392b0822b70005940c7a398e4b70f3") {
      mulByStr = "340282366920938454560266354130767682803"
    } else if (mulBy == "0xe7159475a2c29b7443b29c7fa6e889d9") {
      mulByStr = "340282366920938446043148659470035353049"
    } else if (mulBy == "0xd097f3bdfd2022b8845ad8f792aa5825") {
      mulByStr = "340282366920938430558022890528860719141"
    } else if (mulBy == "0xa9f746462d870fdf8a65dc1f90e061e5") {
      mulByStr = "340282366920938402086512816164385043941"
    } else if (mulBy == "0x70d869a156d2a1b890bb3df62baf32f7") {
      mulByStr = "340282366920938351538842476285841455863"
    } else if (mulBy == "0x31be135f97d08fd981231505542fcfa6") {
      mulByStr = "340282366920938264403579622245411200934"
    } else if (mulBy == "0x9aa508b5b7a84e1c677de54f3e99bc9") {
      mulByStr = "340282366920936418110022900647197887433"
    } else if (mulBy == "0x5d6af8dedb81196699c329225ee604") {
      mulByStr = "340282366920931603954602188873598418436"
    } else if (mulBy == "0x2216e584f5fa1ea926041bedfe98") {
      mulByStr = "340282366920921843961680694252240079512"
    } else if (mulBy == "0x48a170391f7dc42444e8fa2") {
      mulByStr = "340282366920710652961462009793960468386"
    } else {
      log.warning("TickMath: Unknown hex constant: {}. Using decimal conversion", [mulBy])
      // Remove 0x prefix and convert to decimal (fallback only)
      const hex = mulBy.slice(2).toLowerCase()
      let decimal = BigInt.fromI32(0)
      
      for (let i = 0; i < hex.length; i++) {
        decimal = decimal.times(BigInt.fromI32(16))
        const charCode = hex.charCodeAt(i)
        if (charCode >= 48 && charCode <= 57) {
          // '0' to '9'
          decimal = decimal.plus(BigInt.fromI32(charCode - 48))
        } else if (charCode >= 97 && charCode <= 102) {
          // 'a' to 'f'
          decimal = decimal.plus(BigInt.fromI32(charCode - 87))
        } else {
          log.error("TickMath: Invalid hex character in {}", [mulBy])
          return BigInt.fromI32(0)
        }
      }
      mulByStr = decimal.toString()
    }
  }
  
  return val.times(BigInt.fromString(mulByStr)).rightShift(128)
}

/**
 * TickMath library for Uniswap V3 and Velodrome CL tick calculations
 * 
 * This is the official Uniswap V3 implementation adapted for The Graph's AssemblyScript environment.
 * 
 * Reference: https://github.com/Uniswap/v3-sdk/blob/main/src/utils/tickMath.ts
 */
export class TickMath {
  /**
   * The minimum tick that can be used on any pool.
   */
  static MIN_TICK: i32 = -887272
  
  /**
   * The maximum tick that can be used on any pool.
   */
  static MAX_TICK: i32 = -TickMath.MIN_TICK

  /**
   * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
   */
  static MIN_SQRT_RATIO: BigInt = BigInt.fromString("4295128739")
  
  /**
   * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
   */
  static MAX_SQRT_RATIO: BigInt = BigInt.fromString("1461446703485210103287273052203988822378723970342")

  /**
   * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  static getSqrtRatioAtTick(tick: i32): BigInt {
    // Validate tick is within allowed range and is an integer
    if (tick < TickMath.MIN_TICK || tick > TickMath.MAX_TICK) {
      log.warning("TickMath: Tick {} is outside valid range, clamping to valid range", [tick.toString()])
      tick = tick < TickMath.MIN_TICK ? TickMath.MIN_TICK : TickMath.MAX_TICK
    }
    
    const absTick: i32 = tick < 0 ? -tick : tick

    let ratio: BigInt
    
    // Initialize ratio based on the least significant bit of absTick
    if ((absTick & 0x1) != 0) {
      ratio = BigInt.fromString("340282366920938463463374607431768211456")
    } else {
      ratio = BigInt.fromString("340282366920938463463374607431768211456")
    }
    
    // Apply the bit operations for each bit position
    if ((absTick & 0x2) != 0) ratio = mulShift(ratio, "0xfff97272373d413259a46990580e213a")
    if ((absTick & 0x4) != 0) ratio = mulShift(ratio, "0xfff2e50f5f656932ef12357cf3c7fdcc")
    if ((absTick & 0x8) != 0) ratio = mulShift(ratio, "0xffe5caca7e10e4e61c3624eaa0941cd0")
    if ((absTick & 0x10) != 0) ratio = mulShift(ratio, "0xffcb9843d60f6159c9db58835c926644")
    if ((absTick & 0x20) != 0) ratio = mulShift(ratio, "0xff973b41fa98c081472e6896dfb254c0")
    if ((absTick & 0x40) != 0) ratio = mulShift(ratio, "0xff2ea16466c96a3843ec78b326b52861")
    if ((absTick & 0x80) != 0) ratio = mulShift(ratio, "0xfe5dee046a99a2a811c461f1969c3053")
    if ((absTick & 0x100) != 0) ratio = mulShift(ratio, "0xfcbe86c7900a88aedcffc83b479aa3a4")
    if ((absTick & 0x200) != 0) ratio = mulShift(ratio, "0xf987a7253ac413176f2b074cf7815e54")
    if ((absTick & 0x400) != 0) ratio = mulShift(ratio, "0xf3392b0822b70005940c7a398e4b70f3")
    if ((absTick & 0x800) != 0) ratio = mulShift(ratio, "0xe7159475a2c29b7443b29c7fa6e889d9")
    if ((absTick & 0x1000) != 0) ratio = mulShift(ratio, "0xd097f3bdfd2022b8845ad8f792aa5825")
    if ((absTick & 0x2000) != 0) ratio = mulShift(ratio, "0xa9f746462d870fdf8a65dc1f90e061e5")
    if ((absTick & 0x4000) != 0) ratio = mulShift(ratio, "0x70d869a156d2a1b890bb3df62baf32f7")
    if ((absTick & 0x8000) != 0) ratio = mulShift(ratio, "0x31be135f97d08fd981231505542fcfa6")
    if ((absTick & 0x10000) != 0) ratio = mulShift(ratio, "0x9aa508b5b7a84e1c677de54f3e99bc9")
    if ((absTick & 0x20000) != 0) ratio = mulShift(ratio, "0x5d6af8dedb81196699c329225ee604")
    if ((absTick & 0x40000) != 0) ratio = mulShift(ratio, "0x2216e584f5fa1ea926041bedfe98")
    if ((absTick & 0x80000) != 0) ratio = mulShift(ratio, "0x48a170391f7dc42444e8fa2")

    // If tick is positive, invert the ratio
    if (tick > 0) {
      ratio = MAX_UINT256.div(ratio)
    }

    // Convert back to Q96
    if (ratio.mod(Q32).gt(ZERO)) {
      return ratio.div(Q32).plus(ONE)
    } else {
      return ratio.div(Q32)
    }
  }

  /**
   * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
   * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
   * @param sqrtRatioX96 the sqrt ratio as a Q64.96 for which to compute the tick
   */
  static getTickAtSqrtRatio(sqrtRatioX96: BigInt): i32 {
    // Validate the input is within the valid range
    if (sqrtRatioX96.lt(TickMath.MIN_SQRT_RATIO) || sqrtRatioX96.ge(TickMath.MAX_SQRT_RATIO)) {
      log.warning("TickMath: sqrtRatioX96 {} is outside valid range", [sqrtRatioX96.toString()])
      
      if (sqrtRatioX96.lt(TickMath.MIN_SQRT_RATIO)) {
        return TickMath.MIN_TICK
      } else {
        return TickMath.MAX_TICK
      }
    }

    const sqrtRatioX128 = sqrtRatioX96.leftShift(32)
    const msb = mostSignificantBit(sqrtRatioX128)

    let r: BigInt
    if (msb >= 128) {
      r = sqrtRatioX128.rightShift(msb - 127)
    } else {
      r = sqrtRatioX128.leftShift(127 - msb)
    }

    let log_2: BigInt = BigInt.fromI32(msb - 128).leftShift(64)

    for (let i = 0; i < 14; i++) {
      r = r.times(r).rightShift(127)
      const f = r.rightShift(128)
      log_2 = log_2.bitOr(f.leftShift(63 - i))
      r = r.rightShift(f.toI32())
    }

    const log_sqrt10001 = log_2.times(BigInt.fromString("255738958999603826347141"))

    const tickLow = log_sqrt10001
      .minus(BigInt.fromString("3402992956809132418596140100660247210"))
      .rightShift(128)
      .toI32()
      
    const tickHigh = log_sqrt10001
      .plus(BigInt.fromString("291339464771989622907027621153398088495"))
      .rightShift(128)
      .toI32()

    return tickLow === tickHigh
      ? tickLow
      : TickMath.getSqrtRatioAtTick(tickHigh).le(sqrtRatioX96)
      ? tickHigh
      : tickLow
  }
}
