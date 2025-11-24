# Sepolia Testnet Deployment

## Contract Information

**Contract Address:** `0xE356D1A25Bc2AD5ed85b95812D858169C98d9CC6`

**Etherscan:** https://sepolia.etherscan.io/address/0xE356D1A25Bc2AD5ed85b95812D858169C98d9CC6

**Network:** Sepolia Testnet (Chain ID: 11155111)

**Deployer Address:** `0x8b4270311fcb04f6725D5E973bCc1b78B154f6ee`

**Deployment Date:** November 24, 2025

---

## Contract Details

- **Name:** Spatters
- **Symbol:** SPAT
- **Max Supply:** 999 NFTs
- **Owner Reserve:** First 25 tokens (free for owner)
- **Public Mint Start:** Token #26 at 0.00618 ETH
- **Pricing:** Exponential (1% increase per mint)
- **Token #999 Price:** ~100 ETH

---

## Verification Status

✅ **Contract Verified on Etherscan**

View source code: https://sepolia.etherscan.io/address/0xE356D1A25Bc2AD5ed85b95812D858169C98d9CC6#code

---

## Next Steps

### 1. Mint Owner Reserve (25 tokens)

```bash
npx hardhat run scripts/mint-owner-reserve.ts --network sepolia 0xE356D1A25Bc2AD5ed85b95812D858169C98d9CC6
```

### 2. Update Frontend Configuration

Update `frontend/.env.local`:

```env
NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS=0xE356D1A25Bc2AD5ed85b95812D858169C98d9CC6
```

### 3. Test Frontend Locally

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### 4. Deploy Frontend to Vercel

```bash
cd frontend
vercel
# Add environment variables in Vercel dashboard
```

### 5. Systematic Testing

Follow testing checklist in `DEPLOYMENT.md` Phase 5

---

## Important Notes

- ⚠️ This is a **testnet deployment** - use only Sepolia ETH (no real value)
- 🔐 Contract is **immutable** once deployed - thoroughly test before mainnet
- 📝 Owner functions require deployer wallet: `0x8b4270311fcb04f6725D5E973bCc1b78B154f6ee`
- 💡 Remember to set `nvm use 22` before running Hardhat commands

---

## Development Environment

- **Node.js:** v22.21.1 (via nvm)
- **Hardhat:** v2.22.0
- **Solidity:** 0.8.20
- **OpenZeppelin:** v5.4.0
- **Ethers.js:** v6.13.0

---

## Useful Commands

```bash
# Switch to Node.js v22
nvm use 22

# Compile contracts
npx hardhat compile

# Run tests (on local network)
npx hardhat test

# Check contract state
npx hardhat run scripts/check-state.ts --network sepolia

# Withdraw ETH (owner only)
npx hardhat run scripts/withdraw.ts --network sepolia
```

---

## Gas Costs (Estimated)

- **Contract Deployment:** ~4-5M gas (~0.02-0.05 ETH on mainnet)
- **Mint (owner reserve):** ~150k gas per mint
- **Mint (public):** ~200k gas per mint
- **Mutate NFT:** ~100k gas per mutation
- **Withdraw:** ~30k gas

---

## Security Features Implemented

✅ ReentrancyGuard on all state-changing functions  
✅ Owner-only functions with Ownable  
✅ Dual cooldown system (1h global, 24h per wallet)  
✅ Max 10 NFTs per wallet  
✅ Input validation and size limits  
✅ Events for all critical actions  
✅ Overflow protection (Solidity 0.8+)

---

## Support

If you encounter issues:

1. Check you're using Node.js v22: `node --version`
2. Ensure you have Sepolia ETH: Check on Etherscan
3. Verify environment variables are set: `cat .env`
4. Review error logs and transaction on Etherscan
5. Refer to `DEPLOYMENT.md` for detailed testing steps

---

**🎉 Deployment Successful! Ready for testing phase.**

