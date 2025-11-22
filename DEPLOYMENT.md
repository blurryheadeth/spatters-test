# Spatters Deployment Guide

Complete step-by-step guide for deploying the Spatters NFT collection to testnet and mainnet.

## Pre-Deployment Checklist

- [ ] Node.js 22.x LTS installed
- [ ] MetaMask wallet configured
- [ ] Sufficient ETH for gas fees (testnet and mainnet)
- [ ] Alchemy account created (for RPC)
- [ ] Etherscan account created (for verification)
- [ ] Pinata account created (for IPFS)
- [ ] WalletConnect account created (for frontend)

## Step 1: Environment Setup

### 1.1 Configure Root `.env` (Smart Contracts)

Create `/spatters/.env`:

```env
# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Private Key (NEVER commit this!)
PRIVATE_KEY=your_private_key_without_0x_prefix

# Etherscan API Key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Pinata API Keys
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
```

### 1.2 Get Your Private Key from MetaMask

1. Open MetaMask
2. Click the three dots menu
3. Account details → Show private key
4. Enter password
5. Copy the private key (without 0x prefix)

⚠️ **SECURITY WARNING**: Never share this key or commit it to git!

### 1.3 Get Alchemy API Key

1. Go to https://www.alchemy.com/
2. Create an account
3. Create a new app for Sepolia
4. Copy the API key from the app dashboard
5. Create another app for Mainnet (when ready)

### 1.4 Get Etherscan API Key

1. Go to https://etherscan.io/
2. Create an account
3. Go to API Keys section
4. Create a new API key
5. Copy the key

### 1.5 Get Pinata API Keys

1. Go to https://www.pinata.cloud/
2. Create account (free tier is sufficient)
3. Go to API Keys
4. Create new API key with admin access
5. Copy both API Key and Secret

## Step 2: Sepolia Testnet Deployment

### 2.1 Get Testnet ETH

1. Go to https://sepoliafaucet.com/
2. Enter your wallet address
3. Request testnet ETH

Alternatively:
- https://www.alchemy.com/faucets/ethereum-sepolia

### 2.2 Deploy Contract to Sepolia

```bash
# From project root
cd /Users/glenalbo/Desktop/spatters

# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia
```

**Save the contract address from the output!**

Example output:
```
✅ Spatters deployed to: 0x1234567890123456789012345678901234567890
```

### 2.3 Verify Contract on Etherscan

```bash
npx hardhat verify --network sepolia 0x1234567890123456789012345678901234567890
```

### 2.4 Mint Owner Reserve (First 25 Tokens)

```bash
npx hardhat run scripts/mint-owner-reserve.ts --network sepolia 0x1234567890123456789012345678901234567890
```

This will mint all 25 owner reserve tokens to your address.

### 2.5 Configure Frontend for Sepolia

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret_key
```

### 2.6 Test Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and test:
- [ ] Wallet connection
- [ ] Price display
- [ ] Preview generation
- [ ] Minting process
- [ ] Transaction confirmation

### 2.7 Test Mutations

After minting, test the mutation eligibility:

1. Check `canMutate` for your test tokens
2. Wait for an eligible date or use time manipulation in local testing
3. Attempt mutations to ensure they work correctly

### 2.8 Deploy Frontend to Vercel (Testnet)

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts, add environment variables in Vercel dashboard
```

### 2.9 Comprehensive Testing

