#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Network configurations
const networkTypes = {
  '1': {
    name: 'Tokenomics L1',
    description: 'Ethereum Mainnet - Full tokenomics + OLAS holders',
    networks: {
      'mainnet': {
        path: 'subgraphs/tokenomics/tokenomics-eth/subgraph.yaml',
        description: 'Ethereum Mainnet'
      }
    }
  },
  '2': {
    name: 'Tokenomics L2',
    description: 'Layer 2 Networks - OLAS holders only',
    networks: {
      'arbitrum': {
        path: 'subgraphs/tokenomics/tokenomics-arbitrum/subgraph.arbitrum.yaml',
        description: 'Arbitrum Network'
      },
      'base': {
        path: 'subgraphs/tokenomics/tokenomics-base/subgraph.base.yaml',
        description: 'Base Network'
      },
      'celo': {
        path: 'subgraphs/tokenomics/tokenomics-celo/subgraph.celo.yaml',
        description: 'Celo Network'
      },
      'gnosis': {
        path: 'subgraphs/tokenomics/tokenomics-gnosis/subgraph.gnosis.yaml',
        description: 'Gnosis Chain'
      },
      'mode': {
        path: 'subgraphs/tokenomics/tokenomics-mode/subgraph.mode.yaml',
        description: 'Mode Network'
      },
      'optimism': {
        path: 'subgraphs/tokenomics/tokenomics-optimism/subgraph.optimism.yaml',
        description: 'Optimism Network'
      },
      'polygon': {
        path: 'subgraphs/tokenomics/tokenomics-polygon/subgraph.polygon.yaml',
        description: 'Polygon Network'
      }
    }
  },
  '3': {
    name: 'Service Registry',
    description: 'Service Registry Subgraphs',
    networks: {
      'ethereum': {
        path: 'subgraphs/service-registry/service-registry-eth/subgraph.yaml',
        description: 'Ethereum Mainnet'
      },
      'optimism': {
        path: 'subgraphs/service-registry/service-registry-optimism/subgraph.optimism.yaml',
        description: 'Optimism Network'
      },
      'base': {
        path: 'subgraphs/service-registry/service-registry-base/subgraph.base.yaml',
        description: 'Base Network'
      },
      'gnosis': {
        path: 'subgraphs/service-registry/service-registry-gnosis/subgraph.gnosis.yaml',
        description: 'Gnosis Chain'
      },
      'arbitrum': {
        path: 'subgraphs/service-registry/service-registry-arbitrum/subgraph.arbitrum.yaml',
        description: 'Arbitrum Network'
      },
      'celo': {
        path: 'subgraphs/service-registry/service-registry-celo/subgraph.celo.yaml',
        description: 'Celo Network'
      },
      'mode': {
        path: 'subgraphs/service-registry/service-registry-mode/subgraph.mode.yaml',
        description: 'Mode Network'
      },
      'polygon': {
        path: 'subgraphs/service-registry/service-registry-polygon/subgraph.polygon.yaml',
        description: 'Polygon Network'
      }
    }
  },
  '4': {
    name: 'Legacy Mech Fees',
    description: 'Legacy Mech Fees Subgraphs',
    networks: {
      'gnosis': {
        path: 'subgraphs/legacy-mech-fees-gnosis/subgraph.yaml',
        description: 'Gnosis Chain'
      }
    }
  },
  '5': {
    name: 'New Native Mech Fees - Gnosis',
    description: 'New Native Mech Fees Subgraphs on Gnosis',
    networks: {
      'gnosis': {
        path: 'subgraphs/new-mech-fees/new-native-mech-fees-gnosis/subgraph.yaml',
        description: 'New Native Mech Fees on Gnosis'
      }
    }
  },
  '6': {
    name: 'New Native Mech Fees - Base',
    description: 'New Native Mech Fees Subgraphs on Base',
    networks: {
      'base': {
        path: 'subgraphs/new-mech-fees/new-native-mech-fees-base/subgraph.yaml',
        description: 'New Native Mech Fees on Base'
      }
    }
  },
  '7': {
    name: 'New NVM Mech Fees - Gnosis',
    description: 'New NVM Mech Fees Subgraphs on Gnosis',
    networks: {
      'gnosis': {
        path: 'subgraphs/new-mech-fees/new-nvm-mech-fees-gnosis/subgraph.yaml',
        description: 'New NVM Mech Fees on Gnosis'
      }
    }
  },
  '8': {
    name: 'New NVM Mech Fees - Base',
    description: 'New NVM Mech Fees Subgraphs on Base',
    networks: {
      'base': {
        path: 'subgraphs/new-mech-fees/new-nvm-mech-fees-base/subgraph.yaml',
        description: 'New NVM Mech Fees on Base'
      }
    }
  }
};

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  try {
    console.log('🚀 Autonolas Subgraph Studio Deployment\n');
    
    // Show network types
    console.log('Select subgraph type:');
    Object.keys(networkTypes).forEach(type => {
      console.log(`  ${type}. ${networkTypes[type].name} - ${networkTypes[type].description}`);
    });
    console.log('');
    
    // Ask for network type
    const networkTypeKey = await askQuestion(`Enter subgraph type (${Object.keys(networkTypes).join(' / ')}): `);
    const networkType = networkTypes[networkTypeKey];
    
    if (!networkType) {
      console.error(`❌ Invalid subgraph type: ${networkTypeKey}`);
      process.exit(1);
    }
    
    let selectedNetwork;
    let networkConfig;
    
    // If L1 (mainnet) or Legacy Mech Fees, auto-select
    if (networkTypeKey === '1' || networkTypeKey === '4' || networkTypeKey === '5' || networkTypeKey === '6' || networkTypeKey === '7' || networkTypeKey === '8') {
      const networkKey = Object.keys(networkType.networks)[0];
      selectedNetwork = networkKey;
      networkConfig = networkType.networks[networkKey];
    } else {
      // If L2 or service registry, show options
      console.log(`\nAvailable networks for ${networkType.name}:`);
      const availableNetworks = Object.keys(networkType.networks);
      availableNetworks.forEach((network, index) => {
        console.log(`  ${index + 1}. ${network}: ${networkType.networks[network].description}`);
      });
      console.log('');
      
      const networkIndexStr = await askQuestion(`Enter network number (1-${availableNetworks.length}): `);
      const networkIndex = parseInt(networkIndexStr, 10) - 1;

      if (networkIndex >= 0 && networkIndex < availableNetworks.length) {
        selectedNetwork = availableNetworks[networkIndex];
        networkConfig = networkType.networks[selectedNetwork];
      }
      
      if (!networkConfig) {
        console.error(`❌ Invalid network selection: ${networkIndexStr}`);
        process.exit(1);
      }
    }
    
    // Ask for subgraph name
    const subgraphName = await askQuestion('Enter subgraph name (e.g., olas-tokenomics-mainnet): ');
    
    if (!subgraphName) {
      console.error('❌ Subgraph name is required');
      process.exit(1);
    }
    
    // Ask for version (optional)
    const version = await askQuestion('Enter version (default: v0.0.1): ') || 'v0.0.1';
    
    // Ask for deployment platform
    const platform = await askQuestion('Enter deployment platform (1. Graph Studio, 2. Alchemy): ') || '1';

    rl.close();
    
    console.log(`\n📦 Preparing deployment...`);
    console.log(`Subgraph Type: ${networkType.name}`);
    console.log(`Network: ${selectedNetwork}`);
    console.log(`Subgraph Name: ${subgraphName}`);
    console.log(`Version: ${version}`);
    console.log(`Platform: ${platform === '1' ? 'Graph Studio' : 'Alchemy'}`);
    console.log(`Config: ${networkConfig.path}\n`);
    
    // Determine build command based on network type
    let buildCommand;
    if (networkTypeKey === '1') {
      buildCommand = 'yarn build-tokenomics-l1';
    } else if (networkTypeKey === '2') {
      buildCommand = 'yarn build-tokenomics-l2';
    } else if (networkTypeKey === '3') {
      // For service registry, differentiate between L1 (ethereum) and L2
      if (selectedNetwork === 'ethereum') {
        buildCommand = 'yarn build-service-registry-l1';
      } else {
        buildCommand = 'yarn build-service-registry-l2';
      }
    } else if (networkTypeKey === '4') {
      buildCommand = 'yarn build-legacy-mech-fees';
    } else if (networkTypeKey === '5') {
      buildCommand = 'yarn build-new-native-mech-fees-gnosis';
    } else if (networkTypeKey === '6') {
      buildCommand = 'yarn build-new-native-mech-fees-base';
    } else if (networkTypeKey === '7') {
      buildCommand = 'yarn build-new-nvm-mech-fees-gnosis';
    } else if (networkTypeKey === '8') {
      buildCommand = 'yarn build-new-nvm-mech-fees-base';
    }

    console.log(`🔨 Building subgraph with: ${buildCommand}`);
    execSync(buildCommand, {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    console.log(`\n🚀 Deploying to ${platform === '1' ? 'Graph Studio' : 'Alchemy'}...`);

    // Build the deployment command based on the selected platform
    let deployCommand;

    if (platform === '1') { // Graph Studio
      if (!process.env.GRAPH_DEPLOY_KEY) {
        console.error(`❌ GRAPH_DEPLOY_KEY environment variable is not set`);
        console.log(`\n📝 To fix this:`);
        console.log(`1. Go to https://thegraph.com/studio/`);
        console.log(`2. Create or select your subgraph`);
        console.log(`3. Copy your deploy key`);
        console.log(`4. Set it as an environment variable:`);
        console.log(`   export GRAPH_DEPLOY_KEY=your_deploy_key_here\n`);
        process.exit(1);
      }
      deployCommand = `graph deploy --deploy-key ${process.env.GRAPH_DEPLOY_KEY} --version-label ${version} ${subgraphName} ${networkConfig.path}`;
    } else if (platform === '2') { // Alchemy
      if (!process.env.ALCHEMY_DEPLOY_KEY) {
        console.error(`❌ ALCHEMY_DEPLOY_KEY environment variable is not set`);
        console.log(`\n📝 To fix this:`);
        console.log(`1. Go to your Alchemy dashboard`);
        console.log(`2. Navigate to the Subgraphs section`);
        console.log(`3. Find your deploy key`);
        console.log(`4. Set it as an environment variable:`);
        console.log(`   export ALCHEMY_DEPLOY_KEY=your_deploy_key_here\n`);
        process.exit(1);
      }
      deployCommand = `graph deploy --node https://subgraphs.alchemy.com/api/subgraphs/deploy --ipfs https://ipfs.satsuma.xyz --deploy-key ${process.env.ALCHEMY_DEPLOY_KEY} --version-label ${version} ${subgraphName} ${networkConfig.path}`;
    } else {
      console.error(`❌ Invalid deployment platform: ${platform}`);
      process.exit(1);
    }
    
    // Execute deployment
    execSync(deployCommand, { 
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    // Cleanup temporary files for L2 builds
    if (networkTypeKey === '2') {
      console.log(`\n🧹 Cleaning up temporary files...`);
      try {
        execSync('rm -rf generated-l2', { stdio: 'pipe' });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    if (platform === '1') {
      console.log(`\n✅ Successfully deployed to Studio!`);
      console.log(`📊 Dashboard: https://thegraph.com/studio/subgraph/${subgraphName}`);
    } else {
      console.log(`\n✅ Successfully deployed to Alchemy!`);
      console.log(`📊 Dashboard: Check your Alchemy dashboard for subgraph details.`);
    }
    
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main(); 