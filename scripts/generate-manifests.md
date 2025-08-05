## Subgraph YAML Generator

This script generates `subgraph.<network>.yaml` files for different networks by replacing placeholders in a template file using contract metadata defined in a `networks.json` file.

### 📁 Expected Directory Structure

your-folder/
├── networks.json
├── subgraph.template.yaml

- `networks.json`: Contains contract addresses and start blocks per network.
- `subgraph.template.yaml`: The YAML template with placeholders.

### 🔧 Usage

Ensure you have the networks.json and subgraph.template.yaml with the formatw below

#### 📄 Template Format

```
dataSources:
  - name: MyContract
    network: {{ network }}
    source:
      address: "{{ MyContract.address }}"
      startBlock: {{ MyContract.startBlock }}
```

#### 📄 networks.json Format

```
{
  "mainnet": {
    "MyContract": {
      "address": "0x123...",
      "startBlock": 12345678
    }
  },
  "gnosis": {
    "MyContract": {
      "address": "0xabc...",
      "startBlock": 87654321
    }
  }
}
```

#### 📦 Run & Output

From the root of your project or folder containing the script, run:

```bash
node generate.js --path=./your-folder
```

Replace ./your-folder with the path to the directory containing both networks.json and subgraph.template.yaml.

Running the script will generate files like:

- subgraph.mainnet.yaml
- subgraph.gnosis.yaml

Each file will have the correct network, address, and startBlock values substituted.