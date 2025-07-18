# Subgraph Deployment Script

This directory contains a utility script, `deploy-studio.js`, designed to streamline the deployment of Autonolas tokenomics subgraphs to The Graph's hosted services.

## Overview

The `deploy-studio.js` script is an interactive command-line interface (CLI) that guides you through the process of building and deploying a subgraph. It simplifies the deployment process by:

- Prompting for the target network (L1 or L2s).
- Asking for the specific network (e.g., Ethereum Mainnet, Arbitrum, Base).
- Requesting a unique subgraph name for the deployment.
- Allowing you to specify a version label.
- Handling the correct build commands based on your selection.
- Constructing and executing the appropriate `graph deploy` command for either **The Graph Studio** or **Alchemy**.

## Prerequisites

Before running the script, ensure you have the following:

1.  **Node.js**: The script is a Node.js application.
2.  **Yarn**: The project's dependencies and build scripts are managed with Yarn.
3.  **Environment Variables**: You must have a deployment key set as an environment variable for the platform you wish to deploy to.

## Usage

To run the deployment script, execute the following command from the root of the project:

```bash
yarn deploy-studio
```

The script will then prompt you with a series of questions to configure the deployment:

1.  **Network Type**: Choose between L1 (full tokenomics on Ethereum) or L2s (OLAS holders only on various networks).
2.  **L2 Network**: If you select L2, you will be asked to choose a specific L2 network.
3.  **Subgraph Name**: Provide a unique name for your subgraph (e.g., `autonolas-tokenomics-mainnet-v1`).
4.  **Version**: Enter a version label (e.g., `v1.0.0`), or press Enter to use the default (`v0.0.1`).
5.  **Deployment Platform**: Choose between The Graph Studio or Alchemy.

The script will then build the subgraph and deploy it.

## Environment Variables

The script requires a deploy key to authenticate with the deployment platform.

### For The Graph Studio

Set the `GRAPH_DEPLOY_KEY` environment variable.

```bash
export GRAPH_DEPLOY_KEY="your_deploy_key_here"
```

You can find your deploy key in your subgraph's dashboard on [The Graph Studio](https://thegraph.com/studio/).

### For Alchemy

Set the `ALCHEMY_DEPLOY_KEY` environment variable.

```bash
export ALCHEMY_DEPLOY_KEY="your_deploy_key_here"
```

You can find your deploy key in your Alchemy subgraphs dashboard. 