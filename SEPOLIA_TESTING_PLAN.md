# Sepolia Testing Plan - Complete Validation Before Mainnet

## Overview

This plan ensures EVERY feature works correctly on Sepolia testnet before mainnet launch. We'll test the full stack: smart contract, frontend, and integration.

---

## Phase 1: Contract Deployment to Sepolia

### Step 1: Pre-Deployment Checklist
- ✅ All 43 tests passing locally
- ✅ `.env` file configured with:
  - `SEPOLIA_RPC_URL` (from Alchemy)
  - `PRIVATE_KEY` (your deployment wallet)
  - `ETHERSCAN_API_KEY` (for verification)

### Step 2: Deploy Contract
```bash
cd /Users/glenalbo/Desktop/spatters
npx hardhat run scripts/deploy.ts --network sepolia
```

**Expected Output:**
- Contract address (save this!)
- Gas used (~2-3M gas)
- Owner address confirmation
- ABI automatically saved to `frontend/contracts/Spatters.json`

### Step 3: Verify on Etherscan
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

**Validation:**
- ✅ Contract source code visible on Sepolia Etherscan
- ✅ Read/Write functions accessible
- ✅ Can view contract state

---

## Phase 2: Script Storage Setup

### Challenge: On-Chain Code Storage

**Options:**

1. **Option A: Use Art Blocks p5.js + Deploy Spatters.js**
   - Art Blocks p5.js may not be on Sepolia
   - Need to find or deploy p5.js separately
   - Deploy spatters.js via scripty.sol or SSTORE2

2. **Option B: Temporary IPFS/Arweave for Testing**
   - Faster to set up for initial testing
   - Validates everything except final on-chain storage
   - Migrate to full on-chain before mainnet

3. **Option C: Embedded in Contract (Quick Test)**
   - Temporarily embed scripts directly in contract
   - Only for testing - not production ready
   - Allows immediate frontend testing

**Recommendation for Testing:** Use Option C initially to validate frontend, then implement Option A for final deployment.

### Step 4: Set Script Addresses (If Using Option A)
```bash
CONTRACT_ADDRESS=0x... \
P5JS_SCRIPT_ADDRESS=0x... \
SPATTERS_SCRIPT_ADDRESS=0x... \
npx hardhat run scripts/set-script-addresses.ts --network sepolia
```

---

## Phase 3: Owner Minting Tests

### Test 1: Owner Mint Without Custom Palette
```bash
CONTRACT_ADDRESS=0x... \
MINT_TO=<YOUR_WALLET> \
npx hardhat run scripts/mint-owner-reserve.ts --network sepolia
```

**Validation:**
- ✅ Token minted successfully
- ✅ Token ID #1 created
- ✅ Collection launch date set
- ✅ View on Sepolia OpenSea (after indexing)
- ✅ TokenURI returns valid HTML
- ✅ HTML renders artwork correctly in browser

### Test 2: Owner Mint With Custom Palette
```bash
CONTRACT_ADDRESS=0x... \
CUSTOM_PALETTE="#ed0caa,#069133,#DF9849,#EDECF0,#eddcab,#cfa6fc" \
npx hardhat run scripts/mint-owner-reserve.ts --network sepolia
```

**Validation:**
- ✅ Token minted successfully
- ✅ Custom palette stored on-chain
- ✅ Query `getCustomPalette(tokenId)` returns correct colors
- ✅ TokenURI HTML includes custom palette
- ✅ Artwork uses custom colors when rendered

### Test 3: Owner Reserve Exhaustion
```bash
# Mint tokens 3-25 as needed
# Then verify token 26 cannot be minted via ownerMint()
```

**Validation:**
- ✅ After 25 tokens, `ownerMint()` reverts
- ✅ Error message: "Owner reserve exhausted"

---

## Phase 4: Frontend Testing

### Step 1: Configure Frontend
```bash
cd frontend
# Update .env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=<SEPOLIA_CONTRACT_ADDRESS>
NEXT_PUBLIC_CHAIN_ID=11155111
```

### Step 2: Start Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Step 3: Test Public Mint Flow

**Test 3A: Request Mint**
1. Connect wallet with Sepolia ETH
2. Click "Public Mint" tab
3. Click "Request Mint" button
4. Confirm transaction in wallet
5. Wait for confirmation

**Validation:**
- ✅ Transaction succeeds
- ✅ Gas cost reasonable (~180K gas)
- ✅ 3 seeds generated
- ✅ Preview generation starts

**Test 3B: Preview Generation**
1. Wait for 3 previews to load
2. Each should show unique artwork

**Validation:**
- ✅ 3 different artworks displayed
- ✅ Each takes ~20 seconds to generate (acceptable)
- ✅ Seeds are visible/logged
- ✅ No errors in console

**Test 3C: Select & Complete Mint**
1. Click on one of the 3 previews
2. Confirm "Complete Mint" transaction
3. Wait for confirmation

