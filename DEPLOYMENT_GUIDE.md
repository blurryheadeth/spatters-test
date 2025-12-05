# 🎨 Spatters - Complete Deployment Guide

## ✅ COMPLETED: What We've Built

### 1. On-Chain Components (Fully Decentralized) ✅
- **Spatters.sol**: Main NFT contract with seed-based generation
  - ✅ Deployed to Sepolia: `0x875209CC6C6e4A1F87B7E2cb3D3438D105Fc0EF6`
  - Two-step minting with 3-seed preview
  - Time-based mutations
  - Owner-only custom palettes
  
- **spatters.js**: Generative art script (193 KB)
  - ✅ Stored on-chain via SSTORE2 (9 chunks)
  - Immutable and permanent
  
- **SpattersGenerator.sol**: On-chain HTML generator
  - ✅ Deployed to Sepolia: `0x1975328484d634dd8B57DBD425bc7d77CaAc3838`
  - Reads from SSTORE2 storage
  - Assembles complete HTML
  - Called externally (like Art Blocks!)

### 2. API Wrapper (OpenSea Compatibility) ✅
- **API Service** (`api/server.ts`)
  - Calls on-chain generator via web3
  - Serves HTTP URLs for marketplaces
  - Renders PNG thumbnails
  - Open source & replicable

### 3. Updated tokenURI ✅
- Returns JSON metadata with HTTP URLs
- Points to API endpoints
- OpenSea compatible
- Includes attributes (mutations, palette, generation)

---

## 🚀 Deployment Status

### Sepolia Testnet ✅
| Component | Status | Address |
|-----------|--------|---------|
| SSTORE2 Storage (9 chunks) | ✅ Deployed | See `deployments/sepolia-storage.json` |
| Spatters.sol | ✅ Deployed | `0x875209CC6C6e4A1F87B7E2cb3D3438D105Fc0EF6` |
| SpattersGenerator.sol | ✅ Deployed | `0x1975328484d634dd8B57DBD425bc7d77CaAc3838` |
| API Wrapper | 🔨 Ready to deploy | Code complete in `api/` |
| Frontend | ✅ Built | Needs generator integration |

### Mainnet ⏳
Awaiting testing completion before mainnet deployment.

---

## 📋 Next Steps for Full Deployment

### Step 1: Deploy & Test API Service

**Option A: Quick Testing (Local)**
```bash
cd api
npm install
npm run dev  # Runs on http://localhost:3000
```

Test endpoints:
```bash
# Health check
curl http://localhost:3000/health

# Get HTML for token #1 (calls on-chain generator!)
curl http://localhost:3000/token/1

# Get PNG image
curl http://localhost:3000/image/1.png --output test.png
```

**Option B: Deploy to Heroku (Recommended for testing)**
```bash
# From api/ directory
heroku create spatters-sepolia
heroku config:set NETWORK=sepolia
git subtree push --prefix api heroku main
```

**Option C: Deploy to VPS**
```bash
# On your server
git clone https://github.com/yourusername/spatters
cd spatters/api
npm install
npm start
# Or use PM2: pm2 start server.ts --name spatters-api
```

### Step 2: Update Contract with API URL

Once API is deployed, update the `apiBase` in Spatters.sol:

```solidity
// In _buildTokenJSON function (line ~515)
string memory apiBase = "https://your-api-url.herokuapp.com";
```

Then redeploy Spatters contract (or use a proxy pattern).

**Alternative**: Make API URL updatable by owner:
```solidity
string public apiBaseUrl;
function setApiBaseUrl(string memory url) external onlyOwner {
    apiBaseUrl = url;
}
```

### Step 3: Integrate Generator in Frontend

Update your frontend to call the generator contract:

```typescript
// Add to frontend
import { SpattersGeneratorAbi } from './contracts/SpattersGenerator.json';

const GENERATOR_ADDRESS = "0x1975328484d634dd8B57DBD425bc7d77CaAc3838";

// Call on-chain generator
const html = await publicClient.readContract({
  address: GENERATOR_ADDRESS,
  abi: SpattersGeneratorAbi,
  functionName: "getTokenHtml",
  args: [BigInt(tokenId)]
});

// Display in iframe
<iframe srcDoc={html} />
```

### Step 4: Test on OpenSea Testnets

1. **Mint a token on Sepolia**
   ```bash
   npx hardhat run scripts/mint-test-token.ts --network sepolia
   ```

2. **View on OpenSea Testnets**
   - Go to: https://testnets.opensea.io/
   - Search for your contract: `0x875209CC6C6e4A1F87B7E2cb3D3438D105Fc0EF6`
   - Verify:
     - Thumbnail image loads
     - Animation URL works
     - Metadata displays correctly

3. **Test Mutations**
   ```bash
   # Wait for a mutation-eligible date
   # Then call mutate() on your token
   npx hardhat run scripts/test-mutation.ts --network sepolia
   ```

### Step 5: Verify Contracts on Etherscan

