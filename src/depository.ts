import {
  BondCalculatorUpdated as BondCalculatorUpdatedEvent,
  CloseProduct as CloseProductEvent,
  CreateBond as CreateBondEvent,
  CreateProduct as CreateProductEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  RedeemBond as RedeemBondEvent,
  TokenomicsUpdated as TokenomicsUpdatedEvent,
  TreasuryUpdated as TreasuryUpdatedEvent,
} from "../generated/Depository/Depository";
import {
  CloseProduct as CloseProductOldEvent,
  CreateBond as CreateBondOldEvent,
  CreateProduct as CreateProductOldEvent,
} from "../generated/DepositoryOld/DepositoryOld";
import {
  BondCalculatorUpdated,
  CloseProduct,
  CreateBond,
  CreateProduct,
  Epoch,
  OwnerUpdated,
  RedeemBond,
  TokenomicsUpdated,
  TreasuryUpdated,
} from "../generated/schema";
import { FindEpochMapper, findEpochId } from "./mappings";

export function handleBondCalculatorUpdated(
  event: BondCalculatorUpdatedEvent
): void {
  let entity = new BondCalculatorUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.bondCalculator = event.params.bondCalculator;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleCloseProduct(event: CloseProductEvent): void {
  let entity = new CloseProduct(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;
  entity.supply = event.params.supply;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleCloseProductOld(event: CloseProductOldEvent): void {
  let entity = new CloseProduct(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleCreateBond(event: CreateBondEvent): void {
  let entity = new CreateBond(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;
  entity.owner = event.params.owner;
  entity.bondId = event.params.bondId;
  entity.amountOLAS = event.params.amountOLAS;
  entity.tokenAmount = event.params.tokenAmount;
  entity.maturity = event.params.maturity;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  const findEpochParams = new FindEpochMapper(event.block.number);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    entity.epoch = currentEpochId;

    const epoch = Epoch.load(currentEpochId);
    if (epoch) {
      // Update the total dev incentives topUp in the epoch
      if (!epoch.totalCreateBondsAmountOLAS) {
        epoch.totalCreateBondsAmountOLAS = event.params.amountOLAS;
      } else {
        epoch.totalCreateBondsAmountOLAS =
          epoch.totalCreateBondsAmountOLAS!.plus(event.params.amountOLAS);
      }

      epoch.save();
    }
  }

  entity.save();
}

export function handleCreateBondOld(event: CreateBondOldEvent): void {
  let entity = new CreateBond(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;
  entity.owner = event.params.owner;
  entity.bondId = event.params.bondId;
  entity.amountOLAS = event.params.amountOLAS;
  entity.tokenAmount = event.params.tokenAmount;
  entity.expiry = event.params.expiry;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  const findEpochParams = new FindEpochMapper(event.block.number);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    entity.epoch = currentEpochId;

    const epoch = Epoch.load(currentEpochId);
    if (epoch) {
      // Update the total dev incentives topUp in the epoch
      if (!epoch.totalCreateBondsAmountOLAS) {
        epoch.totalCreateBondsAmountOLAS = event.params.amountOLAS;
      } else {
        epoch.totalCreateBondsAmountOLAS =
          epoch.totalCreateBondsAmountOLAS!.plus(event.params.amountOLAS);
      }

      epoch.save();
    }
  }

  entity.save();
}

export function handleCreateProduct(event: CreateProductEvent): void {
  let entity = new CreateProduct(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;
  entity.supply = event.params.supply;
  entity.priceLP = event.params.priceLP;
  entity.vesting = event.params.vesting;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  const findEpochParams = new FindEpochMapper(event.block.number);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    entity.epoch = currentEpochId;

    const epoch = Epoch.load(currentEpochId);
    if (epoch) {
      // Update the total dev incentives topUp in the epoch
      if (!epoch.totalCreateProductsSupply) {
        epoch.totalCreateProductsSupply = event.params.supply;
      } else {
        epoch.totalCreateProductsSupply = epoch.totalCreateProductsSupply!.plus(
          event.params.supply
        );
      }

      epoch.save();
    }
  }

  entity.save();
}

export function handleCreateProductOld(event: CreateProductOldEvent): void {
  let entity = new CreateProduct(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.token = event.params.token;
  entity.productId = event.params.productId;
  entity.supply = event.params.supply;
  entity.priceLP = event.params.priceLP;
  entity.expiry = event.params.expiry;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  const findEpochParams = new FindEpochMapper(event.block.number);
  const currentEpochId = findEpochId(findEpochParams);
  if (currentEpochId) {
    entity.epoch = currentEpochId;

    const epoch = Epoch.load(currentEpochId);
    if (epoch) {
      // Update the total dev incentives topUp in the epoch
      if (!epoch.totalCreateProductsSupply) {
        epoch.totalCreateProductsSupply = event.params.supply;
      } else {
        epoch.totalCreateProductsSupply = epoch.totalCreateProductsSupply!.plus(
          event.params.supply
        );
      }

      epoch.save();
    }
  }

  entity.save();
}

export function handleOwnerUpdated(event: OwnerUpdatedEvent): void {
  let entity = new OwnerUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.owner = event.params.owner;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleRedeemBond(event: RedeemBondEvent): void {
  let entity = new RedeemBond(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.productId = event.params.productId;
  entity.owner = event.params.owner;
  entity.bondId = event.params.bondId;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleTokenomicsUpdated(event: TokenomicsUpdatedEvent): void {
  let entity = new TokenomicsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.tokenomics = event.params.tokenomics;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleTreasuryUpdated(event: TreasuryUpdatedEvent): void {
  let entity = new TreasuryUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.treasury = event.params.treasury;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
