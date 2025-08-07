# New Mech Fees Subgraphs

A blockchain indexing system that tracks fees for autonomous agents (mechs) interacting with the new marketplace contracts. This system covers multiple payment models across Gnosis and Base networks.

## Overview

These subgraphs provide real-time tracking of every fee-in (accrual) and fee-out (collection) event for mechs. By logging each transaction, the subgraphs enable detailed time-based analysis, such as calculating daily and weekly fees per mech.

The system is split into six subgraphs, one for each combination of payment model and network.

## Subgraph Details

| Payment Model | Network | Balance Tracker Contract |
| :--- | :--- | :--- |
| **Native** | Gnosis (xdai) | `0x21cE6799A22A3Da84B7c44a814a9c79ab1d2A50D` |
| **Native** | Base | `0xB3921F8D8215603f0Bd521341Ac45eA8f2d274c1` |
| **NVM** | Gnosis (xdai) | `0x7D686bD1fD3CFF6E45a40165154D61043af7D67c` |
| **NVM** | Base | `0xaafbeef195bdab1bb6f3dc9ceba875cd72499230` |
| **Token (OLAS)** | Gnosis (xdai) | `0x53Bd432516707a5212A70216284a99A563aAC1D1` |
| **Token (OLAS)** | Base | `0x43fB32f25dce34EB76c78C7A42C8F40F84BCD237` |

## Core Entities

- **`Mech`**: Central entity for a mech, identified by its address. It stores the lifetime totals for fees in and out, both in raw units and USD.
- **`Global`**: A singleton entity that aggregates total fees in and out in USD across all mechs for a given subgraph.
- **`MechTransaction`**: A detailed record of every individual fee event (`MechBalanceAdjusted` or `Withdraw`). This is the core entity for time-based analysis. Each transaction is immutable.

## Fee Units (`amountRaw`)

The `amountRaw` field in the `MechTransaction` entity represents the transaction amount in its native unit. The table below specifies the units for each subgraph.

| Subgraph | Transaction Type | `amountRaw` Unit |
| :--- | :--- | :--- |
| **Native - Gnosis** | `FEE_IN` / `FEE_OUT` | xDAI (in wei, 10^18) |
| **Native - Base** | `FEE_IN` / `FEE_OUT` | ETH (in wei, 10^18) |
| **Token - Gnosis/Base**| `FEE_IN` / `FEE_OUT` | OLAS (in wei, 10^18) |
| **NVM - Gnosis** | `FEE_IN` / `FEE_OUT` | Credits (abstract units) |
| **NVM - Base** | `FEE_IN` / `FEE_OUT` | Credits (abstract units) |

### NVM Subgraphs Note

For NVM (subscription-based) subgraphs, both use a consistent credits-based approach:

**NVM - Gnosis:**
- **`FEE_IN`**: Stores credits directly from `MechBalanceAdjusted` events
- **`FEE_OUT`**: Converts xDAI withdrawals back to equivalent credits for consistency

**NVM - Base:**
- **`FEE_IN`**: Stores credits directly from `MechBalanceAdjusted` events  
- **`FEE_OUT`**: Converts USDC withdrawals back to equivalent credits for consistency

Both approaches ensure that `totalFeesInRaw` and `totalFeesOutRaw` are in the same units (credits) and can be meaningfully compared or aggregated.

To convert credits to tokens, use the `tokenCreditRatio` from the contract:
- **Gnosis**: `xdai_amount = (credits * 990000000000000000000000000000) / (1e18 * 1e18)`
- **Base**: `usdc_amount = (credits * 990000000000000000) / 1e18`

## Sample Queries

### Get Mech Lifetime Totals
This query fetches the total fees in and out for a specific mech over its entire lifetime.
```graphql
{
  mech(id: "0x...") {
    id
    totalFeesInUSD
    totalFeesOutUSD
    totalFeesInRaw
    totalFeesOutRaw
  }
}
```

### Get Daily Fee Transactions for a Mech
This query retrieves all fee transactions for a specific mech within a given time window (e.g., one day). The client can then aggregate these transactions to calculate the daily total.
```graphql
{
  mechTransactions(
    where: {
      mech: "0x...",
      timestamp_gte: "1672531200", # Start of day (Unix timestamp)
      timestamp_lt: "1672617600"  # End of day (Unix timestamp)
    },
    orderBy: timestamp,
    orderDirection: desc
  ) {
    id
    type # FEE_IN or FEE_OUT
    amountRaw
    amountUSD
    timestamp
    txHash
  }
}
```

### Get Global Fee Statistics
This query returns the total fees processed by the subgraph across all mechs.
```graphql
{
  global(id: "1") {
    totalFeesInUSD
    totalFeesOutUSD
  }
}
``` 