# Spatters API - OpenSea Compatibility Layer

This is a thin API wrapper that calls the **fully on-chain** `SpattersGenerator` contract and serves HTTP URLs for marketplace compatibility (OpenSea, LooksRare, etc.).

## Architecture

```
┌─────────────────────────────────┐
│ On-Chain (Fully Decentralized) │
├─────────────────────────────────┤
│ • Spatters.sol (NFT Contract)   │
│ • SSTORE2 Storage (spatters.js) │
│ • SpattersGenerator.sol         │
│   - Reads from SSTORE2          │
│   - Assembles HTML              │
│   - Returns complete artwork    │
└────────────┬────────────────────┘
             │
             ↓ (calls via web3)
┌─────────────────────────────────┐
│ This API (Marketplace Compat)   │
├─────────────────────────────────┤
│ • Calls on-chain generator      │
│ • Serves HTTP endpoints         │
│ • Renders PNG thumbnails        │
│ • Open source & replicable      │
└─────────────────────────────────┘
```

## Why This Approach?

**Same model as Art Blocks:**
- ✅ Artwork fully on-chain (immutable, permanent)
- ✅ Generator contract on-chain (decentralized)
- ✅ API is just a convenience wrapper
- ✅ Anyone can run their own API
- ✅ Art survives even if API goes offline

## Installation

```bash
cd api
npm install
```

## Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

## Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## Endpoints

### GET `/health`
Health check with contract info

### GET `/token/:id`
Returns complete HTML for a token (calls on-chain generator)

Example: `http://localhost:3000/token/1`

### GET `/image/:id.png`
Returns PNG image (renders HTML with Puppeteer)

Example: `http://localhost:3000/image/1.png`

### GET `/data/:id`
Returns data URI (base64 encoded HTML)

Example: `http://localhost:3000/data/1`

## Deployment

### Option 1: Simple VPS (Recommended for testing)

```bash
# On your server
git clone https://github.com/yourusername/spatters
cd spatters/api
npm install
npm start
```

### Option 2: Heroku

```bash
heroku create spatters-api
heroku config:set NETWORK=mainnet
git push heroku main
```

### Option 3: Vercel/Netlify

Deploy as serverless functions (see their docs).

## Performance Optimization

For production, consider:

1. **Caching**: Cache generated HTML/images in Redis or S3
2. **CDN**: Serve static assets via CDN
3. **Rate Limiting**: Prevent abuse
4. **Background Jobs**: Render images asynchronously
5. **Load Balancing**: Multiple API instances

## Replicability

Anyone can run their own Spatters API:

1. Clone this repo
2. Update contract addresses in `server.ts`
3. Run `npm install && npm start`

**No proprietary dependencies!** All data is on-chain.

## License

MIT - Feel free to run your own instance!




