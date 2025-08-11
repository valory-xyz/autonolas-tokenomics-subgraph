import { Address, BigInt } from "@graphprotocol/graph-ts"

// =============================================================================
// NETWORK-SPECIFIC CONSTANTS FOR OPTIMISM
// =============================================================================

// Token addresses (Optimism mainnet)
export const USDC_NATIVE = Address.fromString("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85") // Native USDC on Optimism
export const USDC_BRIDGED = Address.fromString("0x7F5c764cBc14f9669B88837ca1490cCa17c31607") // USDC.e (Bridged) on Optimism
export const USDT = Address.fromString("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58") // USDT
export const DAI = Address.fromString("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1") // DAI
export const LUSD = Address.fromString("0xc40F949F8a4e094D1b49a23ea9241D289B7b2819") // LUSD
export const WETH = Address.fromString("0x4200000000000000000000000000000000000006") // WETH
export const WBTC = Address.fromString("0x68f180fcCe6836688e9084f035309E29Bf0A2095") // WBTC
export const SUSD = Address.fromString("0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9") // sUSD

// Chainlink price feeds (Optimism mainnet)
export const ETH_USD_FEED = Address.fromString("0x13e3Ee699D1909E989722E753853AE30b17e08c5")
export const USDC_USD_FEED = Address.fromString("0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3")
export const USDT_USD_FEED = Address.fromString("0xECef79E109e997bCA29c1c0897ec9d7b03647F5E")
export const DAI_USD_FEED = Address.fromString("0x8dBa75e83DA73cc766A7e5a0ee71F656BAb470d6")

// DeFi protocol addresses
export const VELO_NFT_MANAGER = Address.fromString("0x416b433906b1B72FA758e166e239c43d68dC6F29")
export const VELO_V2_SUGAR = Address.fromString("0xA64db2D254f07977609def75c3A7db3eDc72EE1D")
export const VELO_V2_FACTORY = Address.fromString("0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a")

// OLAS-related addresses
export const OLAS_TOKEN = Address.fromString("0xFC2E6e6BCbd49ccf3A5f029c79984372DcBFE527")
export const STAKING_FACTORY = Address.fromString("0xa45E64d13A30a51b91ae0eb182e88a40e9b18eD8")

// Service configuration
export const OPTIMUS_AGENT_ID = BigInt.fromI32(40)

// Whitelisted tokens array (for easy iteration)
export const WHITELISTED_TOKENS: string[] = [
  USDC_NATIVE.toHexString(),
  LUSD.toHexString(),
  WETH.toHexString(),
  USDT.toHexString(),
  WBTC.toHexString(),
  SUSD.toHexString(),
  DAI.toHexString()
]

// Stablecoin addresses (for price fallbacks)
export const STABLECOINS: string[] = [
  USDC_NATIVE.toHexString(),
  USDC_BRIDGED.toHexString(),
  USDT.toHexString(),
  DAI.toHexString(),
  LUSD.toHexString()
]

// Critical stablecoins (for emergency fallbacks)
export const CRITICAL_STABLECOINS: string[] = [
  USDC_NATIVE.toHexString(),
  USDT.toHexString(),
  DAI.toHexString(),
  LUSD.toHexString()
]

// Known service safe addresses that require ETH balance tracking
// These are hardcoded because:
// 1. Service registry events may be missed during bootstrap
// 2. Historical services need retroactive tracking
// 3. Dynamic discovery is unreliable for existing services
export const KNOWN_SERVICE_SAFES: string[] = [
  "0xc8e264f402ae94f69bdef8b1f035f7200cd2b0c7", // Service 25
  "0xf38820f03313535a4024dccbe2689aa7cc158f5c", // Service 28
  "0xeb4b51e304a2bbfdb0f3003fd2ac6375518f7a32", // Service 26
  "0xe8c7bbf632bff7239e53dab45086ac14d6974bac", // Service 33
  "0xe4eaf37b1726634935f679a8f3e00ec2e4e650a0", // Service 20
  "0xd32613ed605be41d9c7fbc85f2ccb4fba59778ac", // Service 24
  "0xc7d89ed318cac02cf9719c50157541df2504ea3a", // Service 23
  "0xb0df5a11c1186201a588353f322128cb1fc1c6c7", // Service 27
  "0xa11417aebf3932ee895008ede8ea95616f488bcf", // Service 21
  "0x9f3abfc3301093f39c2a137f87c525b4a0832ba9", // Service 29
  "0x06d1f8cdb1f126f541e3dc28e7db200b5ebe00eb", // Service 18
  "0x9c5de7ad616aa088971b97ec6ad00f14abf73b2d", // Service 19
  "0x2a60adb8b0e6f27a9b88beca6a3a5e8b27a0d7b6", // Service 22
  "0xac8fb58f628e896c2b5e39c33d0f4e21e31a3e07", // Service 30
  "0xced32b616ad09c17e98bb2848ae16528e1c7a53d", // Service 31
  "0x080c2cf4090b24a31ad039f91b59e731fe37f7e5", // Service 32
  "0x5e6ad7767aae6c872fc969b30fced387bc5a43e9", // Service 34
  "0x9a088c9c8bf96b14e0f6fa86e6e6ad5bef013073", // Service 35
  "0xdfa40e24fb17fcd30fdf78fa97e732ffa55a6797", // Service 36
  "0x4c9f7f09c09bc9b7b6c0c3fb0c90c18b1e17b1ec", // Service 37
  "0xf3cbec2bb558f3e686bb8088bb2c7c98f8a9b8dc", // Service 38
  "0x89bb48fc2ced45abfadf00f4d5d5c2b01e95e3a7", // Service 39
  "0x088e7c6f1a56ce87837e9ca7c96fba1c638b6879"  // Service 40
]
