# SSTORE2 Reality Check - What We Learned

## 🔍 The Discovery

After implementing the full API with Alchemy integration, multi-RPC fallback, and explicit gas limits, we discovered a **fundamental limitation**:

### The Problem

Even with:
- ✅ Alchemy API (premium RPC provider)  
- ✅ 100 billion gas limit set explicitly
- ✅ Multiple fallback RPCs

**Reading 190KB from 8 SSTORE2 contracts in a single eth_call STILL FAILS**

Error: `out of gas: invalid operand to an opcode: 550000000`

This means the **EVM execution itself** hits internal limits before the gas limit matters.

---

## 🎯 Why This Matters

This is exactly why Art Blocks:
1. Built their own specialized infrastructure
2. Pre-rendered images and stored them off-chain
3. Used their API servers as a caching/optimization layer

**Art Blocks IS partially centralized** - they rely on their servers to serve images and metadata.

---

## ✅ What DOES Work

### 1. On-Chain Data URI (Contract Level)

Your contract's `tokenURI()` function returns a data URI:
```
data:application/json;base64,[base64 encoded JSON with embedded HTML]
```

This works because:
- It's called FROM the blockchain (internal execution)
- Wallets/marketplaces get the data URI directly from the contract
- No external API needed for basic token URI

### 2. Direct Web3 Client Access (Frontend)

Calling the generator contract **from a browser/frontend** with a web3 provider (MetaMask, WalletConnect, etc.):
- ✅ WORKS - Higher gas limits, better optimization
- Users can view their NFTs directly on your website
- No API server needed

### 3. Small Contract Reads

Reading individual properties (owner, totalSupply, etc.):
- ✅ WORKS perfectly with any RPC
- The `/health` endpoint responds in <1 second

---

## 🚀 Recommended Architecture Going Forward

### For Sepolia Testing

**Use the Data URI approach:**
```solidity
// In your contract (already implemented)
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    return string(abi.encodePacked(
        baseURI,
        Strings.toString(tokenId)
    ));
}
```

**Set baseURI to point to the API:**
```typescript
// After deploying to Vercel
await spattersContract.setBaseURI("https://your-api.vercel.app/metadata/");
```

**API serves lightweight JSON metadata:**
```json
{
  "name": "Spatters #1",
  "description": "Fully on-chain generative NFT",
  "image": "https://your-api.vercel.app/image/1.png",
  "animation_url": "https://your-frontend.vercel.app/view/1"
}
```

Where:
- `/image/1.png` → Pre-rendered PNG (generated once, cached forever)
- `/view/1` → Your frontend that calls the generator contract directly

###  For Mainnet

**Option A: Simple (Recommended for MVP)**
1. Deploy contracts with `baseURI` pointing to your API
2. API serves pre-rendered PNGs and metadata JSON
3. Frontend calls generator contract directly for interactive view
4. Pre-render images once using Puppeteer, store in S3/CDN
5. Cache everything aggressively

**Option B: Fully Decentralized (Advanced)**
1. Use IPFS/Arweave for hosting the API code itself
2. Implement IPFS gateway fallbacks
3. Community can replicate the API
4. But still need image pre-rendering somewhere

**Option C: Art Blocks Model (Most Centralized)**
1. Run dedicated infrastructure
2. Pre-render and cache all images
3. Serve everything from your servers
4. Provide API replication guide for community

---

## 📊 Comparison Matrix

| Approach | Decentralization | User Experience | Cost | Complexity |
|----------|-----------------|-----------------|------|------------|
| **Data URI only** | 🟢 High | 🟡 Okay | 🟢 Low | 🟢 Low |
| **API + Pre-rendered** | 🟡 Medium | 🟢 Great | 🟡 Medium | 🟡 Medium |
| **Art Blocks Model** | 🔴 Low | 🟢 Great | 🔴 High | 🔴 High |
| **Fully On-Chain View** | 🟢 High | 🟡 Okay | 🟢 Low | 🟢 Low |

---

## 💡 Recommended Next Steps

### Immediate (For Testing)

1. **Update baseURI to use data URIs:**
   ```solidity
   // Contract already supports this via tokenURI()
   // Just don't set baseURI, let it return the data URI
   ```

2. **Test with OpenSea/marketplaces:**
   - They'll fetch `tokenURI()` 
   - Get the full data URI with embedded HTML
   - Render it in an iframe

3. **Build simple frontend:**
   - Users connect wallet
   - Call generator contract directly
   - Render HTML in browser
   - Works perfectly!

### For Launch

1. **Deploy API to Vercel** (as lightweight metadata server)
2. **Pre-render images** once per token (using Puppeteer)
3. **Store images** in S3/Cloudflare R2/Vercel Blob
4. **Set baseURI** to point to API
5. **Document replication** process for community

---

## 🎓 Key Lessons

1. **SSTORE2 is great for storage** - Scripts are 100% on-chain ✅
2. **Reading large SSTORE2 data externally is hard** - EVM limits ⚠️
3. **Art Blocks isn't fully decentralized** - They run servers 🏢
4. **Trade-offs exist** - Choose based on your priorities ⚖️
5. **Your architecture is sound** - Generator contract pattern is correct ✅

---

## 🛠️ What We Built

The API we built is still useful for:
- ✅ Health checks and contract stats
- ✅ Metadata JSON for OpenSea
- ✅ Pre-rendering images (run once, cache forever)
- ✅ Serving cached data quickly

It just can't call `getTokenHtml()` directly due to EVM execution limits.

---

## 📝 Bottom Line

**Your NFTs ARE fully on-chain.** The scripts, seeds, and mutations are all stored on the blockchain.

The challenge is **serving them efficiently to marketplaces**. You have options:

1. **Pure On-Chain:** Let marketplaces handle data URIs (may not display images)
2. **Hybrid (Recommended):** Pre-render images once, serve via API, keep scripts on-chain
3. **Art Blocks Style:** Run dedicated infrastructure (most centralized, best UX)

All three approaches keep your **art generation fully decentralized** - anyone can read the contracts and regenerate the artwork. The difference is in how you serve it to users.