**Validation:**
- ✅ Transaction succeeds
- ✅ Gas cost reasonable (~120K gas)
- ✅ NFT appears in wallet
- ✅ Success message displayed
- ✅ Can mint again after cooldown

### Step 4: Test Owner Mint UI

**Test 4A: Owner Access Control**
1. Connect with non-owner wallet
2. Click "Owner Mint" tab

**Validation:**
- ✅ Shows "Owner minting restricted" message
- ✅ Cannot access mint form

**Test 4B: Owner Mint Without Palette**
1. Connect with owner wallet
2. Enter recipient address
3. Leave "Use Custom Palette" unchecked
4. Click "Mint Token"

**Validation:**
- ✅ Transaction succeeds
- ✅ Token minted to recipient
- ✅ No custom palette stored
- ✅ Uses default colors

**Test 4C: Owner Mint With Palette**
1. Check "Use Custom Palette"
2. Set 6 colors using color pickers
3. Verify hex values show correctly
4. Click "Mint Token"

**Validation:**
- ✅ Color validation works
- ✅ Invalid colors rejected
- ✅ Transaction succeeds
- ✅ Custom palette stored on-chain
- ✅ Artwork uses custom colors

---

## Phase 5: Anti-Whale Testing

### Test 5A: Global Cooldown
1. Mint with Wallet A
2. Immediately try to mint with Wallet B

**Validation:**
- ✅ Wallet B transaction reverts
- ✅ Error: "Global cooldown active"
- ✅ After 1 hour + 1 second, Wallet B succeeds

### Test 5B: Per-Wallet Cooldown
1. Mint with Wallet A
2. Wait 1 hour (global cooldown)
3. Try to mint again with Wallet A

**Validation:**
- ✅ Transaction reverts
- ✅ Error: "Wallet cooldown active"
- ✅ After 24 hours, Wallet A can mint again

### Test 5C: Max Per Wallet
1. Mint 10 tokens with same wallet (wait cooldowns)
2. Try to mint 11th token

**Validation:**
- ✅ 11th mint reverts
- ✅ Error: "Wallet limit reached"

---

## Phase 6: Mutation Testing

### Step 1: Wait for Valid Mutation Date

