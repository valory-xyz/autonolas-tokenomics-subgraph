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
      'base': {
        path: 'subgraphs/tokenomics/tokenomics-base/subgraph.base.yaml',
        description: 'Base Network'
      },
      'gnosis': {
        path: 'subgraphs/tokenomics/tokenomics-gnosis/subgraph.gnosis.yaml',
        description: 'Gnosis Chain'
      }
    }
  },
  '3': {
    name: 'Service Registry L1',
    description: 'Service Registry on L1',
    networks: {
      'mainnet': {
        path: 'subgraphs/service-registry/service-registry-eth/subgraph.yaml',
        description: 'Ethereum Mainnet'
      }
    }
  },
  '4': {
    name: 'Service Registry L2',
    description: 'Service Registry on L2s',
    networks: {
      'optimism': {
        path: 'subgraphs/service-registry/service-registry-optimism/subgraph.optimism.yaml',
        description: 'Optimism'
      },
      'base': {
        path: 'subgraphs/service-registry/service-registry-base/subgraph.base.yaml',
        description: 'Base Network'
      },
      'gnosis': {
        path: 'subgraphs/service-registry/service-registry-gnosis/subgraph.gnosis.yaml',
        description: 'Gnosis Chain'
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
    console.log('🚀 Autonolas Tokenomics Subgraph Studio Deployment\n');
    
    // Show network types
    console.log('Select network type:');
    Object.keys(networkTypes).forEach(type => {
      console.log(`  ${type}. ${networkTypes[type].name} - ${networkTypes[type].description}`);
    });
    console.log('');
    
    // Ask for network type
    const networkType = await askQuestion('Enter network type (1, 2, 3 or 4): ');
    
    if (!networkTypes[networkType]) {
      console.error(`❌ Invalid network type: ${networkType}`);
      process.exit(1);
    }
    
    let selectedNetwork;
    let networkConfig;
    
    // If L1 (mainnet), auto-select
    if (networkType === '1' || networkType === '3') {
      selectedNetwork = 'mainnet';
      networkConfig = networkTypes[networkType].networks[selectedNetwork];
    } else {
      // If L2 or Service Registry L2, show numbered options
      const networkOptions = networkTypes[networkType].networks;
      const networkKeys = Object.keys(networkOptions);

      console.log(`\nAvailable networks for ${networkTypes[networkType].name}:`);
      networkKeys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${networkOptions[key].description} (${key})`);
      });
      console.log('');

      const networkChoice = await askQuestion(`Enter network number (1-${networkKeys.length}): `);
      const choiceIndex = parseInt(networkChoice, 10) - 1;

      if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= networkKeys.length) {
        console.error(`❌ Invalid network choice: ${networkChoice}`);
        process.exit(1);
      }

      selectedNetwork = networkKeys[choiceIndex];
      networkConfig = networkOptions[selectedNetwork];
    }
    
    // Ask for subgraph name
    const subgraphName = await askQuestion('Enter subgraph name (e.g., olas-base-tokenomics-test): ');
    
    if (!subgraphName) {
      console.error('❌ Subgraph name is required');
      process.exit(1);
    }
    
    // Ask for version (optional)
    const version = await askQuestion('Enter version (default: v0.0.1): ') || 'v0.0.1';
    
    rl.close();
    
    console.log(`\n📦 Preparing deployment...`);
    console.log(`Network Type: ${networkTypes[networkType].name}`);
    console.log(`Network: ${selectedNetwork}`);
    console.log(`Subgraph: ${subgraphName}`);
    console.log(`Version: ${version}`);
    console.log(`Config: ${networkConfig.path}\n`);
    
    // Determine build command based on network type
    const buildCommand = networkType === '1' ? 'yarn build-tokenomics-l1' :
      (networkType === '2' ? 'yarn build-tokenomics-l2' :
        (networkType === '3' ? 'yarn build-service-registry-l1' : 'yarn build-service-registry-l2'));


    console.log(`🔨 Building subgraph with: ${buildCommand}`);
    execSync(buildCommand, {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    // Cleanup temporary files for L2 builds
    if (networkType === '2' || networkType === '4') {
      console.log(`\n🧹 Cleaning up temporary files...`);
      try {
        execSync('rm -rf generated-l2', { stdio: 'pipe' });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    console.log(`\n🚀 Deploying to Studio...`);

    // Check if deploy key is set
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

    // Build the deployment command for Graph Studio
    const deployCommand = `graph deploy --deploy-key ${process.env.GRAPH_DEPLOY_KEY} --version-label ${version} ${subgraphName} ${networkConfig.path}`;
    
    // Execute deployment
    execSync(deployCommand, { 
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    console.log(`\n✅ Successfully deployed to Studio!`);
    console.log(`📊 Dashboard: https://thegraph.com/studio/subgraph/${subgraphName}`);
    
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main(); 