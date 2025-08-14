# Autonolas Subgraphs Monorepo (GRAPH HOSTED)

This repository contains multiple subgraphs for [The Graph](https://thegraph.com), primarily indexing contracts related to the Autonolas ecosystem.

## Getting Started

- Prerequisites: `yarn global add @graphprotocol/graph-cli`
- Install dependencies by running `yarn install`

## Monorepo Architecture

This repository is a monorepo that houses multiple subgraph projects. The goal is to maintain a centralized, organized, and consistent structure for all subgraphs related to the Autonolas ecosystem which are not self hosted. or are hosted on platform like The Graph Studio or Alchemy.

### Key Directories

-   `abis/`: A central directory for all contract ABI JSON files. ABIs stored here are shared and can be referenced by any subgraph.
-   `scripts/`: Contains scripts for automating tasks, such as building manifests and deploying subgraphs. The `deploy-studio.js` script is particularly important for managing deployments.
-   `subgraphs/`: The main directory containing all the individual subgraph projects. Each subdirectory represents a different subgraph category (e.g., `tokenomics`, `service-registry`, `staking`).

### Multi-Network Subgraph Patterns

We use two primary patterns for managing subgraphs that are deployed across multiple networks.

#### 1. Template (`subgraph.template.yaml`) Pattern

This is the **preferred pattern for new multi-network subgraphs**, especially when they involve complex configurations or many networks.

-   **Structure**: A `subgraph.template.yaml` file serves as a base template. A `networks.json` file contains a list of networks with their specific contract addresses and start blocks.
-   **Generation**: A script (e.g., `scripts/generate-manifests.js`) consumes the template and the `networks.json` file to generate the final `subgraph.<network>.yaml` manifest for each network.
-   **Example**: `staking`.

#### 2. Shared Code (`common/`) Pattern

This pattern is suitable for simpler multi-network subgraphs, particularly when the network-specific differences are minimal and primarily involve contract addresses and start blocks.

-   **Structure**: A `common/` directory within the subgraph's main folder (e.g., `subgraphs/service-registry/common/`) holds the shared `schema.graphql`, mapping files in `mappers/`, and utility functions.
-   **Network-Specific Manifests**: Each supported network has its own subdirectory (e.g., `service-registry-arbitrum/`) containing a `subgraph.<network>.yaml` file. This manifest references the shared schema and mappers from the `common/` directory but specifies network-specific details like contract addresses and start blocks.
-   **Examples**: `service-registry` and `tokenomics` (for L2s).

## Adding a New Subgraph

Here is a step-by-step guide to adding a new subgraph to this repository.

### Step 1: Create the Subgraph Directory

1.  Create a new directory under `subgraphs/` for your project (e.g., `subgraphs/my-new-subgraph/`).
2.  If it's a multi-network subgraph, **consider using the Template Pattern as described above.** Otherwise, follow the Shared Code (`common/`) Pattern by creating a `common/` directory for your shared logic and separate directories for each network (e.g., `my-new-subgraph-mainnet/`).
3.  Add your `schema.graphql`, `subgraph.yaml` (or `subgraph.template.yaml` if using the template pattern), and `src/mapping.ts` files as you normally would.

### Step 2: Add ABIs

Place the JSON ABI files for all required smart contracts into the root `/abis` directory. This ensures they can be easily referenced by your subgraph and other projects.

### Step 3: Update `package.json`

You must add scripts to `package.json` to codegen and build your new subgraph.

1.  **Add a `codegen` script**:
    -   Create a script named `codegen-my-new-subgraph` that runs `graph codegen`.
    -   If you're using the `common/` pattern, make sure the output (`-o`) is directed to your `common/generated` directory.
    ```json
    "codegen-my-new-subgraph": "graph codegen subgraphs/my-new-subgraph/my-new-subgraph-mainnet/subgraph.yaml -o subgraphs/my-new-subgraph/common/generated",
    ```

2.  **Add `build` scripts**:
    -   Create a build script for each network your subgraph supports (e.g., `build-my-new-subgraph:mainnet`).
    -   This script should first run your `codegen` script and then `graph build` with the path to the specific network's manifest file.
    ```json
    "build-my-new-subgraph:mainnet": "yarn codegen-my-new-subgraph && graph build subgraphs/my-new-subgraph/my-new-subgraph-mainnet/subgraph.yaml",
    ```

### Step 4: Update the Deployment Script

To make your subgraph deployable via the interactive script, you need to add it to `scripts/deploy-studio.js`.

1.  Open `scripts/deploy-studio.js`.
2.  Add a new entry to the `networkTypes` object for your subgraph category.
3.  For each network, provide the path to its manifest file, a short description, and the name of the `build` script you created in `package.json`.

```javascript
// Example from scripts/deploy-studio.js
'9': { // Use a new number
  name: 'My New Subgraph',
  description: 'This is my new subgraph.',
  networks: {
    'mainnet': {
      path: 'subgraphs/my-new-subgraph/my-new-subgraph-mainnet/subgraph.yaml',
      description: 'Ethereum Mainnet',
      buildCommand: 'yarn build-my-new-subgraph:mainnet'
    },
    // ... other networks
  }
},
```

### Step 5: Add a README.md

Create a `README.md` file inside your subgraph's main directory (e.g., `subgraphs/my-new-subgraph/README.md`). Please follow the structure of the existing READMEs (`service-registry/README.md`, `tokenomics/README.md`) to ensure consistency.

Your README should include:
-   A brief overview.
-   The architecture of your subgraph.
-   A list of indexed contracts.
-   A description of the core entities in your schema.
-   A list of supported networks.
-   GraphQL query examples.

## Development Workflow

1.  **Install Dependencies**: Run `yarn install` from the root of the repository.
2.  **Generate Types**: Run the `codegen` script for your subgraph (e.g., `yarn codegen-my-new-subgraph`).
3.  **Build**: Run the `build` script for the specific network you are working on (e.g., `yarn build-my-new-subgraph:mainnet`).
4.  **Test**: Use `graph test` to run any unit tests.
5.  **Deploy**: Use the interactive deployment script `yarn deploy-studio` to deploy to The Graph Studio or Alchemy.

## Deployment

- Authenticate using the subgraph's deploy key: `graph auth --studio [DEPLOY KEY]`
- Run `yarn codegen`
- Run `yarn build`
- Run `graph deploy --studio autonolas-tokenomics`, choose newer version
- Use updated API URL wherever needed