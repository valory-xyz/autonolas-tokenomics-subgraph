# Predict Subgraph

This subgraph tracks prediction markets and trading activity on Gnosis Chain, specifically monitoring the OLAS prediction market ecosystem. It indexes events from prediction market contracts, question/answer systems, and trading activities to provide comprehensive analytics for prediction market participants.

## Overview

The predict subgraph provides real-time indexing of prediction market activities, tracking:

- **Prediction Market Creation**: Fixed Product Market Maker (FPMM) markets created by authorized agents
- **Trading Activity**: Buy/sell transactions and bet placements
- **Question Management**: Realitio question creation, answering, and finalization
- **Agent Analytics**: Trader and creator agent performance metrics
- **Market Outcomes**: Final answers and payout distributions

## Data Sources

The subgraph monitors multiple contracts on Gnosis Chain:

### Core Contracts
- **ServiceRegistryL2** (`0x9338b5153AE39BB89f50468E608eD9d764B755fD`)
  - Tracks agent creation and multisig setups
  - Start Block: 27871084

- **ConditionalTokens** (`0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce`)
  - Manages prediction market conditions and payouts
  - Start Block: 28900000

- **FPMMDeterministicFactory** (`0x9083A2B699c0a4AD06F63580BDE2635d26a3eeF0`)
  - Creates Fixed Product Market Maker prediction markets
  - Start Block: 28900000

- **Realitio** (`0x79e32aE03fb27B07C89c0c568F80287C01ca2E57`)
  - Handles question creation, answering, and finalization
  - Start Block: 28900000

### Market Templates
- **FixedProductMarketMaker**: Individual prediction market contracts created by the factory

## Entities

### Core Market Entities

#### `FixedProductMarketMakerCreation`
Represents a prediction market with:
- **id**: Market contract address
- **creator**: Address that created the market
- **conditionalTokens**: Conditional tokens contract address
- **collateralToken**: Token used for trading
- **conditionIds**: Array of condition identifiers
- **question**: Human-readable question text
- **outcomes**: Array of possible outcome options
- **fee**: Trading fee percentage
- **currentAnswer**: Final resolved answer
- **currentAnswerTimestamp**: When the answer was finalized

#### `Question`
Represents a prediction question:
- **id**: Question identifier
- **question**: Full question text
- **currentAnswer**: Resolved answer
- **currentAnswerTimestamp**: Answer timestamp
- **fixedProductMarketMaker**: Associated market contract

### Trading Entities

#### `TraderAgent`
Represents a trading agent with performance metrics:
- **id**: Agent address
- **serviceId**: Associated service identifier
- **firstParticipation**: First trading activity timestamp
- **lastActive**: Most recent activity timestamp
- **totalBets**: Number of bets placed
- **totalTraded**: Total volume traded
- **totalPayout**: Total winnings received
- **totalFees**: Total fees paid

#### `Bet`
Individual trading transactions:
- **id**: Unique bet identifier
- **bettor**: Trader agent address
- **outcomeIndex**: Selected outcome index
- **amount**: Bet amount (positive for buy, negative for sell)
- **feeAmount**: Fee paid for the transaction
- **countedInTotal**: Whether counted in global totals
- **fixedProductMarketMaker**: Associated market
- **timestamp**: Transaction timestamp

### Creator Entities

#### `CreatorAgent`
Represents market creators:
- **id**: Creator address
- **totalQuestions**: Number of markets created
- **blockNumber/blockTimestamp**: Creation details

### Event Entities

#### Market Lifecycle Events
- `ConditionPreparation`: When a prediction condition is prepared
- `PayoutRedemption`: When payouts are redeemed

#### Question Management Events
- `LogNewQuestion`: New question creation
- `LogNewAnswer`: Answer submission
- `QuestionFinalized`: Question finalization
- `LogNotifyOfArbitrationRequest`: Arbitration requests

#### Trading Events
- `FPMMBuy`: Market buy transactions
- `FPMMSell`: Market sell transactions

### Global Analytics

#### `Global`
Aggregate statistics across all markets:
- **totalTraderAgents**: Total number of trading agents
- **totalActiveTraderAgents**: Agents with recent activity
- **totalBets**: Total number of bets placed
- **totalPayout**: Total payouts distributed
- **totalTraded**: Total trading volume
- **totalFees**: Total fees collected

## Key Features

### Authorized Agent Filtering
The subgraph only tracks markets created by authorized agents:
- Creator addresses are whitelisted in `constants.ts`
- Blacklisted markets are excluded from tracking
- Ensures data quality and relevance

### Real-time Trading Analytics
- Tracks individual agent performance metrics
- Maintains global trading statistics
- Updates activity timestamps for agent engagement

### Question-Answer Integration
- Links prediction markets to Realitio questions
- Tracks answer finalization and market resolution
- Maintains question text and outcome options

### Comprehensive Market Data
- Full market lifecycle from creation to resolution
- Trading volume and fee tracking
- Payout distribution monitoring

## Usage Examples

### Query Recent Prediction Markets
```graphql
{
  fixedProductMarketMakerCreations(
    orderBy: blockTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    creator
    question
    outcomes
    fee
    currentAnswer
    currentAnswerTimestamp
  }
}
```

### Get Top Trading Agents
```graphql
{
  traderAgents(
    orderBy: totalTraded
    orderDirection: desc
    first: 10
  ) {
    id
    totalBets
    totalTraded
    totalPayout
    totalFees
    lastActive
  }
}
```

### Monitor Global Statistics
```graphql
{
  globals {
    totalTraderAgents
    totalActiveTraderAgents
    totalBets
    totalPayout
    totalTraded
    totalFees
  }
}
```

### Get Bets for a Specific Market
```graphql
{
  bets(
    where: { fixedProductMarketMaker: "0x..." }
    orderBy: timestamp
  ) {
    bettor
    outcomeIndex
    amount
    feeAmount
    timestamp
  }
}
```

### Query Recent Questions
```graphql
{
  questions(
    orderBy: currentAnswerTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    question
    currentAnswer
    currentAnswerTimestamp
  }
}
```

## Development

### Prerequisites
- Graph CLI: `yarn global add @graphprotocol/graph-cli`
- Dependencies: `yarn install`

### Building and Deploying
1. Generate types: `yarn codegen`
2. Build the subgraph: `yarn build`
3. Deploy: `graph deploy --studio [SUBGRAPH_NAME]`

### Local Development
- The subgraph uses AssemblyScript for mapping logic
- Event handlers are organized by contract in `src/`
- Constants and filtering logic are in `src/constants.ts`
- Utility functions are in `src/utils.ts`

## Contributing

When adding new features or modifying the subgraph:
1. Update the schema in `schema.graphql`
2. Add corresponding event handlers in the appropriate `src/` files
3. Update the subgraph configuration in `subgraph.yaml`
4. Test thoroughly before deployment
5. Update constants in `src/constants.ts` if needed
