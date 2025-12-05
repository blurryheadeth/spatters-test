# SSTORE2 Gas Limit Issue

## Problem Discovered

When calling `tokenURI()`, we get:
```
ProviderError: out of gas: invalid operand to an opcode: 550000000
```

**Root Cause:**  
Reading 193KB of data from 9 SSTORE2 contracts in a single view function call exceeds the block gas limit (30M gas on Ethereum). The `extcodecopy` operation to read all chunks is too expensive.

## Why This Happens

- **Storage is cheap** (~$0.008 to store via SSTORE2)
- **Reading is expensive** (view functions have gas limits too)
- Reading 193KB of bytecode × 9 contracts = exceeds gas limit

## Solutions

### Option 1: Off-Chain Reading (Recommended for Now) ✅

**How it works:**
- Smart contract stores storage addresses
- Frontend/indexer reads from SSTORE2 contracts directly
- Assembles tokenURI off-chain
- Still verifiably on-chain (anyone can read the addresses)

**Pros:**
- ✅ Data is fully on-chain
- ✅ No gas limits
- ✅ Fast rendering
- ✅ Contract already deployed with addresses

**Cons:**
- ❌ TokenURI not a pure view function
- ❌ Requires off-chain infrastructure

**Implementation:**
```typescript
// Frontend reads storage directly
const spattersCode = await readFromSSTORE2(storageAddresses);
const html = buildHTML(seed, mutations, spattersCode);
```

### Option 2: Simplified On-Chain Storage

**Store only essential generation parameters, not full p5.js:**
- Store mutation rules
- Store seed
- Store palette
- Reference external p5.js library

**Pros:**
- ✅ TokenURI works as view function
- ✅ Lower gas costs

**Cons:**
- ❌ Not "fully on-chain"
- ❌ Requires redeployment

### Option 3: Chunked Reading with Helper Functions

**Multiple view functions to read chunks:**
```solidity
function getScriptChunk(uint256 index) external view returns (string memory);
function getScriptChunkCount() external view returns (uint256);
```

**Pros:**
- ✅ Data on-chain
- ✅ Can be assembled off-chain or on-chain

**Cons:**
- ❌ TokenURI still can't return full HTML
- ❌ Complex for marketplaces

## Current Status

**Deployed on Sepolia:**
- Contract: `0x228E8bD406CAcbeD0D1f7182C7e2a5dB19dAc961`
- 9 SSTORE2 storage contracts with spatters.js
- Token minted successfully
- **Issue:** `tokenURI()` reverts due to gas

## Recommended Path Forward

### For Sepolia Testing (Immediate):

Use **Hybrid Approach**:
1. Keep current contract (data is on-chain)
2. Frontend reads from SSTORE2 directly
3. Build tokenURI in frontend
4. Test full minting flow

### For Mainnet (Future):

**Decision needed:**

**Option A:** Continue with current architecture
- Data is fully on-chain
- TokenURI assembled off-chain
- Marketplaces may need custom support
- True to "on-chain" philosophy

**Option B:** Optimize storage
- Reduce spatters.js size (minify, optimize)
- Store only critical functions
- May fit under gas limit

**Option C:** Metadata on Arweave/IPFS
- Contract stores only seeds/mutations
- HTML on permanent storage
- Traditional approach, works everywhere

## Next Steps

1. ✅ Data successfully stored on-chain (immutable)
2. ⏭️ Implement off-chain reading in frontend
3. ⏭️ Test full flow with frontend
4. ⏭️ Decide on mainnet strategy

**The good news:** All data IS on-chain and immutable. We just need to read it differently than expected.




