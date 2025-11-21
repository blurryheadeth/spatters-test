import { ethers } from "hardhat";

// Sample metadata for owner mints
// In production, generate these properly with the p5.js script
const sampleMetadata = JSON.stringify({
  circles: 2,
  lines: 1,
  selectedColors: ["#FF5733", "#33FF57"],
  palette: "warm",
  backgroundColor: "#FFFFFF",
  mutation: "",
  changeHistory: []
});

async function main() {
  // Get contract address from command line argument
  const contractAddress = process.argv[2];
  
  if (!contractAddress) {
    console.error("❌ Please provide contract address as argument");
    console.log("Usage: npx hardhat run scripts/mint-owner-reserve.ts --network sepolia <CONTRACT_ADDRESS>");
    process.exit(1);
  }

  console.log("Minting Owner Reserve Tokens...");
  console.log("Contract:", contractAddress);

  // Connect to contract
  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  const Spatters = await ethers.getContractFactory("Spatters");
  const spatters = Spatters.attach(contractAddress);

  // Check current supply
  const currentSupply = await spatters.totalSupply();
  console.log("Current supply:", currentSupply.toString());

  if (currentSupply >= 25n) {
    console.log("✅ Owner reserve already minted");
    return;
  }

  // Mint remaining owner reserve tokens
  const tokensToMint = 25 - Number(currentSupply);
  console.log(`\nMinting ${tokensToMint} tokens...`);

  for (let i = 0; i < tokensToMint; i++) {
    const tokenId = Number(currentSupply) + i + 1;
    console.log(`\nMinting token #${tokenId}...`);
    
    try {
      // In production, generate proper metadata for each token
      // You can pass custom metadata here or leave empty for client generation
      const tx = await spatters.ownerMint(owner.address, sampleMetadata);
      console.log("Transaction:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Minted! Gas used:", receipt!.gasUsed.toString());
      
      // Check if collection launch date was set (first mint)
      if (tokenId === 1) {
        const launchDate = await spatters.collectionLaunchDate();
        console.log("🚀 Collection launch date set:", new Date(Number(launchDate) * 1000));
      }
    } catch (error: any) {
      console.error(`❌ Failed to mint token #${tokenId}:`, error.message);
      break;
    }
    
    // Add delay to avoid rate limiting
    if (i < tokensToMint - 1) {
      console.log("Waiting 2 seconds...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final check
  const finalSupply = await spatters.totalSupply();
  console.log("\n✅ Owner reserve minting complete!");
  console.log("Final supply:", finalSupply.toString());
  
  // Show mint price for first public token
  const publicMintPrice = await spatters.getMintPrice();
  console.log("Token #26 price:", ethers.formatEther(publicMintPrice), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