Test ALL features on Sepolia:
- [ ] Public minting (from different wallet)
- [ ] Anti-whale protection (try minting more than 10 per wallet)
- [ ] Global cooldown enforcement (1 hour between any mints)
- [ ] Per-wallet cooldown enforcement (24 hours between same wallet's mints)
- [ ] First public mint (token #26) bypasses global cooldown
- [ ] Metadata display
- [ ] Mutation eligibility checks
- [ ] ETH withdrawal by owner
- [ ] Contract balance verification

## Step 3: Security Review

Before mainnet deployment, review:

### 3.1 Smart Contract Security

- [ ] Reentrancy protection verified
- [ ] Access controls tested
- [ ] Integer overflow protection confirmed (Solidity 0.8+)
- [ ] Gas optimization reviewed
- [ ] Event emissions verified

### 3.2 Frontend Security

- [ ] Environment variables never exposed to client
- [ ] Private keys never sent to frontend
- [ ] Input validation on all user inputs
- [ ] RPC endpoints rate-limited
- [ ] IPFS gateways have fallbacks

### 3.3 Economic Security

- [ ] Pricing curve verified mathematically
- [ ] Dual cooldown system tested (1h global + 24h per-wallet)
- [ ] Launch timeline understood (minimum 41 days for full collection)
- [ ] Withdrawal function tested
- [ ] No way to bypass mint limits

### 3.4 Optional: Third-Party Audit

For mainnet launch, consider:
- Smart contract audit by professional firm
- Bug bounty program
- Community review period

## Step 4: Mainnet Deployment

⚠️ **FINAL CHECKLIST BEFORE MAINNET**:
- [ ] All testnet testing complete
- [ ] Security review complete
- [ ] Sufficient ETH for deployment (~0.1-0.5 ETH)
- [ ] Backups of all code and keys
- [ ] Emergency procedures documented
- [ ] Community prepared for slow launch pace (minimum 41 days)

**📅 Launch Timeline Note**: The dual cooldown system (1-hour global + 24-hour per-wallet) ensures a fair, deliberate launch. The 974 public tokens will take a minimum of 41 days to fully mint (1 NFT per hour maximum pace). This prevents whale accumulation and bot rushing while building community engagement over time.

### 4.1 Deploy to Mainnet

```bash
# Deploy contract
npx hardhat run scripts/deploy.ts --network mainnet

# SAVE THE CONTRACT ADDRESS IMMEDIATELY!
```

### 4.2 Verify on Etherscan

```bash
npx hardhat verify --network mainnet 0xYOUR_MAINNET_CONTRACT_ADDRESS
```

### 4.3 Mint Owner Reserve

```bash
npx hardhat run scripts/mint-owner-reserve.ts --network mainnet 0xYOUR_MAINNET_CONTRACT_ADDRESS
```

### 4.4 Update Frontend Configuration

Update `frontend/.env.local`:

```env
NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS=0xYOUR_MAINNET_CONTRACT_ADDRESS
NEXT_PUBLIC_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### 4.5 Deploy Frontend to Production

```bash
cd frontend

# Production deployment
vercel --prod

# Update environment variables in Vercel dashboard for production
```

### 4.6 Test Production

- [ ] Connect with real wallet
- [ ] Verify pricing display
- [ ] Test mint flow (with small amount)
- [ ] Verify transaction on Etherscan
- [ ] Check metadata display

## Step 5: Post-Launch

### 5.1 OpenSea Collection Setup

1. Go to https://opensea.io/
2. Connect your wallet (collection owner)
3. Find your collection (it will auto-index)
4. Edit collection details:
   - Name: Spatters
   - Description: [Write compelling description]
   - Banner and logo images
   - Social links
   - Creator earnings (royalties)

### 5.2 Marketing & Community

- [ ] Twitter/X announcement
- [ ] Discord server setup
- [ ] Website analytics (Google Analytics/Plausible)
- [ ] Press release preparation
- [ ] Influencer outreach

### 5.3 Monitoring

Set up monitoring for:
- Contract events (mints, mutations)
- Gas prices (for user guidance)
- Transaction failures
- Website uptime
- Community feedback

### 5.4 Ongoing Maintenance

- [ ] Monitor contract for issues
- [ ] Respond to community questions
- [ ] Track mutation dates
- [ ] Update frontend as needed
- [ ] Maintain IPFS pinning

## Emergency Procedures

### Contract Issues

If critical bug discovered:
1. Pause further minting if possible (contract doesn't have pause function currently)
2. Communicate immediately with community
3. Document the issue
4. Prepare fix if possible

### Frontend Issues

1. Revert to previous Vercel deployment
2. Fix issue locally
3. Re-deploy after testing

### Lost Access

- Keep backup of private keys in secure location
- Consider multi-sig wallet for ownership
- Document recovery procedures

## Support Resources

- Hardhat Docs: https://hardhat.org/docs
- OpenZeppelin: https://docs.openzeppelin.com/
- Etherscan: https://etherscan.io/
- Alchemy: https://docs.alchemy.com/
- Vercel: https://vercel.com/docs

## Success Metrics

Track these after launch:
- Total minted / 999
- Unique holders
- Secondary sales volume
- Community engagement
- Mutation activity
- Floor price

---

Good luck with your launch! 🚀


