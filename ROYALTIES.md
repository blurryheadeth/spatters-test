# 🎨 Spatters NFT Royalties - EIP-2981 Implementation

## Overview

Spatters implements **EIP-2981**, the industry-standard NFT royalty protocol. This provides a standardized way for marketplaces to query and honor creator royalties on secondary sales.

---

## 📊 Royalty Structure

### Percentage: **5%** (500 basis points)

This follows common NFT market standards:
- ✅ Fair compensation for creator
- ✅ Competitive with other collections
- ✅ Same as Art Blocks external marketplace standard (2.5-5%)

### Recipient: **Contract Owner**

By default, royalties are paid to the contract owner. This can be updated at any time by the owner.

---

## 🔧 Technical Implementation

### Standard: EIP-2981

**What it is:**
- Standardized interface for NFT royalties
- Supported by major marketplaces (OpenSea, LooksRare, Magic Eden, etc.)
- Returns royalty receiver address and amount for any sale

**Key Function:**
```solidity
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    external view
    returns (address receiver, uint256 royaltyAmount)
```

### Example Calculations:

| Sale Price | Royalty (5%) |
|-----------|--------------|
| 0.1 ETH   | 0.005 ETH   |
| 1.0 ETH   | 0.05 ETH    |
| 10.0 ETH  | 0.5 ETH     |

---

## ⚙️ Managing Royalties

### View Current Receiver:

```javascript
const receiver = await spatters.royaltyReceiver();
console.log("Royalties paid to:", receiver);
```

### Update Receiver (Owner Only):

```javascript
// Only contract owner can call this
await spatters.setRoyaltyReceiver("0xNewReceiverAddress");
```

### Check Royalty Amount:

```javascript
const salePrice = ethers.parseEther("1.0"); // 1 ETH
const [receiver, royaltyAmount] = await spatters.royaltyInfo(tokenId, salePrice);
console.log("Receiver:", receiver);
console.log("Royalty:", ethers.formatEther(royaltyAmount), "ETH");
```

---

## 🛒 Marketplace Support

### ✅ Marketplaces That Support EIP-2981:

- **OpenSea** - Optional (buyer chooses to pay)
- **LooksRare** - Optional
- **Rarible** - Optional
- **Foundation** - Enforced
- **SuperRare** - Enforced
- **Magic Eden** - Enforced
- **Manifold** - Enforced
- **Art Blocks Marketplace** - Enforced

### How It Works:

1. **Marketplace queries contract:** Calls `royaltyInfo(tokenId, salePrice)`
2. **Contract returns info:** Receiver address + royalty amount
3. **Marketplace handles payment:** 
   - ✅ Some enforce automatically
   - ❓ Some make it optional (buyer decides)

---

## ⚠️ Important Reality Check

### Royalties Are NOT Guaranteed on All Platforms

**The Hard Truth:**

EIP-2981 is an **information standard**, not an **enforcement mechanism**. It tells marketplaces who should receive royalties and how much, but it cannot force payment.

**Current marketplace landscape (2024):**

**OpenSea:**
- Buyer can choose: 0%, 25%, 50%, 75%, or 100% of royalty
- Many buyers choose 0% to save money
- You get paid only if buyer voluntarily pays

**Blur:**
- Zero royalties by default
- No option to pay royalties

**Why This Happens:**
- Marketplaces compete for volume
- Lower fees attract more users
- Buyers prefer platforms where they pay less
- "Race to the bottom" problem

### So Why Implement It?

1. **Professional Standard** - Expected in serious NFT projects
2. **Some Platforms DO Enforce** - Foundation, Magic Eden, Art Blocks marketplace
3. **Future-Proofing** - Industry may shift back toward enforcement
4. **Supportive Collectors** - Some collectors voluntarily pay royalties
5. **Art Blocks Does It** - Following industry leader best practices

---

## 🎯 What We Chose & Why

### Our Approach: Simple EIP-2981 (Like Art Blocks)

**What we implemented:**
```solidity
✅ EIP-2981 royalty information standard
✅ 5% royalty rate
✅ Owner-configurable receiver address
✅ Professional, clean implementation
```

**What we did NOT implement:**
```
❌ Operator Filter Registry (marketplace blocking)
❌ Custom enforcement mechanisms
❌ Restrictions on where NFTs can be traded
```