**Valid dates:**
1. Same day as individual token mint (test immediately)
2. Collection anniversary (1 year from token #1 mint)
3. Quarterly dates (March 31, June 30, Sept 30, Dec 31)
4. Equinoxes (March 19-21, Sept 22-24)
5. Solstices (June 20-22, Dec 20-22)

**Quick Test:** Mint a token and mutate on same day!

### Test 6A: Check Mutation Eligibility
```javascript
const canMutate = await contract.canMutate(tokenId);
console.log("Can mutate:", canMutate);
```

**Validation:**
- ✅ Returns `true` on valid dates
- ✅ Returns `false` on invalid dates

### Test 6B: Execute Mutation
1. On valid date, select mutation type
2. Click "Mutate" button
3. Confirm transaction

**Validation:**
- ✅ Transaction succeeds
- ✅ Gas cost reasonable (~80K gas)
- ✅ Mutation stored on-chain
- ✅ Query `getTokenMutations(tokenId)` shows new mutation
- ✅ TokenURI updates with mutation
- ✅ Artwork changes when re-rendered

### Test 6C: Multiple Mutations
1. Mutate same token multiple times
2. Verify each mutation is stored

**Validation:**
- ✅ Mutations array grows
- ✅ Each has unique seed
- ✅ Each changes artwork
- ✅ Order preserved

---

## Phase 7: TokenURI & Rendering

### Test 7A: TokenURI Structure
```javascript
const uri = await contract.tokenURI(tokenId);
console.log(uri);
```

**Validation:**
- ✅ Returns `data:application/json;base64,...`
- ✅ Decode base64 to see JSON
- ✅ JSON includes name, description, animation_url
- ✅ `animation_url` is `data:text/html;base64,...`

### Test 7B: HTML Rendering
1. Copy tokenURI output
2. Paste in browser address bar
3. Wait for p5.js to render

**Validation:**
- ✅ HTML loads without errors
- ✅ p5.js initializes
- ✅ Artwork renders (~20 seconds)
- ✅ Artwork matches preview from mint
- ✅ Custom palette used if present
- ✅ Mutations applied correctly

### Test 7C: OpenSea Integration
1. Go to `testnets.opensea.io`
2. Search for your contract address
3. View individual tokens

**Validation:**
- ✅ Tokens appear on OpenSea
- ✅ Images cached by OpenSea
- ✅ Metadata displays correctly
- ✅ Can view token details
- ✅ Can transfer tokens

---

## Phase 8: Edge Cases & Stress Testing

### Test 8A: Request Expiration
1. Request mint
2. Wait 16 minutes
3. Try to complete mint

**Validation:**
- ✅ Transaction reverts
- ✅ Error: "Request expired"
- ✅ Can request new mint

### Test 8B: Invalid Seed Choice
1. Request mint
2. Try to complete with choice = 3

**Validation:**
- ✅ Transaction reverts
- ✅ Error: "Invalid seed choice"

### Test 8C: Token Transfer & Mutation
1. Mint token to Wallet A
2. Transfer to Wallet B
3. Wallet B mutates (on valid date)

**Validation:**
- ✅ Mutation seed includes Wallet B address
- ✅ Different from what Wallet A would have gotten
- ✅ Mutation recorded correctly

### Test 8D: Withdrawal
1. Mint several public tokens (collect ETH)
2. Owner calls `withdraw()`

**Validation:**
- ✅ ETH transferred to owner
- ✅ Contract balance = 0
- ✅ Transaction succeeds

---

## Phase 9: Browser Compatibility

### Test on Multiple Browsers:
- ✅ Chrome/Brave (desktop)
- ✅ Firefox (desktop)
- ✅ Safari (desktop & mobile)
- ✅ Mobile Chrome (Android)

**Validation:**
- p5.js renders correctly on all browsers
- Wallet connection works
- Transactions submit properly
- No console errors

---

## Phase 10: Documentation & Final Checklist

### Pre-Mainnet Checklist:

**Contract:**
- ✅ Deployed to Sepolia
- ✅ Verified on Etherscan
- ✅ All functions tested
- ✅ No bugs found

**Frontend:**
- ✅ Public mint flow works
- ✅ Owner mint flow works
- ✅ 3-preview selection works
- ✅ Custom palette UI works
- ✅ Mutation UI works
- ✅ Mobile responsive

**Integration:**
- ✅ TokenURI renders correctly
- ✅ OpenSea displays tokens
- ✅ Wallets show NFTs
- ✅ Transfers work

**Security:**
- ✅ Only owner can use custom palettes
- ✅ Only owner can mutate their tokens
- ✅ Anti-whale protection works
- ✅ No reentrancy issues
- ✅ Seeds are unpredictable

**Gas Costs Validated:**
- Owner mint: ~150-180K gas
- Public request: ~180K gas
- Public complete: ~120K gas
- Mutation: ~80K gas
- All costs reasonable ✅

---

## Next Steps - Immediate Actions

### 1. Deploy to Sepolia (NOW)
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### 2. Update Frontend Config
```bash
# frontend/.env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=<SEPOLIA_ADDRESS>
NEXT_PUBLIC_CHAIN_ID=11155111
```

### 3. Test Owner Minting (2-3 tokens)
- One without custom palette
- One with custom palette
- Verify both work correctly

### 4. Test Frontend Locally
```bash
cd frontend
npm run dev
```
- Test public mint flow end-to-end
- Test owner mint UI
- Verify rendering

### 5. Test on Sepolia OpenSea
- Wait ~10 minutes for indexing
- Verify tokens appear
- Check images render

### 6. Document Issues
- Keep list of any bugs found
- Fix immediately
- Re-deploy if needed

### 7. Final Validation
Once ALL tests pass on Sepolia:
- ✅ Update documentation with Sepolia results
- ✅ Get community feedback (optional)
- ✅ Prepare mainnet deployment

---

## Estimated Timeline

- **Deploy to Sepolia:** 5 minutes
- **Owner minting tests:** 15 minutes
- **Frontend setup:** 10 minutes
- **Public mint testing:** 30 minutes (with cooldowns)
- **Mutation testing:** 30 minutes (finding valid date)
- **OpenSea validation:** 1 hour (indexing + testing)
- **Edge case testing:** 1 hour
- **Final validation:** 30 minutes

**Total: ~4-5 hours of thorough testing**

---

## Risk Mitigation

**If issues found on Sepolia:**
1. Document the issue
2. Fix in codebase
3. Re-deploy to Sepolia
4. Re-test everything
5. Only proceed to mainnet when perfect

**No issues found:**
- Proceed with confidence to mainnet
- Use same deployment process
- Monitor first few mints closely

---

## Mainnet Deployment (After Sepolia Success)

### Pre-Launch:
- ✅ All Sepolia tests passed
- ✅ No bugs found
- ✅ Community prepared (optional)
- ✅ Gas prices reasonable

### Deployment:
```bash
npx hardhat run scripts/deploy.ts --network mainnet
npx hardhat verify --network mainnet <ADDRESS>
```

### Post-Launch:
- Monitor first mints closely
- Test mutations on valid dates
- Ensure OpenSea indexing works
- Celebrate! 🎉

---

## What to Test Right Now

**Immediate action items:**

1. **Deploy to Sepolia** (5 min)
2. **Mint 2 test tokens as owner** (10 min)
   - One default palette
   - One custom palette
3. **Verify tokenURI renders** (5 min)
4. **Test frontend locally** (20 min)
5. **Test public mint flow** (30 min)

**After basic validation passes:**
- Extended testing (mutations, edge cases)
- OpenSea validation
- Multi-browser testing
- Final security review

---

**Ready to start?** Say the word and I'll deploy to Sepolia!




