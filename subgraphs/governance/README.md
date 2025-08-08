# Governance Subgraph

This subgraph tracks governance events for the OLAS token governance system on Ethereum mainnet. It monitors the GovernorOLAS contracts and indexes all governance-related events including proposal creation, voting, execution, and parameter changes.

## Overview

The governance subgraph provides real-time indexing of the OLAS governance system, tracking:

- **Proposal Lifecycle**: Creation, voting, queuing, execution, and cancellation
- **Voting Activity**: Individual votes with support levels and reasoning
- **Governance Parameters**: Changes to voting periods, delays, thresholds, and quorum
- **Timelock Management**: Timelock contract changes

## Data Sources

The subgraph monitors two GovernorOLAS contracts on Ethereum Mainnet:

1. **GovernorOLAS V1** (`0x34C895f302D0b5cf52ec0Edd3945321EB0f83dd5`)
  - Start Block: 15050305
  - End Block: 17527057

2. **GovernorOLAS V2** (`0x8e84b5055492901988b831817e4ace5275a3b401`)
  - Start Block: 17527057
  - Active

## Entities

### Core Governance Entities

#### `ProposalCreated`
The main entity representing governance proposals with:
- **proposalId**: Unique identifier for the proposal
- **proposer**: Address that created the proposal
- **targets**: Array of contract addresses to call
- **values**: Array of ETH values for each call
- **signatures**: Array of function signatures
- **calldatas**: Array of encoded function calls
- **startBlock/endBlock**: Voting period boundaries
- **description**: Human-readable proposal description
- **votesFor/votesAgainst**: Current vote tallies
- **quorum**: Required votes for proposal to pass
- **isExecuted/isCancelled/isQueued**: Status flags

#### `VoteCast`
Individual votes on proposals:
- **voter**: Address that cast the vote
- **proposalId**: Proposal being voted on
- **support**: Vote direction (0=against, 1=for, 2=abstain)
- **weight**: Voting power used
- **reason**: Optional reason for the vote

### Event Entities

#### Proposal Lifecycle Events
- `ProposalCanceled`: When a proposal is cancelled
- `ProposalExecuted`: When a proposal is executed
- `ProposalQueued`: When a proposal is queued for timelock

#### Governance Parameter Events
- `ProposalThresholdSet`: Changes to proposal creation threshold
- `QuorumNumeratorUpdated`: Changes to quorum requirements
- `VotingDelaySet`: Changes to voting delay
- `VotingPeriodSet`: Changes to voting period
- `TimelockChange`: Changes to timelock contract

## Key Features

### Real-time Vote Tracking
The subgraph maintains running totals of votes for and against each proposal, allowing for real-time monitoring of proposal status.

### Historical Quorum Calculation
For historical proposals, the subgraph calculates the quorum requirement at the time of proposal creation using on-chain data.

### Comprehensive Event Coverage
All governance events are indexed, providing a complete audit trail of governance activities.

## Usage Examples

### Query Recent Proposals
```graphql
{
  proposalCreateds(
    orderBy: blockTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    proposalId
    proposer
    description
    votesFor
    votesAgainst
    quorum
    isExecuted
    isCancelled
  }
}
```

### Get Votes for a Specific Proposal
```graphql
{
  voteCasts(
    where: { proposalId: "123" }
    orderBy: blockTimestamp
  ) {
    voter
    support
    weight
    reason
    blockTimestamp
  }
}
```

### Monitor Governance Parameter Changes
```graphql
{
  proposalThresholdSets(
    orderBy: blockTimestamp
    orderDirection: desc
    first: 5
  ) {
    oldProposalThreshold
    newProposalThreshold
    blockTimestamp
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
- Event handlers are defined in `src/governor-olas.ts`
- Utility functions are in `src/utils.ts`

## Contributing

When adding new features or modifying the subgraph:
1. Update the schema in `schema.graphql`
2. Add corresponding event handlers in `src/governor-olas.ts`
3. Update the subgraph configuration in `subgraph.yaml`
4. Test thoroughly before deployment
