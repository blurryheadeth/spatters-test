# Dual Cooldown System

## Overview

The Spatters NFT collection uses a sophisticated **dual-tier cooldown system** to ensure fair distribution and prevent whale accumulation during the public mint phase.

## How It Works

### Two Independent Cooldowns

1. **Global Cooldown (1 hour)**
   - Affects ALL wallets
   - After ANY wallet mints, ALL wallets must wait 1 hour before the next mint
   - Ensures steady, predictable launch pace
   - Maximum rate: 1 NFT per hour for the entire collection

2. **Per-Wallet Cooldown (24 hours)**
   - Affects individual wallets
   - After a wallet mints, THAT wallet must wait 24 hours before minting again
   - Prevents rapid accumulation by single actors
   - Each wallet can mint max 10 NFTs total

### Both Must Be Satisfied

For any mint to succeed, BOTH conditions must be met:
- Global cooldown has passed (1 hour since last mint by anyone)
- Wallet cooldown has passed (24 hours since this wallet's last mint)

**The longer cooldown determines when you can mint.**

## Example Scenarios

### Scenario 1: First Public Mint
```
Time: 12:00 PM, Day 1
Action: Alice mints token #26 (first public token)
Result: ✅ Success (no global cooldown check for first public mint)
Next opportunity: 
  - Alice: Day 2, 12:00 PM (24h wallet cooldown)
  - Anyone else: 1:00 PM, Day 1 (1h global cooldown)
```

### Scenario 2: Subsequent Mint
```
Time: 1:00 PM, Day 1
Action: Bob mints token #27
Result: ✅ Success (1h global cooldown has passed)
Updates:
  - Global cooldown: Reset to 1:00 PM
  - Bob's wallet cooldown: Set to 1:00 PM
Next opportunity:
  - Bob: Day 2, 1:00 PM (24h wallet cooldown)
  - Alice: Day 2, 12:00 PM (her 24h cooldown)
  - Anyone else: 2:00 PM, Day 1 (1h global cooldown)
```

### Scenario 3: Alice Tries Too Soon
```
Time: 1:30 PM, Day 1
Action: Alice tries to mint token #28
Result: ❌ Failed - "Wallet cooldown active"
Reason: Alice's 24h cooldown (from 12:00 PM Day 1) hasn't passed
```

### Scenario 4: Charlie Waits for Global
```
Time: 2:00 PM, Day 1
Action: Charlie mints token #28
Result: ✅ Success (1h global + never minted before)
Next opportunity:
  - Charlie: Day 2, 2:00 PM (24h wallet cooldown)
  - Anyone else: 3:00 PM, Day 1 (1h global cooldown)
```

## Launch Timeline

### Minimum Collection Duration

- **Public tokens**: 974 (tokens #26 through #999)
- **Maximum rate**: 1 NFT per hour
- **Minimum time**: 974 hours = **~41 days**

### Actual Duration

In reality, the collection will likely take longer because:
- Not every hour will have a mint
- Wallets hitting their 24-hour cooldown
- Varying participation throughout the day
- Max 10 NFTs per wallet limit

**Expected duration: 6-12 weeks**

## Smart Contract Implementation

### Constants

```solidity
uint256 public constant MAX_PER_WALLET = 10;
uint256 public constant GLOBAL_COOLDOWN = 1 hours;
uint256 public constant WALLET_COOLDOWN = 24 hours;
```

### State Variables

```solidity
uint256 public lastGlobalMintTime;           // Tracks last mint by anyone
mapping(address => uint256) public mintedPerWallet;    // Total mints per wallet
mapping(address => uint256) public lastMintTime;       // Last mint time per wallet
```

### Mint Logic

```solidity
// Check 1: Per-wallet limit
require(mintedPerWallet[msg.sender] < MAX_PER_WALLET, "Max per wallet reached");

// Check 2: Global cooldown (skip for token #26)
if (_nextTokenId > OWNER_RESERVE + 1) {
    require(
        block.timestamp >= lastGlobalMintTime + GLOBAL_COOLDOWN,
        "Global cooldown active"
    );
}

// Check 3: Per-wallet cooldown
require(
    block.timestamp >= lastMintTime[msg.sender] + WALLET_COOLDOWN,
    "Wallet cooldown active"
);

// Update tracking
mintedPerWallet[msg.sender]++;
lastMintTime[msg.sender] = block.timestamp;
lastGlobalMintTime = block.timestamp;
```

## Special Cases

### Owner Reserve (Tokens #1-25)
- Owner can mint freely without cooldowns
- Does NOT trigger global cooldown
- Allows owner to mint all 25 reserved tokens quickly
- Public minting starts fresh at token #26

### First Public Mint (Token #26)
- Does NOT check global cooldown
- Allows immediate public launch after owner reserve
- Still subject to per-wallet cooldown for that minter

### Default State
- `lastGlobalMintTime` starts at 0
- `lastMintTime[wallet]` defaults to 0
- Zero timestamps always pass cooldown checks
- Enables first-time minters to participate

## Benefits

### 1. Fair Distribution
- No single wallet can rapidly accumulate NFTs
- Everyone has equal opportunity to mint over time
- Predictable availability

### 2. Prevents Bots
- Sophisticated bots can't front-run or spam
- Even if bots bypass per-wallet limits with multiple addresses, global cooldown still applies
- Economic incentive reduced by forced slow pace

### 3. Community Building
- 41+ day launch period allows community to grow
- Creates excitement and anticipation
- Rewards patient, engaged collectors
- Reduces FOMO and gas wars

### 4. Price Discovery
- Exponential pricing curve works with slow release
- Market has time to establish fair value
- Reduces volatility

## Monitoring & Analytics

### Key Metrics to Track

1. **Mint Rate**
   - Actual NFTs minted per day
   - Compare to maximum theoretical rate (24/day)
   - Identify participation patterns

2. **Unique Minters**
   - Number of unique wallet addresses
   - Distribution across addresses
   - Concentration metrics

3. **Cooldown Triggers**
   - How often global cooldown blocks mints
   - How often per-wallet cooldown blocks mints
   - Failed transaction analysis

4. **Completion Timeline**
   - Estimated collection completion date
   - Actual vs. minimum duration
   - Participation trends over time

## FAQ

**Q: Can I mint 2 NFTs at once?**
A: No, the mint function only allows 1 NFT per transaction.

**Q: If I mint at 2:30 PM, when can I mint again?**
A: You can mint again at 2:30 PM the next day (24 hours later), assuming the global cooldown has also passed.

**Q: What if someone mints right before me?**
A: You must wait 1 hour from their mint time due to the global cooldown.

**Q: Can I use multiple wallets to bypass the 10 NFT limit?**
A: Technically yes, but you'll still face the 1-hour global cooldown between any mints. Each wallet is independent for the 10 NFT limit.

**Q: How is this different from most NFT launches?**
A: Most launches allow anyone to mint as many as they want as fast as they want (limited only by gas). This leads to bots and whales dominating. Our dual cooldown ensures a slow, fair, community-oriented launch.

**Q: Will this affect secondary market price?**
A: The controlled supply release should create more stable price discovery and reduce volatility compared to instant sellouts.

## Technical Notes

### Gas Costs
- Minimal increase from tracking: ~2,100 gas for 1 SSTORE
- lastGlobalMintTime: Single storage slot updated each mint
- Very efficient given the benefits

### Timestamp Manipulation
- Miners can manipulate `block.timestamp` by ~15 seconds
- Impact on 1-hour cooldown: Negligible (~0.4%)
- Impact on 24-hour cooldown: Minimal (~0.017%)
- Not a security concern for this use case

### Edge Cases Handled
- First public mint bypasses global check
- Owner mints don't affect public cooldowns
- Zero timestamp defaults work correctly
- Both cooldowns properly enforced

## Testing

### Test Coverage

The test suite includes:
1. First public mint bypasses global cooldown
2. Per-wallet cooldown enforcement (24h)
3. Global cooldown enforcement (1h)
4. Multiple wallets blocked by global cooldown
5. Wallet tracking updates
6. Global mint time tracking
7. Max per wallet limit

### Running Tests

```bash
# Note: Requires Node.js 22.x LTS
npx hardhat test
```

## Conclusion

The dual cooldown system represents a significant innovation in NFT launch mechanics. By combining global and per-wallet cooldowns, Spatters ensures:

- ✅ Fair distribution over 41+ days
- ✅ Protection against whale accumulation
- ✅ Bot resistance through time delays
- ✅ Community-building opportunity
- ✅ Stable price discovery
- ✅ Reduced gas wars and FOMO

This system prioritizes long-term community value over quick sellouts.

---

**For more information, see:**
- [README.md](README.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Technical details

