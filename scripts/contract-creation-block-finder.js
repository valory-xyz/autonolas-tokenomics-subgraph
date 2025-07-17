const { ethers } = require("ethers");

class ContractFinder {
    /**
     * A class to find the creation block number of an Ethereum smart contract
     * using a binary search algorithm.
     */
    constructor(providerUrl) {
        /**
         * Initializes the ContractFinder with a connection to an Ethereum node.
         *
         * @param {string} providerUrl - The HTTP or WebSocket provider URL for an Ethereum node.
         */
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.latestBlock = null;
    }

    async init() {
        /**
         * Asynchronously initializes the connection and fetches the latest block.
         */
        try {
            await this.provider.getNetwork();
            this.latestBlock = await this.provider.getBlockNumber();
            console.log(`Successfully connected. Latest block: ${this.latestBlock}`);
        } catch (error) {
            throw new Error("Failed to connect to the Ethereum provider.");
        }
    }

    async _getCodeLength(contractAddress, blockNumber) {
        /**
         * Helper function to get the length of a contract's bytecode at a specific block.
         *
         * @param {string} contractAddress - The contract's address.
         * @param {number} blockNumber - The block number to check.
         * @returns {Promise<number>} - The length of the bytecode. Returns 0 if no code exists.
         */
        try {
            const code = await this.provider.getCode(contractAddress, blockNumber);
            // '0x' is the default response for no code
            return code.length;
        } catch (e) {
            console.error(
                `Error getting code for ${contractAddress} at block ${blockNumber}: ${e.message}`
            );
            return 0;
        }
    }

    async findCreationBlock(contractAddress) {
        /**
         * Performs a binary search to find the block number where the contract was created.
         *
         * @param {string} contractAddress - The hexadecimal address of the smart contract.
         * @returns {Promise<number>} - The block number of the contract's creation.
         */
        console.log(`\nSearching for creation block of ${contractAddress}...`);
        return this._binarySearch(contractAddress, 0, this.latestBlock);
    }

    async _binarySearch(contractAddress, startBlock, endBlock) {
        /**
         * The recursive binary search implementation.
         *
         * @param {string} contractAddress - The contract's address.
         * @param {number} startBlock - The starting block for the current search range.
         * @param {number} endBlock - The ending block for the current search range.
         * @returns {Promise<number>} - The creation block number.
         */
        // Base case: if the range has narrowed to a single block, we've found it.
        if (startBlock >= endBlock) {
            return endBlock;
        }

        // Find the middle of the current search range
        const midBlock = Math.floor((startBlock + endBlock) / 2);

        // Check if the contract has code at the midpoint.
        // The "> 2" check is a safe way to ensure it's not just an empty contract.
        const codeLength = await this._getCodeLength(contractAddress, midBlock);
        if (codeLength > 2) {
            // If code exists, the creation block is in the lower half (or is the midpoint).
            // We search from the start to the midpoint.
            return this._binarySearch(contractAddress, startBlock, midBlock);
        } else {
            // If no code exists, the creation block must be in the upper half.
            // We search from the block *after* the midpoint to the end.
            return this._binarySearch(contractAddress, midBlock + 1, endBlock);
        }
    }
}

async function main() {
    /**
     * Main function to run the contract finder.
     */
    // It's recommended to use an environment variable for your RPC URL.
    const providerUrl = process.env.ETH_RPC_URL || "YOUR_RPC_URL";
    if (providerUrl === "YOUR_RPC_URL") {
        console.warn(
            "Warning: Using a placeholder RPC URL. Please set the ETH_RPC_URL environment variable."
        );
    }

    try {
        const finder = new ContractFinder(providerUrl);
        await finder.init();

        // List of contracts to find the creation block for
        const contractsToCheck = [
            "0x48b6af7B12C71f09e2fC8aF4855De4Ff54e775cA",
        ];

        for (const contract of contractsToCheck) {
            const creationBlock = await finder.findCreationBlock(contract);
            console.log(`✅ Contract: ${contract} | Creation Block: ${creationBlock}`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

main(); 