'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import PreviewCard from './PreviewCard';

interface PreviewOption {
  id: number;
  seed: bigint;
  metadata: string;
}

export default function MintSection() {
  const { chainId } = useAccount();
  const [previews, setPreviews] = useState<PreviewOption[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const contractAddress = chainId ? getContractAddress(chainId) : '';

  // Read mint price
  const { data: mintPrice } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getMintPrice',
  });

  // Read total supply
  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'totalSupply',
  });

  // Mint transaction
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  // Generate 3 preview options
  const generatePreviews = () => {
    setIsGenerating(true);
    const baseTimestamp = Math.floor(Date.now() / 1000);
    const newPreviews: PreviewOption[] = [];

    for (let i = 0; i < 3; i++) {
      // Seeds are 7 seconds apart
      const timestamp = baseTimestamp + (i * 7);
      
      // Simulate seed generation (in production, this would use proper on-chain logic)
      const seed = BigInt(timestamp);
      
      // Generate random metadata (in production, this would use the p5.js script)
      const metadata = JSON.stringify({
        circles: Math.floor(Math.random() * 4),
        lines: Math.floor(Math.random() * 4),
        selectedColors: generateRandomColors(Math.floor(Math.random() * 4) + 1),
        palette: ['warm', 'cool', 'vibrant'][Math.floor(Math.random() * 3)],
        backgroundColor: '#' + Math.floor(Math.random()*16777215).toString(16),
        mutation: '',
        changeHistory: [],
      });

      newPreviews.push({ id: i, seed, metadata });
    }

    setPreviews(newPreviews);
    setIsGenerating(false);
  };

  // Helper to generate random colors
  const generateRandomColors = (count: number): string[] => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push('#' + Math.floor(Math.random()*16777215).toString(16));
    }
    return colors;
  };

  // Handle mint
  const handleMint = () => {
    if (!selectedPreview !== null && !contractAddress || !mintPrice) return;

    const selected = previews.find(p => p.id === selectedPreview);
    if (!selected) return;

    writeContract({
      address: contractAddress as `0x${string}`,
      abi: SpattersABI.abi,
      functionName: 'mint',
      args: [selected.metadata],
      value: mintPrice as bigint,
    });
  };

  // Auto-generate previews on mount
  useEffect(() => {
    if (contractAddress && !isGenerating && previews.length === 0) {
      generatePreviews();
    }
  }, [contractAddress]);

  // Reset after successful mint
  useEffect(() => {
    if (isConfirmed) {
      setPreviews([]);
      setSelectedPreview(null);
      generatePreviews();
    }
  }, [isConfirmed]);

  if (!contractAddress) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
            <p className="text-yellow-400">⚠️ Please switch to Sepolia testnet or Ethereum mainnet</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Status */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold mb-2">Mint Your Spatter</h3>
                <p className="text-gray-400">
                  Supply: {totalSupply?.toString() || '...'} / 999
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-400">
                  {mintPrice ? formatEther(mintPrice as bigint) : '...'} ETH
                </div>
                <p className="text-gray-400 text-sm">Current Price</p>
              </div>
            </div>
          </div>

          {/* Preview Selection */}
          {previews.length > 0 ? (
            <>
              <h4 className="text-xl font-bold mb-4 text-center">Choose Your Spatter</h4>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {previews.map((preview) => (
                  <PreviewCard
                    key={preview.id}
                    preview={preview}
                    isSelected={selectedPreview === preview.id}
                    onSelect={() => setSelectedPreview(preview.id)}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={generatePreviews}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isGenerating ? 'Generating...' : 'Generate New Options'}
                </button>
                <button
                  onClick={handleMint}
                  disabled={selectedPreview === null || isPending || isConfirming}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending || isConfirming ? 'Minting...' : 'Mint Selected'}
                </button>
              </div>

              {/* Transaction Status */}
              {hash && (
                <div className="mt-6 text-center">
                  {isConfirming && (
                    <p className="text-yellow-400">⏳ Waiting for confirmation...</p>
                  )}
                  {isConfirmed && (
                    <p className="text-green-400">✅ Minted successfully!</p>
                  )}
                  <a
                    href={`https://etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    View transaction →
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Generating preview options...</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


