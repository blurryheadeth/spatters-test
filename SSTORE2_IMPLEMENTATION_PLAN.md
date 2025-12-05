# SSTORE2 Implementation Plan - Immutable On-Chain Storage

## Architecture Decision Summary

**Script Storage:** SSTORE2 (on-chain, gas-efficient)
**Mutability:** Immutable forever (addresses set at deployment)
**Testing:** Full implementation on Sepolia before mainnet

---

## What is SSTORE2?

SSTORE2 is a gas-efficient pattern for storing arbitrary data on-chain:
- Stores data as contract bytecode (cheaper than SSTORE)
- Data is immutable once deployed
- Can store large files (up to ~24KB per contract)
- Read data using `EXTCODECOPY`

**For our files:**
- p5.js: ~1MB → Need ~40-50 storage contracts
- spatters.js: 193KB → Need ~8-10 storage contracts

---

## Implementation Steps

### Phase 1: Setup SSTORE2 Library (15 min)

**Install Solady (optimized SSTORE2 implementation):**
```bash
cd /Users/glenalbo/Desktop/spatters
npm install solady
```

**Or use OpenZeppelin's implementation:**
```bash
npm install @openzeppelin/contracts
```

We'll use **Solady** (more gas-efficient).

---

### Phase 2: Prepare Storage Scripts (20 min)

**Create chunking script** - Split large files into 24KB chunks:

**File: `scripts/prepare-storage.ts`**
```typescript
import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 24000; // 24KB per contract (safe limit)

function chunkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const chunks: string[] = [];
  
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }
  
  return chunks;
}

async function main() {
  // Chunk spatters.js
  const spattersChunks = chunkFile('original_files/spatters.js');
  console.log(`Spatters.js: ${spattersChunks.length} chunks`);
  
  // Save chunks
  fs.writeFileSync(
    'scripts/spatters-chunks.json',
    JSON.stringify(spattersChunks, null, 2)
  );
  
  console.log('✓ Chunks prepared and saved');
}

main().catch(console.error);
```

---

### Phase 3: Deploy Storage Contracts (30 min)

**File: `scripts/deploy-storage.ts`**
```typescript
import { ethers } from "hardhat";
import fs from 'fs';
import { SSTORE2 } from "solady/utils/SSTORE2.sol";

async function main() {
  console.log("Deploying storage contracts...");
  
  // Load chunks
  const spattersChunks = JSON.parse(
    fs.readFileSync('scripts/spatters-chunks.json', 'utf8')
  );
  
  // Deploy SSTORE2 contracts for each chunk
  const spattersAddresses: string[] = [];
  
  for (let i = 0; i < spattersChunks.length; i++) {
    console.log(`Deploying spatters chunk ${i + 1}/${spattersChunks.length}...`);
    
    // Convert string to bytes
    const data = ethers.toUtf8Bytes(spattersChunks[i]);
    
    // Deploy via SSTORE2
    const tx = await ethers.deployContract("SSTORE2", {
      data: data
    });
    await tx.waitForDeployment();
    
    const address = await tx.getAddress();
    spattersAddresses.push(address);
    console.log(`  Deployed to: ${address}`);
    
    // Wait a bit between deployments
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save addresses
  const storageConfig = {
    network: network.name,
    timestamp: new Date().toISOString(),
    spattersAddresses: spattersAddresses,
    p5jsAddress: "0x..." // Will use CDN or separate deployment
  };
  
  fs.writeFileSync(
    `deployments/${network.name}-storage.json`,
    JSON.stringify(storageConfig, null, 2)
  );
  
  console.log("\n✓ Storage contracts deployed!");
  console.log(`Total spatters chunks: ${spattersAddresses.length}`);
  console.log(`Total cost: ~${spattersAddresses.length * 0.01} ETH`);
}

main().catch(console.error);
```

---

### Phase 4: Update Spatters Contract (30 min)

**Changes to `contracts/Spatters.sol`:**

