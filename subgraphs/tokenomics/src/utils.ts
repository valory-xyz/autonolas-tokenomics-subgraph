import { BigInt, Bytes, crypto } from "@graphprotocol/graph-ts";
import { Epoch } from "../generated/schema";



export function findEpochId(blockNumber: BigInt): string {
  // Find the current epoch based on the block number
  let epochCounter = 1;
  while (true) {
    let epochId = epochCounter.toString();
    let currentEpoch = Epoch.load(epochId);
    if (!currentEpoch) {
      break;
    }

    if (
      currentEpoch.startBlock.le(blockNumber) &&
      (currentEpoch.endBlock === null || currentEpoch.endBlock!.ge(blockNumber))
    ) {
      return currentEpoch.id;
    }

    epochCounter++;
  }

  return "";
}

function concat(a: Bytes, b: Bytes): Bytes {
  let out = new Uint8Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i];
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j];
  }
  return Bytes.fromUint8Array(out);
}

// Function to convert BigInt to a 32-byte Bytes
function bigIntToBytes(value: BigInt): Bytes {
  let byteArray = new Uint8Array(32);
  let data = value.toI32();
  for (let i = 0; i < 32; i++) {
    byteArray[31 - i] = <u8>(data & 0xff);
    data >>= 8;
  }
  return Bytes.fromUint8Array(byteArray);
}

// Returns keccak256 hash of stakingTarget and chainId
export function getNomineeHash(stakingTarget: Bytes, chainId: BigInt): Bytes {
  const chainIdBytes = bigIntToBytes(chainId);
  const concatenated = concat(stakingTarget, chainIdBytes);
  const result = crypto.keccak256(concatenated);

  return Bytes.fromUint8Array(result);
}
