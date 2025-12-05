/**
 * Spatters API - On-Chain Template with RPC Injection
 * 
 * This service is intentionally minimal. ALL logic lives on-chain:
 * - HTML template stored in SSTORE2
 * - Loader JavaScript embedded in template
 * - spatters.js stored in SSTORE2
 * - Token data in Spatters contract
 * 
 * This server ONLY:
 * 1. Fetches the HTML template from blockchain
 * 2. Injects RPC URLs from .env (the only off-chain config)
 * 3. Returns the complete HTML
 * 
 * If this server disappears, anyone can:
 * - Deploy their own instance with their own RPC keys
 * - Update the contract's baseURI via community governance
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import { createPublicClient, http, Address, hexToString } from "viem";
import { sepolia, mainnet } from "viem/chains";
import puppeteer from "puppeteer";

// ============ Configuration ============

const PORT = process.env.PORT || 3000;
const NETWORK = process.env.NETWORK || "sepolia";

// RPC URLs (the only off-chain configuration)
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 
  (process.env.ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://rpc.sepolia.org");

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || 
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://eth.llamarpc.com");

// Contract addresses
const CONTRACTS = {
  sepolia: {
    spatters: "0x98dF264EE21FCEcED7D64bAcC7CAAAeE78A4eE9f" as Address,
    generator: "0x4159550F0455B0659eAC8eF29Cac7c5a7fD1F506" as Address,
  },
  mainnet: {
    spatters: "0x..." as Address,
    generator: "0x..." as Address,
  },
};

// Will be populated from chain
let STORAGE_ADDRESSES: Address[] = [];

// ============ Viem Client ============

const chain = NETWORK === "mainnet" ? mainnet : sepolia;
const rpcUrl = NETWORK === "mainnet" ? MAINNET_RPC_URL : SEPOLIA_RPC_URL;

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl, { timeout: 30_000 }),
});

// ============ Contract ABI ============

const GENERATOR_ABI = [
  {
    name: "getHtmlTemplate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "getTemplateConfig",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "spattersContract", type: "address" },
      { name: "generatorContract", type: "address" },
      { name: "storageAddresses", type: "address[]" },
      { name: "templateAddresses", type: "address[]" },
    ],
  },
  {
    name: "getTokenData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "seed", type: "bytes32" },
      { name: "mutationSeeds", type: "bytes32[]" },
      { name: "mutationTypes", type: "string[]" },
      { name: "customPalette", type: "string[6]" },
    ],
  },
] as const;

const SPATTERS_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============ Caching ============

interface CacheEntry {
  data: string;
  timestamp: number;
}

// Cache for HTML template (rarely changes - only on redeployment)
let templateCache: CacheEntry | null = null;
const TEMPLATE_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Cache for config (storage addresses, contract addresses)
let configCache: {
  spattersContract: Address;
  generatorContract: Address;
  storageAddresses: Address[];
  templateAddresses: Address[];
} | null = null;

// ============ Core Functions ============

/**
 * Get template configuration from chain
 */
async function getTemplateConfig() {
  if (configCache) return configCache;

  const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];
  
  const [spattersContract, generatorContract, storageAddresses, templateAddresses] = 
    await publicClient.readContract({
      address: contracts.generator,
      abi: GENERATOR_ABI,
      functionName: "getTemplateConfig",
    });

  configCache = {
    spattersContract,
    generatorContract,
    storageAddresses: [...storageAddresses],
    templateAddresses: [...templateAddresses],
  };

  // Update global STORAGE_ADDRESSES for logging
  STORAGE_ADDRESSES = [...storageAddresses];

  return configCache;
}

/**
 * Get HTML template from chain
 */
async function getHtmlTemplate(): Promise<string> {
  // Check cache
  if (templateCache && Date.now() - templateCache.timestamp < TEMPLATE_CACHE_TTL) {
    console.log("📄 Using cached HTML template");
    return templateCache.data;
  }

  console.log("📄 Fetching HTML template from chain...");
  const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];

  const template = await publicClient.readContract({
    address: contracts.generator,
    abi: GENERATOR_ABI,
    functionName: "getHtmlTemplate",
  });

  templateCache = { data: template, timestamp: Date.now() };
  return template;
}

