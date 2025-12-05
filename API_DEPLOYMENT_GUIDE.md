# Spatters API Deployment Guide

## ✅ Phase 1 Complete!

Successfully deployed:
- ✅ Updated spatters.js (with click-to-cycle feature) to SSTORE2 (8 chunks)
- ✅ Spatters.sol with community governance features
- ✅ SpattersGenerator.sol for on-chain HTML generation
- ✅ Updated API with new contract addresses

### Deployed Contracts (Sepolia)

```
Spatters NFT Contract:
0xb974f4e503E18d03533d0E64692E927d806677b0

SpattersGenerator Contract:
0x0e0BA1EE77567b99ab4aEde8AC10C4C4874d4530

SSTORE2 Storage (spatters.js):
- Chunk 1: 0x46C164274f65DB75020cEA1Fd3d6fBb29a26EBdf
- Chunk 2: 0xa75178aFac493a54F3d0901ecBa7AF0eD04a512F
- Chunk 3: 0x20A8c37144EB274C980bC3e015Df478FddC95399
- Chunk 4: 0x2181DDD088D5e71575Af1b76f1f47cA499bBeC06
- Chunk 5: 0x1AbD064F532E50d12FE5d4737D0bD0a15EDf85a3
- Chunk 6: 0x1C1c3Ea5951771e96360c0D93B76AFD29c6a4f74
- Chunk 7: 0xfcdc6d5f6aEBa188F711Ae5A6e6E3c054d86fFdD
- Chunk 8: 0xF10aafDe4b5b1c016f646d44bc6c4D51126C91f9
```

---

## 🧪 Part 1: Test API Locally

### Step 1: Install Dependencies

```bash
cd /Users/glenalbo/Desktop/spatters/api
npm install
```

### Step 2: Set Environment Variables

Create `.env` file in `/api` folder:

```env
PORT=3000
NETWORK=sepolia
```

### Step 3: Start Local Server

```bash
npm run dev
```

### Step 4: Test Endpoints

Open your browser or use curl:

#### **Health Check**
```bash
# Browser: http://localhost:3000/health

# Curl:
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "network": "sepolia",
  "contracts": {
    "spatters": "0xb974f4e503E18d03533d0E64692E927d806677b0",
    "generator": "0x0e0BA1EE77567b99ab4aEde8AC10C4C4874d4530"
  }
}
```

#### **Test HTML Generation (After Minting a Token)**

First, mint a test token:

```bash
cd /Users/glenalbo/Desktop/spatters
npx hardhat run scripts/mint-test-token.ts --network sepolia
```

Then test the API:

```bash
# Browser: http://localhost:3000/token/1

# Curl:
curl http://localhost:3000/token/1
```

**Expected Response:**
- Full HTML page with embedded p5.js and spatters.js
- Should render the NFT artwork when opened in browser

#### **Test PNG Generation (Optional - Requires Puppeteer)**

```bash
# Browser: http://localhost:3000/image/1.png

# This will:
# 1. Call on-chain generator to get HTML
# 2. Render HTML in headless Chrome
# 3. Take screenshot
# 4. Return PNG image
```

**Note:** PNG generation may be slow (20s+) and Puppeteer might not work in Vercel's free tier.

---

## 🚀 Part 2: Deploy to Vercel

### Step 1: Prepare for Deployment

#### Option A: Deploy Without PNG Generation (Recommended)

If you don't need `/image/:id.png` endpoint:

**Update `api/server.ts`** - comment out the image endpoint:

```typescript
// Comment out or remove this endpoint:
/*
app.get("/image/:id.png", async (req, res) => {
  // ... PNG generation code ...
});
*/
```

This avoids Puppeteer compatibility issues on Vercel's free tier.

#### Option B: Deploy With PNG Generation (Advanced)

Keep the code as-is, but note:
- Requires Vercel Pro plan for larger function size
- PNG generation will be slow (~30s timeout risk)
- Consider using a dedicated image generation service instead

### Step 2: Create Vercel Account

1. Go to https://vercel.com/signup
2. Sign up with GitHub (recommended for easy deployment)

### Step 3: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 4: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 5: Configure Environment Variables

Vercel will need your environment variables:

```bash
# From the /api directory:
cd /Users/glenalbo/Desktop/spatters/api

# Add environment variables:
vercel env add NETWORK
# Enter: sepolia

vercel env add PORT
# Enter: 3000
```

### Step 6: Deploy

```bash
# From /api directory:
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: spatters-api (or your choice)
# - Directory: ./ (current)
# - Override settings? No

# Deploy to production:
vercel --prod
```

### Step 7: Get Your Deployment URL

