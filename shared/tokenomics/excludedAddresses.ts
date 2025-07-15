import { Address } from "@graphprotocol/graph-ts";

export const EXCLUDED_ADDRESSES: Address[] = [
  Address.fromString("0x0000000000000000000000000000000000000000"), // Zero address
  Address.fromString("0x88ad09518695c6c3712AC10a214bE5109a655671"), // Omnibridge EternalStorageProxy
  Address.fromString("0x87cc0d34f6111c8A7A4Bdf758a9a715A3675f941"), // Valory reserve
  Address.fromString("0x3C1fF68f5aa342D296d4DEe4Bb1cACCA912D95fE"), // Timelock
  Address.fromString("0x7e01A500805f8A52Fad229b3015AD130A332B7b3"), // veOLAS
  Address.fromString("0xb09ccf0dbf0c178806aaee28956c74bd66d21f73"), // buOLAS
]; 