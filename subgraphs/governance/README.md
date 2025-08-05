# Governance Subgraph

This repository contains a subgraph for [The Graph](https://thegraph.com), specifically for the [governance contracts](https://github.com/valory-xyz/autonolas-governance)


## Getting Started

- Prerequisites: `yarn global add @graphprotocol/graph-cli`
- Install dependencies by running `yarn install`

## Deployment

- Authenticate using the subgraph's deploy key: `graph auth --studio [DEPLOY KEY]`
- Run `yarn codegen`
- Run `yarn build`
- Run `yarn deploy`, choose newer version
- Use updated API URL wherever needed