After deployment, Vercel will give you a URL like:
```
https://spatters-api-abc123.vercel.app
```

### Step 8: Test Production API

```bash
# Health check:
curl https://spatters-api-abc123.vercel.app/health

# Token endpoint:
curl https://spatters-api-abc123.vercel.app/token/1
```

### Step 9: Update Spatters Contract BaseURI

Once the API is working, update your contract:

```bash
cd /Users/glenalbo/Desktop/spatters

# Open Hardhat console:
npx hardhat console --network sepolia

# In the console:
> const spatters = await ethers.getContractAt("Spatters", "0xb974f4e503E18d03533d0E64692E927d806677b0")

> await spatters.setBaseURI("https://spatters-api-abc123.vercel.app/token/")
# Note the trailing slash!

# Wait for transaction confirmation...

# Verify:
> await spatters.tokenURI(1)
# Should return: "https://spatters-api-abc123.vercel.app/token/1"
```

---

## 🎨 Part 3: Test on OpenSea

### Step 1: Wait for Indexing

OpenSea typically takes 1-24 hours to index new tokens on testnets.

### Step 2: Find Your NFT

Go to:
```
https://testnets.opensea.io/assets/sepolia/0xb974f4e503E18d03533d0E64692E927d806677b0/1
```

### Step 3: Refresh Metadata (If Needed)

If the NFT doesn't display correctly:
1. Click the three dots menu
2. Select "Refresh metadata"
3. Wait 5-10 minutes

---

## 📊 Monitoring & Debugging

### Check Vercel Logs

```bash
vercel logs <deployment-url>
```

### Check Contract Events

```bash
npx hardhat console --network sepolia

> const spatters = await ethers.getContractAt("Spatters", "0xb974f4e503E18d03533d0E64692E927d806677b0")

# Check baseURI:
> await spatters.baseURI()

# Check tokenURI:
> await spatters.tokenURI(1)

# Check owner:
> await spatters.owner()
```

### Test On-Chain Generator Directly

You can bypass the API and call the generator directly:

```bash
npx hardhat console --network sepolia

> const gen = await ethers.getContractAt("SpattersGenerator", "0x0e0BA1EE77567b99ab4aEde8AC10C4C4874d4530")

# This will fail with "out of gas" from Hardhat, but proves the contract exists:
> await gen.getTokenHtml(1)

# Check if spatters address is correct:
> await gen.SPATTERS_CONTRACT()
# Should return: 0xb974f4e503E18d03533d0E64692E927d806677b0
```

---

## 🔒 Security Notes

### Production Checklist

Before deploying to mainnet:

- [ ] Test all endpoints on Sepolia testnet
- [ ] Verify artwork renders correctly in OpenSea
- [ ] Test click-to-cycle feature works
- [ ] Verify governance functions (time-travel test)
- [ ] Set proper rate limiting on API
- [ ] Consider using a custom domain
- [ ] Set up monitoring/alerting
- [ ] Document API for community (for future replication)

### Rate Limiting

Add to `server.ts` for production:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

---

## 🎯 Next Steps

1. **Test locally** ✅ (you should do this now)
2. **Mint test token** (to verify everything works)
3. **Deploy to Vercel** (when ready)
4. **Update contract baseURI**
5. **Test on OpenSea** (verify marketplace display)
6. **Write governance tests** (important before mainnet!)
7. **Deploy to mainnet** (final step)

---

## 💡 Troubleshooting

### Issue: API returns 500 error

**Check:**
- Contract addresses are correct in `server.ts`
- Network is set to "sepolia"
- RPC endpoint is accessible (default Viem RPC should work)

### Issue: HTML is empty or garbled

**Check:**
- Token exists (has been minted)
- Generator contract can access SSTORE2 storage
- All 8 storage addresses are valid

### Issue: OpenSea doesn't display metadata

**Check:**
- baseURI is set correctly (with trailing slash)
- API is publicly accessible
- Token has been minted
- Wait 1-24 hours for indexing

### Issue: Puppeteer fails on Vercel

**Solution:**
- Remove `/image/:id.png` endpoint
- Or upgrade to Vercel Pro
- Or use a separate image generation service

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Art Blocks Generator Viewer](https://github.com/ArtBlocks/artblocks-contracts)
- [OpenSea Developer Docs](https://docs.opensea.io/)

---

## 🆘 Need Help?

If you encounter issues:

1. Check Vercel logs: `vercel logs`
2. Check contract on Etherscan: https://sepolia.etherscan.io/address/0xb974f4e503E18d03533d0E64692E927d806677b0
3. Test generator directly (see Monitoring section above)
4. Verify storage addresses are deployed and contain data




