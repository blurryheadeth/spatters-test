# Spatters - Dynamic On-Chain NFT Collection

A fully on-chain, dynamic NFT collection on Ethereum with time-based mutations and generative art.

## 🎨 Features

- **999 Total Supply** with exponential pricing (0.00618 ETH → 100 ETH)
- **Fully On-Chain**: All metadata and generative scripts stored on-chain
- **Dynamic Mutations**: NFTs can be mutated on specific eligibility dates
- **Art Blocks Style**: Client-side rendering using on-chain p5.js code
- **Anti-Whale Protection**: Fair distribution with per-wallet limits and cooldowns
- **Deterministic Randomness**: Reproducible image generation using on-chain seeds
- **Events-Based History**: Full mutation history preserved in blockchain events

## 📋 Collection Details

- **Total Supply**: 999 NFTs
- **Owner Reserve**: First 25 tokens (free mint for owner)
- **Public Supply**: Tokens 26-999 (exponential pricing)
- **Anti-Whale Limits**:
  - Max 2 per transaction
  - Max 10 per wallet
  - 1-hour cooldown between mints

## 💰 Pricing Structure

The collection uses an exponential pricing curve:

```
Token #26:  0.00618 ETH
Token #50:  0.0123 ETH  (est.)
Token #100: 0.0344 ETH  (est.)
Token #333: 1.247 ETH   (est.)
Token #666: 29.44 ETH   (est.)
Token #999: 100 ETH     (target)
```

Formula: `price = 0.00618 * ((100/0.00618)^((n-25)/(999-25)))`

## 🔄 Mutation Eligibility

NFT holders can mutate their tokens on any of these dates:

1. **Individual Anniversary**: Anniversary of token's mint date
2. **Collection Anniversary**: Anniversary of collection launch (token #1 mint)
3. **Monthly Eligibility**: Based on circles and lines count
   - Formula: `month = (circles × 3) + lines`
   - Can mutate on the 1st of calculated month
4. **Quarter-End Eligibility**: Based on unique colors count
   - 1 or 5 colors → March 31 (Q1)
   - 2 colors → June 30 (Q2)
   - 3 colors → September 30 (Q3)
   - 4 colors → December 31 (Q4)

## 🛠️ Technical Stack

- **Smart Contracts**: Solidity 0.8.20
- **Development**: Hardhat
- **Testing**: Hardhat + Ethers.js
- **Frontend**: Next.js + React (to be built)
- **Storage**: On-chain (contract) + IPFS (Pinata for images)
- **Libraries**: OpenZeppelin, custom libraries for pricing and datetime

## 📦 Setup

### Prerequisites

- Node.js 22.x LTS (Hardhat doesn't support v23.x)
- npm or yarn
- MetaMask wallet
- Alchemy or Infura account for RPC

### Installation

```bash
# Clone the repository
git clone https://github.com/blurryheadeth/spatters.git
cd spatters

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### Configure Environment

Edit `.env` file with your credentials:

```env
# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Private Key (NEVER commit this!)
PRIVATE_KEY=your_private_key_here

# Etherscan API Key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Pinata API Keys
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
```

## 🧪 Testing

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Test pricing curve
npx hardhat run scripts/test-pricing.ts

# Check test coverage
npx hardhat coverage
```

## 🎨 Frontend Development

### Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.local.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

### Configuration

Update `frontend/.env.local` with:
- WalletConnect Project ID (from https://cloud.walletconnect.com)
- Contract addresses (after deployment)
- RPC URLs
- Pinata API keys

### Build for Production

```bash
cd frontend
npm run build
npm start
```

## 🚀 Deployment

### Testnet (Sepolia)

```bash
# 1. Deploy contract
npx hardhat run scripts/deploy.ts --network sepolia

# 2. Save the contract address from output

# 3. Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# 4. Mint owner reserve (first 25 tokens)
npx hardhat run scripts/mint-owner-reserve.ts --network sepolia <CONTRACT_ADDRESS>
```

### Mainnet

⚠️ **IMPORTANT**: Test thoroughly on Sepolia before mainnet deployment!

```bash
# Deploy to mainnet
npx hardhat run scripts/deploy.ts --network mainnet

# Verify on Etherscan
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>

# Mint owner reserve
npx hardhat run scripts/mint-owner-reserve.ts --network mainnet <CONTRACT_ADDRESS>
```

## 📁 Project Structure

```
spatters/
├── contracts/
│   ├── Spatters.sol              # Main NFT contract
│   ├── ExponentialPricing.sol    # Pricing library
│   ├── MetadataParser.sol        # JSON parsing utilities
│   └── DateTime.sol              # Date/time calculations
├── scripts/
│   ├── deploy.ts                 # Deployment script
│   ├── mint-owner-reserve.ts     # Owner minting script
│   └── test-pricing.ts           # Pricing verification
├── test/
│   └── Spatters.test.ts          # Contract tests
├── frontend/                      # (To be built)
├── spatters.html                  # p5.js generative script
└── hardhat.config.ts             # Hardhat configuration
```

## 🔒 Security Considerations

1. **Reentrancy Protection**: All state-changing functions use `nonReentrant`
2. **Access Control**: Owner-only functions use `onlyOwner`
3. **Integer Overflow**: Protected by Solidity 0.8+
4. **Timestamp Manipulation**: Limited impact (max 15-second manipulation)
5. **Gas Optimization**: Events used for history instead of storage
6. **Input Validation**: Metadata size limits, address checks

## 🧩 Smart Contract API

### Minting

```solidity
// Owner mint (first 25 tokens, free)
function ownerMint(address to, string memory metadata) external

// Public mint (tokens 26-999, paid)
function mint(string memory metadata) external payable

// Get current mint price
function getMintPrice() public view returns (uint256)
```

### Mutations

```solidity
// Mutate an NFT (owner only, on eligible dates)
function mutate(uint256 tokenId, string memory mutationType, string memory newMetadata) external

// Check if token can mutate today
function canMutate(uint256 tokenId) public view returns (bool)
```

### Owner Functions

```solidity
// Withdraw accumulated ETH from mints
function withdraw() external onlyOwner

// Get contract balance
function getContractBalance() external view returns (uint256)
```

## 🎯 Next Steps

### Phase 1: Smart Contracts ✅
- [x] Implement core contract
- [x] Add pricing curve
- [x] Add mutation logic
- [x] Create deployment scripts
- [x] Write tests

### Phase 2: Frontend ✅
- [x] Set up Next.js project
- [x] Integrate Web3 (wagmi + RainbowKit)
- [x] Build minting interface with 3-choice selection
- [ ] Build mutation interface (TODO)
- [ ] Display NFT gallery (TODO)
- [ ] Integrate p5.js for client-side rendering (TODO)

### Phase 3: Integration
- [ ] Deploy to Sepolia testnet
- [ ] Test all functionality
- [ ] Security audit
- [ ] Deploy to mainnet

### Phase 4: Launch
- [ ] Marketing campaign
- [ ] Community building
- [ ] OpenSea collection setup
- [ ] Launch announcement

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ for the Ethereum community