/**
 * Inject configuration into HTML template
 */
function injectConfig(template: string, tokenId: string): string {
  const config = configCache!;
  
  return template
    .replace(/\{\{SEPOLIA_RPC\}\}/g, SEPOLIA_RPC_URL)
    .replace(/\{\{MAINNET_RPC\}\}/g, MAINNET_RPC_URL)
    .replace(/\{\{TOKEN_ID\}\}/g, tokenId)
    .replace(/\{\{GENERATOR_CONTRACT\}\}/g, config.generatorContract)
    .replace(/\{\{SPATTERS_CONTRACT\}\}/g, config.spattersContract)
    .replace(/\{\{STORAGE_ADDRESSES\}\}/g, JSON.stringify(config.storageAddresses));
}

/**
 * Generate complete HTML for a token
 */
async function generateTokenHtml(tokenId: string): Promise<string> {
  // Ensure config is loaded
  await getTemplateConfig();
  
  // Get template from chain
  const template = await getHtmlTemplate();
  
  // Inject configuration
  const html = injectConfig(template, tokenId);
  
  console.log(`✅ Generated HTML for token #${tokenId} (${html.length} chars)`);
  return html;
}

// ============ Express App ============

const app = express();

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/**
 * Root endpoint - API info
 */
app.get("/", async (req, res) => {
  try {
    const config = configCache || await getTemplateConfig().catch(() => null);
    
    res.json({
      name: "Spatters API",
      version: "4.0.0",
      architecture: "On-Chain Template with RPC Injection",
      description: "ALL logic is on-chain. This server only injects RPC URLs.",
      network: NETWORK,
      contracts: CONTRACTS[NETWORK as keyof typeof CONTRACTS],
      storageChunks: config?.storageAddresses.length || 0,
      endpoints: {
        html: "/token/:id",
        image: "/image/:id.png",
        metadata: "/metadata/:id",
        health: "/health",
      },
      onChainComponents: {
        htmlTemplate: "✅ On-chain (SSTORE2, with embedded pako.js)",
        loaderJavaScript: "✅ On-chain (embedded in template)",
        spattersJs: "✅ On-chain (SSTORE2 on Sepolia)",
        tokenData: "✅ On-chain (Spatters contract on Sepolia)",
        p5js: "✅ On-chain (Art Blocks DependencyRegistry on Mainnet)",
        pakoJs: "✅ On-chain (embedded in template for gzip decompression)",
      },
      offChainComponents: {
        rpcUrls: "This server injects RPC URLs from .env",
        nothing_else: "Everything else is on-chain!",
      },
    });
  } catch (error: any) {
    res.json({
      name: "Spatters API",
      version: "4.0.0",
      error: error.message,
      note: "Generator contract not yet configured. Run deployment scripts first.",
    });
  }
});

/**
 * Health check
 */
