# API RPC Gas Limit Solution

## ⚠️ Issue Discovered During Local Testing

When testing the API locally, we encountered:
```
Error: gas uint64 overflow
```

This occurs when the API tries to call `getTokenHtml()` from the on-chain generator.

## Why This Happens

- **190KB of data:** spatters.js stored across 8 SSTORE2 contracts
- **Standard RPC limits:** Default providers can't read this much data
- **Gas estimation fails:** The required gas exceeds uint64 limits

## ✅ Solution: Use Alchemy with Custom Settings

### Step 1: Get Alchemy API Key

1. Go to https://www.alchemy.com/
2. Create account (free tier works)
3. Create new app:
   - Chain: Ethereum
   - Network: Sepolia (or Mainnet for production)
4. Copy your API key

### Step 2: Update `api/server.ts`

Replace the RPC setup:

```typescript
// OLD (uses default RPC):
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

// NEW (uses Alchemy with high gas limit):
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || "your-key-here";
const rpcUrl = NETWORK === "mainnet" 
  ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl, {
    timeout: 60_000, // 60 second timeout
  }),
});
```

### Step 3: Add Environment Variable

Add to `.env`:
```
ALCHEMY_API_KEY=your_api_key_here
```

### Step 4: Set in Vercel

```bash
vercel env add ALCHEMY_API_KEY
# Enter: your_api_key_here
```

## Alternative Solution: Client-Side HTML Generation

Instead of calling the generator from the API, you can:

1. **API returns token data only** (seed, mutations, palette)
2. **Client fetches spatters.js** from SSTORE2 directly
3. **Client builds HTML** locally

This approach:
- ✅ No RPC gas limits
- ✅ Fully decentralized
- ❌ More complex frontend
- ❌ Less compatible with marketplaces

## Art Blocks Approach

Art Blocks uses **custom RPC infrastructure** with:
- Very high gas limits (100M+)
- Long timeouts (60s+)
- Caching layer

This is the same approach we'll use with Alchemy.

## Testing After Fix

Once you've added the Alchemy API key:

```bash
cd /Users/glenalbo/Desktop/spatters/api
npm run dev

# Test:
curl http://localhost:3000/token/1
# Should return full HTML!
```

## For Production

Consider adding:
- **Redis caching** (cache generated HTML for 24h)
- **CDN** (CloudFlare for static responses)
- **Rate limiting** (prevent abuse)




