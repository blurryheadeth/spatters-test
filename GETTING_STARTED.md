# Getting Started with Spatters

Welcome! Your Spatters NFT project is fully built and ready for deployment. This guide will help you get started quickly.

## 🎉 What's Been Completed

✅ **Smart Contracts** (Production-Ready)
- Spatters.sol - Main NFT contract with all features
- ExponentialPricing.sol - Pricing curve library
- MetadataParser.sol - Metadata parsing utilities
- DateTime.sol - Date/time calculations

✅ **Testing & Deployment**
- Comprehensive test suite
- Deployment scripts for testnet and mainnet
- Owner reserve minting script
- Pricing verification script

✅ **Frontend** (Modern Web3 Interface)
- Next.js 15 + TypeScript
- Wagmi + RainbowKit for Web3
- Minting interface with 3-choice selection
- Wallet connection
- Real-time contract data

✅ **Documentation**
- README.md - Project overview
- DEPLOYMENT.md - Step-by-step deployment guide
- PROJECT_SUMMARY.md - Technical details
- This file - Quick start guide

## 🚀 Quick Start (5 Minutes)

### 1. Push to GitHub

First, authenticate with GitHub:

```bash
# If repository is private, you may need to authenticate
gh auth login
# Or use SSH instead of HTTPS
git remote set-url origin git@github.com:blurryheadeth/spatters.git

# Then push
cd /Users/glenalbo/Desktop/spatters
git push -u origin main
```

### 2. Install Dependencies

```bash
# Smart contracts
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 3. Set Up Environment Variables

Create `.env` in project root:

```bash
# Copy from example
cat > .env << 'EOF'
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_key
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_API_KEY=your_pinata_secret
EOF
```

### 4. Test Compilation

```bash
npx hardhat compile
```

You should see:
```
Compiled 4 Solidity files successfully
```

### 5. Run Tests

```bash
npx hardhat test
```

All tests should pass! ✅

## 📝 What You Need to Get

Before deployment, sign up for these free services:

1. **Alchemy** (RPC Provider)
   - Go to: https://www.alchemy.com/
   - Create free account
   - Create apps for Sepolia + Mainnet
   - Copy API keys

2. **Etherscan** (Contract Verification)
   - Go to: https://etherscan.io/
   - Create account
   - Generate API key
   - Copy key

3. **Pinata** (IPFS Storage)
   - Go to: https://www.pinata.cloud/
   - Create free account
   - Generate API keys
   - Copy both keys

4. **WalletConnect** (Frontend Wallet Connection)
   - Go to: https://cloud.walletconnect.com/
   - Create free project
   - Copy Project ID

5. **Sepolia Testnet ETH**
   - Go to: https://sepoliafaucet.com/
   - Enter your wallet address
   - Request test ETH

## 📋 Deployment Checklist

### Phase 1: Testnet (Safe Testing)

- [ ] Get Sepolia testnet ETH from faucet
- [ ] Update `.env` with all API keys
- [ ] Run `npx hardhat compile`
- [ ] Run `npx hardhat test`
- [ ] Deploy: `npx hardhat run scripts/deploy.ts --network sepolia`
- [ ] Save contract address!
- [ ] Verify: `npx hardhat verify --network sepolia <ADDRESS>`
- [ ] Mint owner tokens: `npx hardhat run scripts/mint-owner-reserve.ts --network sepolia <ADDRESS>`
- [ ] Update frontend `.env.local` with contract address
- [ ] Test frontend locally: `cd frontend && npm run dev`
- [ ] Test minting from different wallet
- [ ] Deploy frontend to Vercel

### Phase 2: Security Review

- [ ] Review all contract code
- [ ] Test all anti-whale protections
- [ ] Test mutation eligibility
- [ ] Test withdraw function
- [ ] Consider professional audit (recommended for mainnet)

### Phase 3: Mainnet (Real Launch)

⚠️ **Only proceed after thorough testnet testing!**

- [ ] Get real ETH for deployment (~0.3-0.5 ETH for gas)
- [ ] Update `.env` with mainnet RPC
- [ ] Deploy: `npx hardhat run scripts/deploy.ts --network mainnet`
- [ ] **IMMEDIATELY SAVE CONTRACT ADDRESS**
- [ ] Verify: `npx hardhat verify --network mainnet <ADDRESS>`
- [ ] Mint owner reserve
- [ ] Update frontend with mainnet address
- [ ] Deploy production frontend
- [ ] Setup OpenSea collection
- [ ] Launch! 🚀

## 📖 Important Files to Read

1. **README.md** - Overview, features, API docs
2. **DEPLOYMENT.md** - Detailed deployment walkthrough
3. **PROJECT_SUMMARY.md** - Technical architecture details

## 🔍 Project Structure Overview

```
spatters/
├── contracts/          # Solidity smart contracts
├── scripts/            # Deployment and utility scripts  
├── test/              # Contract tests
├── frontend/          # Next.js web interface
│   ├── app/          # Pages and layouts
│   ├── components/   # React components
│   └── lib/          # Utilities and config
├── spatters.html      # p5.js generative art script
└── *.md              # Documentation
```

## 💡 Quick Commands Reference

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Verify contract
npx hardhat verify --network sepolia <ADDRESS>

# Run frontend
cd frontend && npm run dev

# Build frontend
cd frontend && npm run build
```

## ⚠️ Important Security Notes

1. **NEVER commit `.env` file** - It contains your private key!
2. **Test everything on Sepolia first** - Don't skip testnet!
3. **Backup your private key** - Store it securely offline
4. **Double-check contract address** before updating frontend
5. **Start with small mainnet test** - Mint one token first to verify

## 🆘 Common Issues & Solutions

### "Repository not found" when pushing to GitHub

Solution: The repo might be private or you need authentication:
```bash
gh auth login
# Or use SSH: git remote set-url origin git@github.com:blurryheadeth/spatters.git
```

### "Insufficient funds" error

Solution: Make sure you have enough ETH:
- Testnet: Get from faucet
- Mainnet: Need ~0.3-0.5 ETH for deployment + gas

### "Contract not found" in frontend

Solution: Update `frontend/.env.local` with correct contract address

### Tests failing

Solution: Make sure you compiled first:
```bash
npx hardhat compile
npx hardhat test
```

## 📞 Next Steps

1. **Today**: Push to GitHub, set up API accounts
2. **This week**: Deploy to Sepolia, test thoroughly
3. **Before launch**: Security review, community prep
4. **Launch day**: Deploy to mainnet, go live!

## 🎯 Success Criteria

Your project is ready when:
- ✅ All tests pass
- ✅ Contract deploys successfully to Sepolia
- ✅ Frontend connects and displays data correctly
- ✅ Can mint tokens successfully
- ✅ Mutations work on eligible dates
- ✅ All security checks completed

## 🌟 You're All Set!

Everything is built and ready. Follow the DEPLOYMENT.md guide step-by-step, and you'll have your NFT collection live on Ethereum!

**Questions?** Review the documentation files or check the code comments.

**Good luck with your launch!** 🎨🚀

---

**Built with**: Solidity, Hardhat, Next.js, wagmi, RainbowKit, TailwindCSS
**Network**: Ethereum (Sepolia testnet + Mainnet)
**License**: MIT


