import { BigDecimal } from "@graphprotocol/graph-ts";

// Ratios / Decimals used by new-mech-fees utils
export const TOKEN_RATIO_GNOSIS = BigDecimal.fromString("990000000000000000000000000000");
export const TOKEN_DECIMALS_GNOSIS = 18;

export const TOKEN_RATIO_BASE = BigDecimal.fromString("990000000000000000");
export const TOKEN_DECIMALS_BASE = 6;

export const CHAINLINK_PRICE_FEED_DECIMALS = 8;
export const ETH_DECIMALS = 18; 