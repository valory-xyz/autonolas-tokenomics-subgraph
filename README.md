# Staking Contract Subgraph

This repository contains a subgraph for [The Graph](https://thegraph.com), specifically for the staking contracts.

## Getting Started

- Prerequisites: `yarn global add @graphprotocol/graph-cli`
- Install dependencies by running `yarn install`

## Deployment

- Authenticate using the subgraph's deploy key: `graph auth --studio [DEPLOY KEY]`
- Run `yarn codegen`
- Run `yarn build`
- Run `graph deploy-gnosis`, choose newer version
- Use updated API URL wherever needed

## Add new network

- Update network.json with new network, specify Factory address and start block
- Run `yarn generate-manifests` to generate needed configs from subgraph.template.yaml
- Update package.json with the command that deploys your subgraph on new network
- Deploy your subgraph