### Why This Approach?

**Art Blocks Philosophy:**
> "We believe in giving collectors choice. We'll build the best products and let quality win, not force it through restrictions."

**Our reasoning:**
- ✅ Maintains maximum liquidity
- ✅ No controversy or collector backlash
- ✅ Professional and expected
- ✅ Compatible with all marketplaces
- ✅ Collectors can trade freely
- ❌ Accepts that some royalties will be optional

**Alternative approaches we considered:**

**Operator Filter Registry (blocking non-compliant marketplaces):**
- Projects like Azuki tried this
- Massive community backlash
- Most reversed their decision
- Even Art Blocks doesn't do this

**Building our own marketplace:**
- Art Blocks did this successfully
- 100% enforcement on their platform
- Requires significant resources
- Can be future goal as project grows

---

## 📈 Monitoring Royalties

### On-Chain Verification:

```javascript
// Verify EIP-2981 support
const erc2981InterfaceId = "0x2a55205a";
const supported = await spatters.supportsInterface(erc2981InterfaceId);
console.log("EIP-2981 Supported:", supported); // true

// Check current settings
const receiver = await spatters.royaltyReceiver();
const percentage = await spatters.ROYALTY_BPS(); // 500 = 5%
console.log("Receiver:", receiver);
console.log("Percentage:", percentage / 100, "%");
```

### OpenSea Testnets:

1. View your NFT on https://testnets.opensea.io/
2. Check "Details" section
3. Should show "Creator Earnings: 5%"
4. Verify receiver address is correct

---

## 🔄 Updating Receiver Address

### When to Update:

- Moving to a multisig wallet
- Setting up royalty splits (e.g., via 0xSplits)
- Transferring ownership
- Setting up DAO treasury

### How to Update:

**Via Hardhat Console:**
```bash
npx hardhat console --network sepolia
```

```javascript
const spatters = await ethers.getContractAt(
  "Spatters",
  "0xYourContractAddress"
);

// Update receiver
await spatters.setRoyaltyReceiver("0xNewReceiverAddress");

// Verify
console.log(await spatters.royaltyReceiver());
```

**Via Etherscan:**
1. Go to contract on Etherscan
2. Navigate to "Write Contract" tab
3. Connect wallet (must be owner)
4. Call `setRoyaltyReceiver` with new address
5. Confirm transaction

---

## 💰 Royalty Splitting (Advanced)

### Using 0xSplits:

For more complex royalty distribution:

1. **Create a Split Contract** on [splits.org](https://app.splits.org/)
   - Define recipients and percentages
   - Deploy split contract

2. **Set Split as Receiver:**
```javascript
await spatters.setRoyaltyReceiver(splitContractAddress);
```

3. **Royalties automatically distributed** according to split percentages

**Example Split:**
- Artist: 60%
- Platform: 30%
- Team: 10%

---

## 📚 Resources

### Standards & Documentation:
- [EIP-2981 Specification](https://eips.ethereum.org/EIPS/eip-2981)
- [OpenZeppelin ERC2981 Docs](https://docs.openzeppelin.com/contracts/4.x/api/token/common#ERC2981)
- [Art Blocks Royalty Docs](https://docs.artblocks.io/creator-docs/core-contract-v3/erc2981-royalties/)

### Tools:
- [0xSplits](https://app.splits.org/) - Royalty splitting
- [Manifold Royalty Registry](https://royaltyregistry.xyz/) - Enhanced royalty management

---

## ✅ Summary

**What Spatters Implements:**
- ✅ EIP-2981 standard (information about royalties)
- ✅ 5% secondary sales royalty
- ✅ Owner-configurable receiver
- ✅ Professional, industry-standard approach

**What Marketplaces Do:**
- Some enforce automatically (Foundation, Magic Eden)
- Some make it optional (OpenSea, LooksRare)
- Some ignore it completely (Blur)

**Bottom Line:**
We've done our part by implementing the standard professionally. Enforcement depends on the marketplace and buyer. This is the same reality that Art Blocks and all major NFT projects face in 2024.

**Our Philosophy:**
Quality art + supportive community = collectors who want to support creators, regardless of whether royalties are enforced.

---

**Built following Art Blocks best practices** 🎨