```solidity
// At top of file
import "solady/utils/SSTORE2.sol";

contract Spatters is ERC721, Ownable, ReentrancyGuard {
    // IMMUTABLE storage addresses
    address[] public immutable SPATTERS_STORAGE_ADDRESSES;
    address public immutable P5JS_ADDRESS;
    
    constructor(
        address[] memory _spattersAddresses,
        address _p5jsAddress
    ) ERC721("Spatters", "SPAT") Ownable(msg.sender) {
        SPATTERS_STORAGE_ADDRESSES = _spattersAddresses;
        P5JS_ADDRESS = _p5jsAddress;
        
        // Initialize mutation types
        _initializeMutationTypes();
    }
    
    /**
     * @dev Read spatters.js from SSTORE2 contracts
     */
    function _getSpattersScript() internal view returns (string memory) {
        bytes memory fullScript;
        
        for (uint i = 0; i < SPATTERS_STORAGE_ADDRESSES.length; i++) {
            bytes memory chunk = SSTORE2.read(SPATTERS_STORAGE_ADDRESSES[i]);
            fullScript = bytes.concat(fullScript, chunk);
        }
        
        return string(fullScript);
    }
    
    /**
     * @dev Read p5.js library
     */
    function _getP5jsScript() internal view returns (string memory) {
        // Option 1: Use CDN (saves gas)
        // Return empty string, use <script src="cdn..."> in HTML
        return "";
        
        // Option 2: Read from SSTORE2 (fully on-chain)
        // return string(SSTORE2.read(P5JS_ADDRESS));
    }
    
    /**
     * @dev Build complete HTML with scripts
     */
    function _buildScriptTags(
        bytes32 mintSeed,
        MutationRecord[] memory mutations,
        bool hasCustomPalette,
        string[6] memory palette
    ) internal view returns (string memory) {
        // Get spatters.js from SSTORE2
        string memory spattersCode = _getSpattersScript();
        
        // Build palette JS
        string memory paletteJS;
        string memory generateCall;
        
        if (hasCustomPalette) {
            paletteJS = string(abi.encodePacked(
                'const customPalette = ["',
                palette[0], '","', palette[1], '","',
                palette[2], '","', palette[3], '","',
                palette[4], '","', palette[5], '"];'
            ));
            generateCall = 'generate(mintingSeed, mutations, customPalette);';
        } else {
            paletteJS = '';
            generateCall = 'generate(mintingSeed, mutations);';
        }
        
        return string(abi.encodePacked(
            '<!DOCTYPE html><html><head><meta charset="UTF-8">',
            // p5.js from CDN (or SSTORE2 if deployed)
            '<script src="https://cdn.jsdelivr.net/npm/p5@1.11.2/lib/p5.min.js"></script>',
            // spatters.js from SSTORE2
            '<script>', spattersCode, '</script>',
            '</head><body><script>',
            'const mintingSeed = hexToSeed("', _bytes32ToHex(mintSeed), '");',
            'const mutations = ', _buildMutationsArray(mutations), ';',
            paletteJS,
            'function setup() { ', generateCall, ' }',
            'function hexToSeed(h) { return parseInt(h.slice(0,18),16); }',
            '</script></body></html>'
        ));
    }
}
```

**Note on p5.js:**
- Option A: Use CDN (saves ~$200-300 in gas)
- Option B: Store on-chain via SSTORE2 (truly decentralized)
- Recommendation: CDN for Sepolia, decide for mainnet

---

### Phase 5: Deploy to Sepolia (20 min)

**File: `scripts/deploy-sepolia.ts`**
```typescript
import { ethers } from "hardhat";
import fs from 'fs';

async function main() {
  console.log("Deploying Spatters to Sepolia...");
  
  // Load storage addresses
  const storageConfig = JSON.parse(
    fs.readFileSync('deployments/sepolia-storage.json', 'utf8')
  );
  
  // Deploy Spatters contract
  const Spatters = await ethers.getContractFactory("Spatters");
  const spatters = await Spatters.deploy(
    storageConfig.spattersAddresses,
    storageConfig.p5jsAddress || ethers.ZeroAddress // CDN fallback
  );
  
  await spatters.waitForDeployment();
  const address = await spatters.getAddress();
  
  console.log(`✓ Spatters deployed to: ${address}`);
  
  // Save deployment
  const deployment = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    contractAddress: address,
    storageAddresses: storageConfig.spattersAddresses,
    p5jsAddress: storageConfig.p5jsAddress
  };
  
  fs.writeFileSync(
    'deployments/sepolia-deployment.json',
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("\n✓ Deployment complete!");
  console.log(`Contract: ${address}`);
  console.log(`Verify: npx hardhat verify --network sepolia ${address}`);
}

main().catch(console.error);
```

---

### Phase 6: Verification & Testing (30 min)

**Test tokenURI generation:**
```bash
npx hardhat console --network sepolia

> const Spatters = await ethers.getContractFactory("Spatters")
> const spatters = Spatters.attach("YOUR_ADDRESS")

# Mint a test token
> await spatters.ownerMint(await ethers.getSigners()[0].getAddress(), ["","","","","",""])

# Get tokenURI
> const uri = await spatters.tokenURI(1)
> console.log(uri)

# Decode and test in browser
```

---

## Gas Cost Estimates

**Sepolia Testnet:**
- Storage deployment: 8-10 contracts × ~$0.50 = **~$5-10** in test ETH
- Spatters deployment: **~$3-5** in test ETH
- **Total: ~$8-15** in Sepolia ETH

**Mainnet (future):**
- Storage deployment: 8-10 contracts × ~$50 = **~$400-500**
- Spatters deployment: **~$100-150**
- **Total: ~$500-650**

---

## Timeline

1. **Setup SSTORE2 library:** 15 min
2. **Create chunking scripts:** 20 min
3. **Deploy storage contracts:** 30 min (including transaction confirmations)
4. **Update Spatters.sol:** 30 min
5. **Compile & test:** 15 min
6. **Deploy to Sepolia:** 20 min
7. **Verify & test:** 30 min

**Total: ~2.5-3 hours**

---

## Advantages of This Approach

✅ **Truly decentralized** - Scripts live on-chain forever
✅ **Immutable** - Cannot be changed by anyone
✅ **Same on Sepolia and mainnet** - Exact architecture
✅ **No external dependencies** - Zero reliance on IPFS/Arweave
✅ **Gas efficient** - SSTORE2 is optimized storage
✅ **Transparent** - Anyone can verify the code

## Trade-offs Accepted

❌ **No bug fixes** - Scripts are permanent
❌ **Higher deployment cost** - ~$500 vs ~$150 for external storage
❌ **Longer deployment time** - Multiple transactions required

---

## Next Steps

Ready to begin implementation?

1. Install dependencies
2. Create chunking script
3. Chunk spatters.js
4. Deploy storage contracts to Sepolia
5. Update Spatters.sol
6. Deploy & test

Estimated time: 2.5-3 hours




