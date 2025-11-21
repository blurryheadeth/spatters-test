// Contract configuration
export const CONTRACT_ADDRESSES = {
  // Sepolia testnet
  sepolia: process.env.NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS || "",
  // Ethereum mainnet
  mainnet: process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS || "",
};

// Get contract address for current network
export function getContractAddress(chainId: number): string {
  switch (chainId) {
    case 11155111: // Sepolia
      return CONTRACT_ADDRESSES.sepolia;
    case 1: // Mainnet
      return CONTRACT_ADDRESSES.mainnet;
    default:
      return "";
  }
}

// Collection constants
export const COLLECTION_CONFIG = {
  name: "Spatters",
  symbol: "SPAT",
  maxSupply: 999,
  ownerReserve: 25,
  maxPerTransaction: 2,
  maxPerWallet: 10,
  cooldownPeriod: 3600, // 1 hour in seconds
};

// Pinata configuration
export const PINATA_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_PINATA_API_KEY || "",
  secretKey: process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || "",
  gateway: "https://gateway.pinata.cloud/ipfs/",
};

// RPC endpoints
export const RPC_URLS = {
  sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.public.blastapi.io",
  mainnet: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://eth.public-rpc.com",
};