```bash
# Spatters contract
npx hardhat verify --network sepolia 0x875209CC6C6e4A1F87B7E2cb3D3438D105Fc0EF6 \
  "[\"0x8d93fe95F377226B312eFAC73b5bE75e7553b6F7\",\"0xeFd6744078407D80E27BDB041e577a0c5E7BD4bB\",\"0xD2bB75C4895500A8068087Fa025bebc4ad0eaa54\",\"0xA7B807EedCB28D66cF50a974EA034e85CB2e8C49\",\"0x985E54137b582a5050038BF5c27b9aa80c335ed5\",\"0x76a4eDEf01A3DcbBB3DE67Ab68Bb7F5550370b97\",\"0x617b9F8eb9fdc3493e1071A1a70338549E18fE1a\",\"0xa51A497301472d7ee783E982Ef4689780192A0AA\",\"0xAb16BC616d8866E17a485cD6Da8038523141ab71\"]" \
  "https://cdn.jsdelivr.net/npm/p5@1.11.2/lib/p5.min.js"

# Generator contract  
npx hardhat verify --network sepolia 0x1975328484d634dd8B57DBD425bc7d77CaAc3838 \
  "0x875209CC6C6e4A1F87B7E2cb3D3438D105Fc0EF6" \
  "[\"0x8d93fe95F377226B312eFAC73b5bE75e7553b6F7\",\"0xeFd6744078407D80E27BDB041e577a0c5E7BD4bB\",\"0xD2bB75C4895500A8068087Fa025bebc4ad0eaa54\",\"0xA7B807EedCB28D66cF50a974EA034e85CB2e8C49\",\"0x985E54137b582a5050038BF5c27b9aa80c335ed5\",\"0x76a4eDEf01A3DcbBB3DE67Ab68Bb7F5550370b97\",\"0x617b9F8eb9fdc3493e1071A1a70338549E18fE1a\",\"0xa51A497301472d7ee783E982Ef4689780192A0AA\",\"0xAb16BC616d8866E17a485cD6Da8038523141ab71\"]"
```

---

## 🎯 Mainnet Deployment Checklist

Before deploying to mainnet:

- [ ] All Sepolia tests passing
- [ ] OpenSea testnets display correctly
- [ ] API service running stably for 48+ hours
- [ ] Generator HTML verified manually for 10+ tokens
- [ ] Mutations tested successfully
- [ ] Custom palette minting tested
- [ ] Gas costs reviewed and acceptable
- [ ] Security audit (recommended for mainnet)
- [ ] Frontend thoroughly tested
- [ ] Documentation complete

**Mainnet Deployment Steps:**
1. Deploy SSTORE2 storage (same as Sepolia but on mainnet)
2. Deploy Spatters.sol to mainnet
3. Deploy SpattersGenerator.sol to mainnet
4. Mint owner reserve tokens (up to 25)
5. Deploy API to production (not Heroku - use AWS/GCP/dedicated VPS)
6. Update Spatters tokenURI with production API URL
7. Verify all contracts on Etherscan
8. Test on production OpenSea
9. Launch! 🚀

---

## 🏗️ Architecture Summary

```
┌──────────────────────────────────────┐
│ On-Chain (Ethereum)                  │
├──────────────────────────────────────┤
│ ✅ Spatters.sol (NFT Contract)       │
│    - Seed-based generation           │
│    - Time-based mutations            │
│    - Custom palettes (owner)         │
│                                      │
│ ✅ SSTORE2 Storage (9 contracts)     │
│    - spatters.js (193 KB)            │
│    - Immutable & permanent           │
│                                      │
│ ✅ SpattersGenerator.sol             │
│    - Reads SSTORE2 data              │
│    - Assembles complete HTML         │
│    - Called via web3                 │
└─────────────┬────────────────────────┘
              │
              ↓ (calls via web3)
┌──────────────────────────────────────┐
│ API Wrapper (OpenSea Compat)         │
├──────────────────────────────────────┤
│ ✅ Node.js/Express Service           │
│    - Calls SpattersGenerator         │
│    - Serves HTTP URLs                │
│    - Renders PNG thumbnails          │
│    - Open source & replicable        │
└─────────────┬────────────────────────┘
              │
              ↓
┌──────────────────────────────────────┐
│ OpenSea & Other Marketplaces         │
│ - Indexes JSON metadata              │
│ - Displays thumbnails                │
│ - Shows animation_url                │
└──────────────────────────────────────┘
```

**Key Insight**: Just like Art Blocks!
- ✅ Artwork fully on-chain (decentralized)
- ✅ Generator contract on-chain (verifiable)
- ✅ API is just a wrapper (replaceable)
- ✅ Anyone can run their own API

---

## 📚 Useful Commands

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Mint test token
npx hardhat run scripts/mint-test-token.ts --network sepolia

# Test generator
npx hardhat run scripts/test-generator.ts --network sepolia

# Start API locally
cd api && npm run dev

# Start frontend
cd frontend && npm run dev
```

---

## 🎉 What Makes This Special

1. **Fully On-Chain**: All artwork data stored permanently on Ethereum
2. **Decentralized**: Generator contract on-chain, anyone can call it
3. **Immutable**: Scripts locked after deployment, art is permanent
4. **OpenSea Compatible**: Uses industry-standard API wrapper pattern
5. **Replicable**: Open source, anyone can run their own instance
6. **Gas Optimized**: SSTORE2 for efficient storage, IR optimizer for compilation
7. **Art Blocks Model**: Following the proven architecture of industry leaders

---

## 🤝 Support

If you encounter issues:
1. Check the console logs
2. Verify contract addresses in config
3. Ensure API is running
4. Check Etherscan for transaction status
5. Review the validation docs: `FINAL_ARTBLOCKS_VALIDATION.md`

## 📄 License

MIT - Feel free to learn from, fork, and build upon this project!

---

**Built with ❤️ following the Art Blocks decentralized architecture model**




