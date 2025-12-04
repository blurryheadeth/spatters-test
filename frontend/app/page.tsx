'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import PublicMint from '@/components/PublicMint';
import OwnerMint from '@/components/OwnerMint';
import { COLLECTION_CONFIG } from '@/lib/config';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'public' | 'owner'>('public');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                Spatters
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Fully On-Chain Seed-Based Generative Art
              </p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Fully On-Chain
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Generative Art
            </span>
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {COLLECTION_CONFIG.maxSupply} unique NFTs with deterministic generation from on-chain seeds.
            All code stored on Ethereum. Zero external dependencies.
          </p>
          <div className="flex gap-8 justify-center text-sm">
            <div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {COLLECTION_CONFIG.maxSupply}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Total Supply</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">0.01 ETH</div>
              <div className="text-gray-600 dark:text-gray-400">Starting Price</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">100 ETH</div>
              <div className="text-gray-600 dark:text-gray-400">Final Price</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mint Section */}
      {isConnected ? (
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-5xl">
            {/* Tabs */}
            <div className="flex space-x-4 mb-8 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('public')}
                className={`pb-4 px-6 font-semibold transition-colors ${
                  activeTab === 'public'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Public Mint
              </button>
              <button
                onClick={() => setActiveTab('owner')}
                className={`pb-4 px-6 font-semibold transition-colors ${
                  activeTab === 'owner'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Owner Mint
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'public' ? <PublicMint /> : <OwnerMint />}
          </div>
        </section>
      ) : (
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Connect your wallet to start minting Spatters NFTs
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Features</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">🎨</div>
              <h4 className="text-xl font-bold mb-2">Seed-Based Generation</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Each NFT generated from on-chain seeds using p5.js. Choose from 3 previews before minting.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">🔄</div>
              <h4 className="text-xl font-bold mb-2">Time-Based Mutations</h4>
              <p className="text-gray-600 dark:text-gray-400">
                92 mutation types available on specific dates: anniversaries, equinoxes, and solstices.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">🎨</div>
              <h4 className="text-xl font-bold mb-2">Custom Palettes</h4>
              <p className="text-gray-600 dark:text-gray-400">
                First 25 tokens can be minted by owner with optional custom 6-color palettes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-100 dark:bg-gray-800/50">
        <div className="container mx-auto px-4 max-w-4xl">
          <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Request Mint</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Pay the mint price and request 3 unique seeds from the contract
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Preview & Choose</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  View 3 generated artworks and select your favorite
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Complete Mint</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Confirm your choice and mint your Spatter NFT
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 bg-white dark:bg-black">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>© 2025 Spatters. All rights reserved.</p>
          <p className="mt-2 text-sm">Built on Ethereum • Fully On-Chain</p>
        </div>
      </footer>
    </div>
  );
}
