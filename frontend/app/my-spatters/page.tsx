'use client';

import { useState, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import Link from 'next/link';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

export default function MySpattersPage() {
  const { address, chainId, isConnected } = useAccount();
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const etherscanBase = chainId ? getEtherscanBaseUrl(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Modal state for Generate Larger Resolution
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [customWidth, setCustomWidth] = useState<string>('1200');

  // Get total supply
  const { data: totalSupplyBigInt, isLoading: isLoadingSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'totalSupply',
    query: { enabled: !!contractAddress },
  });

  const totalSupply = Number(totalSupplyBigInt || 0);

  // Generate token IDs to check ownership
  const tokenIds = useMemo(() => {
    return Array.from({ length: totalSupply }, (_, i) => i + 1);
  }, [totalSupply]);

  // Batch check ownership for all tokens
  const ownerCalls = useMemo(() => {
    if (!contractAddress || tokenIds.length === 0) return [];
    return tokenIds.map(id => ({
      address: contractAddress as `0x${string}`,
      abi: SpattersABI.abi,
      functionName: 'ownerOf',
      args: [BigInt(id)],
    }));
  }, [contractAddress, tokenIds]);

  const { data: ownerResults, isLoading: isLoadingOwners } = useReadContracts({
    contracts: ownerCalls,
    query: { enabled: ownerCalls.length > 0 },
  });

  // Filter tokens owned by current user
  const myTokens = useMemo(() => {
    if (!ownerResults || !address) return [];
    return tokenIds.filter((id, index) => {
      const result = ownerResults[index];
      if (result.status === 'success' && result.result) {
        return (result.result as string).toLowerCase() === address.toLowerCase();
      }
      return false;
    });
  }, [ownerResults, tokenIds, address]);

  // Handle opening the width modal
  const openWidthModal = (tokenId: number) => {
    setSelectedTokenId(tokenId);
    setCustomWidth('1200');
    setIsModalOpen(true);
  };

  // Handle generate with custom width
  const handleGenerateLarger = () => {
    if (selectedTokenId === null) return;
    const width = parseInt(customWidth, 10);
    if (isNaN(width) || width < 1200 || width > 8400) {
      alert('Width must be between 1200 and 8400');
      return;
    }
    // Open in new tab
    window.open(`${baseUrl}/api/generate/${selectedTokenId}?width=${width}`, '_blank');
    setIsModalOpen(false);
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">My Spatters</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to view your collection.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = isLoadingSupply || isLoadingOwners;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Spatters
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">My Spatters</h1>
          <Link href="/collection" className="text-blue-600 hover:underline">
            View All Collection →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="ml-4 text-gray-600 dark:text-gray-400">Loading your collection...</p>
          </div>
        ) : myTokens.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              No Spatters Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don&apos;t own any Spatters yet.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              Mint Your First Spatter
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400">
                You own <strong className="text-gray-800 dark:text-gray-200">{myTokens.length}</strong> Spatter{myTokens.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Grid with larger cards - 2 per row on medium, 3 on large */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {myTokens.map((tokenId) => (
                <div
                  key={tokenId}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  {/* Larger image preview */}
                  <Link href={`/token/${tokenId}`}>
                    <div className="w-full aspect-square bg-black">
                      <img
                        src={`${baseUrl}/api/image/${tokenId}`}
                        alt={`Spatter #${tokenId}`}
                        className="w-full h-full object-contain hover:opacity-90 transition-opacity"
                      />
                    </div>
                  </Link>

                  {/* Token info */}
                  <div className="p-5">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
                      Spatter #{tokenId}
                    </h3>

                    {/* Action buttons */}
                    <div className="space-y-3">
                      <Link
                        href={`/token/${tokenId}`}
                        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        View
                      </Link>

                      <button
                        onClick={() => openWidthModal(tokenId)}
                        className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Generate Larger Resolution
                      </button>

                      <Link
                        href={`/mutate/${tokenId}`}
                        className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Mutate
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Width Input Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
              Generate Larger Resolution
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Spatter #{selectedTokenId}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Canvas Width (pixels)
              </label>
              <input
                type="number"
                min="1200"
                max="8400"
                step="100"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Range: 1200 - 8400 pixels. Higher values will take longer to generate.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateLarger}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

