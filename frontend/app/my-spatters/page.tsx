'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import Link from 'next/link';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { getRecentlyMutatedTokenIds, clearAllMutationRecords } from '@/lib/mutation-tracker';
import Navbar from '@/components/Navbar';

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

export default function MySpattersPage() {
  const { address, chainId, isConnected } = useAccount();
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Modal state for Generate Larger Resolution
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [customWidth, setCustomWidth] = useState<string>('1200');
  
  // Sort and filter state
  const [sortAscending, setSortAscending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Recently mutated tokens tracking
  const [recentlyMutated, setRecentlyMutated] = useState<number[]>([]);
  const [imageVersion, setImageVersion] = useState(0);

  // Check for recently mutated tokens on mount
  useEffect(() => {
    const mutated = getRecentlyMutatedTokenIds();
    setRecentlyMutated(mutated);
  }, []);

  // Force refresh thumbnails and clear mutation records
  const handleRefreshThumbnails = useCallback(() => {
    setImageVersion(prev => prev + 1);
    clearAllMutationRecords();
    setRecentlyMutated([]);
  }, []);

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
      abi: SpattersABI.abi as readonly unknown[],
      functionName: 'ownerOf',
      args: [BigInt(id)],
    }));
  }, [contractAddress, tokenIds]);

  const { data: ownerResults, isLoading: isLoadingOwners } = useReadContracts({
    contracts: ownerCalls as any,
    query: { enabled: ownerCalls.length > 0 },
  });

  // Batch fetch mutation counts for all tokens (for cache-busting image URLs)
  const mutationCalls = useMemo(() => {
    if (!contractAddress || tokenIds.length === 0) return [];
    return tokenIds.map(id => ({
      address: contractAddress as `0x${string}`,
      abi: SpattersABI.abi as readonly unknown[],
      functionName: 'getTokenMutations',
      args: [BigInt(id)],
    }));
  }, [contractAddress, tokenIds]);

  const { data: mutationResults } = useReadContracts({
    contracts: mutationCalls as any,
    query: { enabled: mutationCalls.length > 0 },
  });

  // Create a map of tokenId -> mutation count
  const mutationCounts = useMemo(() => {
    const map: Record<number, number> = {};
    if (mutationResults) {
      tokenIds.forEach((id, idx) => {
        const result = mutationResults[idx];
        if (result && result.status === 'success' && Array.isArray(result.result)) {
          map[id] = result.result.length;
        } else {
          map[id] = 0;
        }
      });
    }
    return map;
  }, [mutationResults, tokenIds]);

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

  // Apply search filter and sorting
  const displayedTokens = useMemo(() => {
    let filtered = myTokens;
    
    // Filter by search query (match token IDs containing the search string)
    if (searchQuery.trim()) {
      filtered = myTokens.filter(id => 
        id.toString().includes(searchQuery.trim())
      );
    }
    
    // Sort by ID
    const sorted = [...filtered].sort((a, b) => 
      sortAscending ? a - b : b - a
    );
    
    return sorted;
  }, [myTokens, searchQuery, sortAscending]);

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
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div 
            className="text-center p-8 border-2"
            style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
          >
            <h1 className="text-2xl font-black mb-4" style={{ color: COLORS.black }}>My Spatters</h1>
            <p className="mb-6" style={{ color: COLORS.black }}>
              Please connect your wallet to view your collection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = isLoadingSupply || isLoadingOwners;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <Navbar />

      {/* Recently Mutated Banner */}
      {recentlyMutated.length > 0 && myTokens.some(t => recentlyMutated.includes(t)) && (
        <div 
          className="px-4 py-3 text-center border-b-2"
          style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
        >
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="font-medium">
              🎨 Some of your Spatters were recently mutated!
            </span>
            <button
              onClick={handleRefreshThumbnails}
              className="px-4 py-1 text-sm font-bold border-2 hover:opacity-70 transition-opacity"
              style={{ backgroundColor: COLORS.black, borderColor: COLORS.black, color: COLORS.white }}
            >
              Refresh Thumbnails
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black mb-6" style={{ color: COLORS.black }}>My Spatters</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div 
              className="animate-spin h-12 w-12 border-4 border-t-transparent"
              style={{ borderColor: COLORS.red, borderTopColor: 'transparent' }}
            ></div>
            <p className="ml-4" style={{ color: COLORS.black }}>Loading your collection...</p>
          </div>
        ) : myTokens.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.black }}>
              No Spatters Found
            </h2>
            <p className="mb-6" style={{ color: COLORS.black }}>
              You don&apos;t own any Spatters yet.
            </p>
            <Link
              href="/"
              className="inline-block font-bold py-3 px-6 border-2 hover:opacity-70 transition-opacity"
              style={{ backgroundColor: COLORS.red, borderColor: COLORS.black, color: COLORS.white }}
            >
              Mint Your First Spatter
            </Link>
          </div>
        ) : (
          <>
            {/* Controls bar */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p style={{ color: COLORS.black }}>
                You own <strong>{myTokens.length}</strong> Spatter{myTokens.length !== 1 ? 's' : ''}
                {searchQuery && displayedTokens.length !== myTokens.length && (
                  <span> (showing {displayedTokens.length})</span>
                )}
              </p>
              
              <div className="flex items-center gap-3">
                {/* Search input */}
                <input
                  type="text"
                  placeholder="Search by ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 sm:w-48 px-3 py-2 border-2 text-sm"
                  style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}
                />
                
                {/* Sort toggle button */}
                <button
                  onClick={() => setSortAscending(!sortAscending)}
                  className="flex items-center gap-2 px-4 py-2 border-2 text-sm font-medium hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}
                >
                  {sortAscending ? 'ID ↑ (asc)' : 'ID ↓ (desc)'}
                </button>
              </div>
            </div>

            {/* No results message */}
            {displayedTokens.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <p style={{ color: COLORS.black }}>
                  No Spatters found matching &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 font-bold hover:opacity-70"
                  style={{ color: COLORS.blue }}
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Grid with larger cards - 2 per row on medium, 3 on large */}
            {displayedTokens.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedTokens.map((tokenId) => (
                <div
                  key={tokenId}
                  className="border-2 overflow-hidden"
                  style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
                >
                  {/* Larger image preview */}
                  <Link href={`/token/${tokenId}`}>
                    <div className="w-full aspect-[4/3]" style={{ backgroundColor: COLORS.background }}>
                      <img
                        src={`${baseUrl}/api/image/${tokenId}?m=${mutationCounts[tokenId] ?? 0}&c=${contractAddress?.slice(-8) || ''}${imageVersion > 0 ? `&v=${imageVersion}` : ''}`}
                        alt={`Spatter #${tokenId}`}
                        className="w-full h-full object-contain hover:opacity-90 transition-opacity"
                      />
                    </div>
                  </Link>

                  {/* Token info */}
                  <div className="p-5 border-t-2" style={{ borderColor: COLORS.black }}>
                    <h3 className="text-xl font-black mb-4" style={{ color: COLORS.black }}>
                      Spatter #{tokenId}
                    </h3>

                    {/* Action buttons */}
                    <div className="space-y-3">
                      <Link
                        href={`/token/${tokenId}`}
                        className="block w-full text-center font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
                        style={{ backgroundColor: COLORS.blue, borderColor: COLORS.black, color: COLORS.white }}
                      >
                        View
                      </Link>

                      <button
                        onClick={() => openWidthModal(tokenId)}
                        className="block w-full text-center font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
                        style={{ backgroundColor: COLORS.yellow, borderColor: COLORS.black, color: COLORS.black }}
                      >
                        Generate Larger Resolution
                      </button>

                      <Link
                        href={`/mutate/${tokenId}`}
                        className="block w-full text-center font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
                        style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
                      >
                        Mutate
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </main>

      {/* Width Input Modal - Fixed overlay opacity */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div 
            className="w-full max-w-md mx-4 p-6 border-2"
            style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
          >
            <h2 className="text-xl font-black mb-4" style={{ color: COLORS.black }}>
              Generate Larger Resolution
            </h2>
            <p className="mb-4" style={{ color: COLORS.black }}>
              Spatter #{selectedTokenId}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: COLORS.black }}>
                Canvas Width (pixels)
              </label>
              <input
                type="number"
                min="1200"
                max="8400"
                step="100"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-full px-4 py-2 border-2"
                style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}
              />
              <p className="text-xs mt-1" style={{ color: COLORS.black, opacity: 0.7 }}>
                Range: 1200 - 8400 pixels. Higher values will take longer to generate.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
                style={{ backgroundColor: COLORS.background, borderColor: COLORS.black, color: COLORS.black }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateLarger}
                className="flex-1 font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
                style={{ backgroundColor: COLORS.yellow, borderColor: COLORS.black, color: COLORS.black }}
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
