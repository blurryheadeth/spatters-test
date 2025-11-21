'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import MintSection from '@/components/MintSection';
import { COLLECTION_CONFIG } from '@/lib/config';

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                Spatters
              </h1>
              <p className="text-gray-400 mt-1">Dynamic On-Chain NFT Collection</p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-purple-950/20 to-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-6xl font-bold mb-6">
            Fully On-Chain
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Generative Art
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {COLLECTION_CONFIG.maxSupply} unique, mutable NFTs with time-based evolution.
            All metadata and generation scripts stored on Ethereum.
          </p>
          <div className="flex gap-8 justify-center text-sm">
            <div>
              <div className="text-3xl font-bold text-purple-400">{COLLECTION_CONFIG.maxSupply}</div>
              <div className="text-gray-400">Total Supply</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-400">0.00618 ETH</div>
              <div className="text-gray-400">Starting Price</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-400">100 ETH</div>
              <div className="text-gray-400">Final Price</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mint Section */}
      {isConnected ? (
        <MintSection />
      ) : (
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-md mx-auto bg-gray-900/50 border border-gray-800 rounded-lg p-8">
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-6">
                Connect your wallet to start minting Spatters NFTs
              </p>
              <ConnectButton />
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Features</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="text-4xl mb-4">🎨</div>
              <h4 className="text-xl font-bold mb-2">Fully On-Chain</h4>
              <p className="text-gray-400">
                All metadata and p5.js generation scripts stored permanently on Ethereum blockchain
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="text-4xl mb-4">🔄</div>
              <h4 className="text-xl font-bold mb-2">Time-Based Mutations</h4>
              <p className="text-gray-400">
                NFTs can evolve on specific dates based on their unique properties and anniversaries
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="text-4xl mb-4">🔐</div>
              <h4 className="text-xl font-bold mb-2">Anti-Whale Protection</h4>
              <p className="text-gray-400">
                Fair distribution with per-wallet limits and cooldown periods
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>© 2025 Spatters. All rights reserved.</p>
          <p className="mt-2 text-sm">Built on Ethereum</p>
        </div>
      </footer>
    </div>
  );
}
