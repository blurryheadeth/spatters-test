'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { useState } from 'react';
import PublicMint from '@/components/PublicMint';
import OwnerMint from '@/components/OwnerMint';
import Navbar from '@/components/Navbar';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

// Spatters color palette
const COLORS = {
  background: '#EBE5D9',
  red: '#fc1a4a',
  green: '#75d494',
  blue: '#2587c3',
  yellow: '#f2c945',
  black: '#000000',
  white: '#FFFFFF',
};

// Styled "Spatters" title with each letter colored
function SpattersTitle({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span style={{ color: COLORS.red }}>S</span>
      <span style={{ color: COLORS.yellow }}>p</span>
      <span style={{ color: COLORS.blue }}>a</span>
      <span style={{ color: COLORS.green }}>t</span>
      <span style={{ color: COLORS.yellow }}>t</span>
      <span style={{ color: COLORS.blue }}>e</span>
      <span style={{ color: COLORS.green }}>r</span>
      <span style={{ color: COLORS.red }}>s</span>
    </span>
  );
}

export default function Home() {
  const { isConnected, chainId, address } = useAccount();
  const [activeTab, setActiveTab] = useState<'public' | 'owner'>('public');
  
  // Get contract address for the current chain (default to Sepolia)
  const currentChainId = chainId || 11155111;
  const contractAddress = getContractAddress(currentChainId);
  const etherscanBase = getEtherscanBaseUrl(currentChainId);

  // Check if connected wallet is owner
  const { data: ownerAddress } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'owner',
  });

  const isOwner = address && ownerAddress && 
    address.toLowerCase() === (ownerAddress as string).toLowerCase();

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="py-16" style={{ backgroundColor: COLORS.background }}>
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-7xl md:text-8xl font-black mb-6 tracking-tight">
            <SpattersTitle />
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: COLORS.black }}>
            Up to 999 pieces of generative art that evolve along with their collectors. 
            All code stored on Ethereum. Zero off-chain dependencies.
          </p>
          <div className="flex gap-8 md:gap-12 justify-center flex-wrap">
            <div className="text-center">
              <div className="text-4xl font-black" style={{ color: COLORS.red }}>999</div>
              <div className="text-sm font-medium" style={{ color: COLORS.black }}>Max Supply</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black" style={{ color: COLORS.blue }}>0.007 ETH</div>
              <div className="text-sm font-medium" style={{ color: COLORS.black }}>Starting Price</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black" style={{ color: COLORS.yellow }}>1%</div>
              <div className="text-sm font-medium" style={{ color: COLORS.black }}>Price increase per mint</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black" style={{ color: COLORS.green }}>100 ETH</div>
              <div className="text-sm font-medium" style={{ color: COLORS.black }}>Final Price</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-8" style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h3 className="text-3xl font-black text-center mb-12" style={{ color: COLORS.black }}>
            How It Works
          </h3>
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div 
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-xl"
                style={{ backgroundColor: COLORS.blue, color: COLORS.white }}
              >
                1
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                  Request Mint
                </h4>
                <p style={{ color: COLORS.black }}>
                  Pay the mint price and request 3 unique seeds from the contract. 
                  <span className="font-semibold"> Each token costs 1% more than the previous one</span>, 
                  ending at 100 ETH for token #999.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div 
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-xl"
                style={{ backgroundColor: COLORS.yellow, color: COLORS.black }}
              >
                2
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                  Preview & Choose
                </h4>
                <p style={{ color: COLORS.black }}>
                  View 3 generated artworks and select your favorite.
                </p>
                <div 
                  className="mt-3 p-3 border-2 font-semibold"
                  style={{ borderColor: COLORS.red, backgroundColor: '#fff0f0', color: COLORS.red }}
                >
                  ⚠️ You have 55 minutes to choose. If no option is selected, 
                  the mint is cancelled and the minting fee is <strong>NOT refundable</strong>.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div 
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-xl"
                style={{ backgroundColor: COLORS.green, color: COLORS.white }}
              >
                3
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                  Complete Mint
                </h4>
                <p style={{ color: COLORS.black }}>
                  Confirm your choice and your Spatter NFT is minted to your wallet.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start space-x-4">
              <div 
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-xl"
                style={{ backgroundColor: COLORS.red, color: COLORS.white }}
              >
                4
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                  Your Spatter grows with you
                </h4>
                <p style={{ color: COLORS.black }}>
                  On specific dates each year, you can apply a change to your Spatter. You can choose the kind of modification, but the exact change will be based off a blockchain-generated seed. The outcome will be permanently recorded as part of the Spatter's full version history. 
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-t-2" style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}>
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-black text-center mb-12" style={{ color: COLORS.black }}>
            Features
          </h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Seed-Based Generation */}
            <div 
              className="border-2 p-6"
              style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
            >
              <div className="text-4xl mb-4">🎨</div>
              <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                Seed-Based Generation
              </h4>
              <p style={{ color: COLORS.black }}>
                Each NFT is generated from on-chain seeds using p5.js. Choose from 3 previews before minting.
              </p>
            </div>

            {/* Time-Based Mutations */}
            <div 
              className="border-2 p-6"
              style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
            >
              <div className="text-4xl mb-4">🔄</div>
              <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                Shape your Spatter
              </h4>
              <p style={{ color: COLORS.black }}>
                94 mutation types available each year on minting anniversaries of tokens #1, #100, #500, #750, #999 and each token&apos;s own minting anniversary. 
              </p>
            </div>

            {/* Interactive History */}
            <div 
              className="border-2 p-6"
              style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
            >
              <div className="text-4xl mb-4">📜</div>
              <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.black }}>
                Full Version History
              </h4>
              <p style={{ color: COLORS.black }}>
                Click any artwork to cycle through its full journey: from mint, through every mutation up to its current form.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Mint Section */}
      {isConnected ? (
        <section className="py-16 border-t-2" style={{ backgroundColor: COLORS.white }}>
          <div className="container mx-auto px-4 max-w-5xl">
            {/* Only show tabs for contract owner */}
            {isOwner ? (
              <>
                {/* Owner Tabs */}
                <div className="flex space-x-4 mb-8 border-b-2" style={{ borderColor: COLORS.black }}>
                  <button
                    onClick={() => setActiveTab('public')}
                    className="pb-3 px-6 font-bold transition-all"
                    style={{
                      borderBottom: activeTab === 'public' ? `3px solid ${COLORS.red}` : '3px solid transparent',
                      color: activeTab === 'public' ? COLORS.red : COLORS.black,
                    }}
                  >
                    Mint a Spatter
                  </button>
                  <button
                    onClick={() => setActiveTab('owner')}
                    className="pb-3 px-6 font-bold transition-all"
                    style={{
                      borderBottom: activeTab === 'owner' ? `3px solid ${COLORS.blue}` : '3px solid transparent',
                      color: activeTab === 'owner' ? COLORS.blue : COLORS.black,
                    }}
                  >
                    Owner Mint
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'public' ? <PublicMint /> : <OwnerMint />}
              </>
            ) : (
              /* Non-owners see only the public mint interface */
              <PublicMint />
            )}
          </div>
        </section>
      ) : (
        <section className="py-16" style={{ backgroundColor: COLORS.background }}>
          <div className="container mx-auto px-4 text-center">
            <div 
              className="max-w-md mx-auto border-2 p-8"
              style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
            >
              <h3 className="text-2xl font-bold mb-4" style={{ color: COLORS.black }}>
                Connect Your Wallet
              </h3>
              <p className="mb-6" style={{ color: COLORS.black }}>
                Connect your wallet to start minting Spatters
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* On-Chain Architecture */}
      <section className="py-16 border-t-2" style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h3 className="text-3xl font-black text-center mb-8" style={{ color: COLORS.black }}>
            100% On-Chain
          </h3>
          <div 
            className="border-2 p-6"
            style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
          >
            <p className="mb-4" style={{ color: COLORS.black }}>
              Spatters is a fully on-chain generative art project. Every component needed to render the artwork 
              is stored permanently on the Ethereum blockchain:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2" style={{ color: COLORS.black }}>
              <li>
                <strong>Spatters Contract:</strong> Stores all token data including mint seeds, mutations, and custom palettes
              </li>
              <li>
                <strong>Generator Contract:</strong> Contains the custom rendering logic (spatters.js) split across multiple storage chunks
              </li>
              <li>
                <strong>p5.js Dependency:</strong> We use the p5.js library (v1.0.0) deployed on-chain by{' '}
                <a 
                  href="https://artblocks.io" 
            target="_blank"
            rel="noopener noreferrer"
                  className="font-semibold hover:opacity-70"
                  style={{ color: COLORS.blue }}
                >
                  Art Blocks
                </a>
                {' '}via their DependencyRegistry contract on Ethereum mainnet
              </li>
              <li>
                <strong>HTML Template:</strong> A minimal viewer template stored on-chain that assembles all components client-side
              </li>
            </ul>
            <div className="text-center pt-4 border-t-2" style={{ borderColor: COLORS.black }}>
              <p className="text-sm mb-2" style={{ color: COLORS.black }}>Contract Address:</p>
              <a
                href={`${etherscanBase}/address/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
                className="font-mono text-lg font-bold hover:opacity-70 transition-opacity break-all"
                style={{ color: COLORS.blue }}
              >
                {contractAddress}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 py-8" style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}>
        <div className="container mx-auto px-4 text-center" style={{ color: COLORS.black }}>
          <p className="font-medium">© 2025 Spatters. All rights reserved.</p>
          <p className="mt-2 text-sm">Built on Ethereum • Fully On-Chain</p>
        </div>
      </footer>
    </div>
  );
}
