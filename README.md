# Tokenomics App Subgraph

This repository contains a subgraph for [The Graph](https://thegraph.com) for the [Tokenomics App](https://tokenomics.olas.network/)


## Getting Started

- Prerequisites: `yarn global add @graphprotocol/graph-cli`
- Install dependencies by running `yarn install`

## Deployment

- Authenticate using the subgraph's deploy key: `graph auth --studio [DEPLOY KEY]`
- Run `yarn codegen`
- Run `yarn build`
- Run `graph deploy --studio autonolas-tokenomics`, choose newer version
- Use updated API URL wherever needed