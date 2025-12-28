# Spatters - Smart Contracts & On-Chain Assets

This repository contains the Solidity smart contracts, deployment scripts, and on-chain assets for the Spatters NFT collection.

## Repository Structure

```
spatters/
├── contracts/           # Solidity smart contracts
│   ├── Spatters.sol           # Main NFT contract (ERC721)
│   ├── SpattersGenerator.sol  # On-chain renderer with SSTORE2
│   ├── ExponentialPricing.sol # Pricing curve library
│   └── DateTime.sol           # Date utilities for mutations
├── scripts/             # Hardhat deployment & utility scripts
├── templates/           # HTML viewer template (stored on-chain)
├── original_files/      # Original spatters.js and reference files
├── deployments/         # Contract deployment addresses
├── artifacts/           # Compiled contract ABIs (auto-generated)
├── cache/               # Hardhat cache
└── test/                # Contract tests
```

## Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deployment

```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/deploy-generator.ts --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Related Repositories

- **Frontend & Worker**: See the production repository for the Vercel frontend and GitHub Actions pixel generation worker.

## License

MIT