app.get("/health", async (req, res) => {
  try {
    const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];

    // Check contract
    const totalSupply = await publicClient.readContract({
      address: contracts.spatters,
      abi: SPATTERS_ABI,
      functionName: "totalSupply",
    });

    // Check template
    let templateStatus = "not loaded";
    try {
      if (contracts.generator) {
        const config = await getTemplateConfig();
        templateStatus = `✅ loaded (${config.storageAddresses.length} chunks)`;
      }
    } catch (e) {
      templateStatus = "❌ generator not configured";
    }

    res.json({
      status: "ok",
      network: NETWORK,
      chain: chain.name,
      totalSupply: totalSupply.toString(),
      contracts,
      template: templateStatus,
      rpc: {
        sepolia: SEPOLIA_RPC_URL.includes("alchemy") ? "Alchemy" : "Public",
        mainnet: MAINNET_RPC_URL.includes("alchemy") ? "Alchemy" : "Public",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

/**
 * Get HTML for a token
 * This is the main endpoint - fetches on-chain template and injects RPC URLs
 */
app.get("/token/:id", async (req, res) => {
  try {
    const tokenId = req.params.id;
    const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];

    // Verify token exists
    try {
      await publicClient.readContract({
        address: contracts.spatters,
        abi: SPATTERS_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });
    } catch {
      res.status(404).json({
        error: "Token not found",
        tokenId,
      });
      return;
    }

    // Generate HTML (fetches template from chain, injects RPC URLs)
    const html = await generateTokenHtml(tokenId);

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  } catch (error: any) {
    console.error(`❌ Error generating HTML:`, error.message);
    res.status(500).json({
      error: "Failed to generate HTML",
      message: error.message,
    });
  }
});

/**
 * OpenSea-compatible metadata
 */
app.get("/metadata/:id", async (req, res) => {
  try {
    const tokenId = req.params.id;
    const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];

    // Verify token exists
    try {
      await publicClient.readContract({
        address: contracts.spatters,
        abi: SPATTERS_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });
    } catch {
      res.status(404).json({
        error: "Token not found",
        tokenId,
      });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      name: `Spatters #${tokenId}`,
      description:
        "Fully on-chain generative NFT. All components (HTML template, loader code, generative algorithm, token data) stored on Ethereum blockchain. Only RPC URLs are provided by the API server.",
      image: `${baseUrl}/image/${tokenId}.png`,
      animation_url: `${baseUrl}/token/${tokenId}`,
      attributes: [
        { trait_type: "Generation", value: "100% On-chain" },
        { trait_type: "Network", value: NETWORK === "mainnet" ? "Ethereum" : "Sepolia" },
        { trait_type: "Architecture", value: "On-Chain Template" },
      ],
      external_url: `https://spatters.art/token/${tokenId}`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to generate metadata",
      message: error.message,
    });
  }
});

/**
 * Generate PNG image (requires Puppeteer)
 */
app.get("/image/:id.png", async (req, res) => {
  try {
    const tokenId = req.params.id.replace(".png", "");

    // Generate HTML
    const html = await generateTokenHtml(tokenId);

    // Render with Puppeteer
    console.log(`📸 Rendering image for token #${tokenId}...`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1200 });
    await page.setContent(html);

    // Wait for blockchain fetching + p5.js rendering
    // The template shows "Loading from blockchain..." while fetching
    await page.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('hidden');
      },
      { timeout: 60000 }
    ).catch(() => {
      // Fallback: just wait 15 seconds
      console.log("⏳ Waiting for render (fallback)...");
    });

    // Extra time for rendering
    await new Promise(resolve => setTimeout(resolve, 5000));

    const screenshot = await page.screenshot({ type: "png" });
    await browser.close();

    console.log(`✅ Image rendered for token #${tokenId}`);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(screenshot);
  } catch (error: any) {
    console.error(`❌ Error rendering image:`, error.message);
    res.status(500).json({
      error: "Failed to render image",
      message: error.message,
    });
  }
});

// ============ Start Server ============

app.listen(PORT, async () => {
  console.log("\n🎨 Spatters API - On-Chain Template Architecture");
  console.log("================================================");
  console.log(`🌐 Network: ${NETWORK}`);
  console.log(`🔗 Sepolia RPC: ${SEPOLIA_RPC_URL.includes("alchemy") ? "✅ Alchemy" : "⚠️  Public"}`);
  console.log(`🔗 Mainnet RPC: ${MAINNET_RPC_URL.includes("alchemy") ? "✅ Alchemy" : "⚠️  Public"}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Try to load config
  const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];
  if (contracts.generator) {
    try {
      const config = await getTemplateConfig();
      console.log(`📦 spatters.js Chunks: ${config.storageAddresses.length}`);
      console.log(`📄 Template Chunks: ${config.templateAddresses.length}`);
    } catch (e: any) {
      console.log(`⚠️  Could not load config: ${e.message}`);
    }
  } else {
    console.log(`⚠️  Generator not configured. Update CONTRACTS after deployment.`);
  }
  
  console.log(`\n📋 Endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Token HTML: http://localhost:${PORT}/token/:id`);
  console.log(`   Token Image: http://localhost:${PORT}/image/:id.png`);
  console.log(`   Metadata: http://localhost:${PORT}/metadata/:id`);
  console.log("\n✨ ALL logic is on-chain! This server only injects RPC URLs.");
  console.log("================================================\n");
});

export default app;
