'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import Link from 'next/link';
import { Abi } from 'viem';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { getRecentlyMutatedTokenIds, clearAllMutationRecords } from '@/lib/mutation-tracker';

const contractAbi = SpattersABI.abi as Abi;

const TOKENS_PER_PAGE = 24;

export default function CollectionPage() {
  const [searchId, setSearchId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [chainId] = useState<number>(11155111); // Default to Sepolia
  const [imageVersion, setImageVersion] = useState(0); // For cache-busting images
  const [recentlyMutated, setRecentlyMutated] = useState<number[]>([]);

  // Check for recently mutated tokens on mount
  useEffect(() => {
    const mutated = getRecentlyMutatedTokenIds();
    setRecentlyMutated(mutated);
  }, []);

  // Force refresh all thumbnails and clear mutation records
  const handleRefreshThumbnails = useCallback(() => {
    setImageVersion(prev => prev + 1);
    clearAllMutationRecords();
    setRecentlyMutated([]);
  }, []);
  
  const contractAddress = getContractAddress(chainId);
  const etherscanBase = getEtherscanBaseUrl(chainId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Get total supply
  const { data: totalSupply, isLoading: isLoadingSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'totalSupply',
  });

  const supply = Number(totalSupply || 0);
  
  // Calculate pagination
  const totalPages = Math.ceil(supply / TOKENS_PER_PAGE);
  
  // Get token IDs for current page (newest first)
  const tokenIds = useMemo(() => {
    if (supply === 0) return [];
    
    const startIdx = supply - ((currentPage - 1) * TOKENS_PER_PAGE);
    const endIdx = Math.max(1, startIdx - TOKENS_PER_PAGE + 1);
    
    const ids = [];
    for (let i = startIdx; i >= endIdx; i--) {
      ids.push(i);
    }
    return ids;
  }, [supply, currentPage]);

  // Fetch owners for current page tokens
  const ownerCalls = tokenIds.map(id => ({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'ownerOf' as const,
    args: [BigInt(id)] as const,
  }));

  const { data: ownerResults } = useReadContracts({
    contracts: ownerCalls,
  });

  // Fetch mutation counts for current page tokens (for cache-busting image URLs)
  const mutationCalls = tokenIds.map(id => ({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'getTokenMutations' as const,
    args: [BigInt(id)] as const,
  }));

  const { data: mutationResults } = useReadContracts({
    contracts: mutationCalls,
  });

  // Create a map of tokenId -> owner
  const owners = useMemo(() => {
    const map: Record<number, string> = {};
    if (ownerResults) {
      tokenIds.forEach((id, idx) => {
        const result = ownerResults[idx];
        if (result && result.status === 'success') {
          map[id] = result.result as string;
        }
      });
    }
    return map;
  }, [ownerResults, tokenIds]);

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

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(searchId);
    if (id > 0 && id <= supply) {
      window.location.href = `/token/${id}`;
    }
  };

  // Filtered tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchId) return tokenIds;
    const searchNum = parseInt(searchId);
    if (isNaN(searchNum)) return tokenIds;
    return tokenIds.filter(id => id.toString().includes(searchId));
  }, [tokenIds, searchId]);

  if (isLoadingSupply) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading collection...</p>
        </div>
      </div>
    );
  }

  if (supply === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">No Tokens Yet</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The collection is empty. Be the first to mint!</p>
          <Link href="/" className="text-blue-600 hover:underline">
            ← Go to Mint
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      {/* Recently Mutated Banner */}
      {recentlyMutated.length > 0 && (
        <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-4 py-3 text-center mb-4">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span>
              🎨 Token{recentlyMutated.length > 1 ? 's' : ''} {recentlyMutated.join(', ')} {recentlyMutated.length > 1 ? 'were' : 'was'} recently mutated!
            </span>
            <button
              onClick={handleRefreshThumbnails}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Refresh Thumbnails
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                Spatters Collection
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {supply} tokens minted
              </p>
            </div>
            
            {/* Search and Refresh */}
            <div className="flex gap-4 items-center">
              <button
                onClick={handleRefreshThumbnails}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-600 dark:hover:border-blue-400 transition-colors"
                title="Refresh all thumbnails (force reload)"
              >
                ↻ Refresh
              </button>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="number"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Search by ID..."
                  min="1"
                  max={supply}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-40"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Go
                </button>
              </form>
            </div>
          </div>

          {/* Contract Info */}
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Contract: </span>
                <a
                  href={`${etherscanBase}/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono"
                >
                  {formatAddress(contractAddress)}
                </a>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Network: </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {chainId === 1 ? 'Ethereum Mainnet' : 'Sepolia Testnet'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Token Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredTokens.map((tokenId) => (
            <div
              key={tokenId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Thumbnail - PNG from storage */}
              <Link href={`/token/${tokenId}`}>
                <div className="aspect-[2/1] cursor-pointer overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={`${baseUrl}/api/image/${tokenId}?m=${mutationCounts[tokenId] ?? 0}&c=${contractAddress?.slice(-8) || ''}${imageVersion > 0 ? `&v=${imageVersion}` : ''}`}
                    alt={`Spatter #${tokenId}`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              </Link>

              {/* Token Info */}
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <Link href={`/token/${tokenId}`}>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 hover:text-blue-600">
                      #{tokenId}
                    </h3>
                  </Link>
                  <a
                    href={`${etherscanBase}/nft/${contractAddress}/${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ↗
                  </a>
                </div>
                
                {owners[tokenId] && (
                  <a
                    href={`${etherscanBase}/address/${owners[tokenId]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 font-mono"
                  >
                    {formatAddress(owners[tokenId])}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !searchId && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← Previous
            </button>
            
            <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Mint
          </Link>
        </div>
      </div>
    </div>
  );
}

