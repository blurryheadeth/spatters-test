'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import Link from 'next/link';
import { Abi } from 'viem';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { getRecentlyMutatedTokenIds, clearAllMutationRecords } from '@/lib/mutation-tracker';
import Navbar from '@/components/Navbar';

const contractAbi = SpattersABI.abi as Abi;

const TOKENS_PER_PAGE = 24;

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
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div 
              className="animate-spin h-12 w-12 border-4 border-t-transparent mx-auto mb-4" 
              style={{ borderColor: COLORS.red, borderTopColor: 'transparent' }}
            ></div>
            <p style={{ color: COLORS.black }}>Loading collection...</p>
          </div>
        </div>
      </div>
    );
  }

  if (supply === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <h1 className="text-4xl font-black mb-4" style={{ color: COLORS.black }}>No Tokens Yet</h1>
            <p className="mb-6" style={{ color: COLORS.black }}>The collection is empty. Be the first to mint!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <Navbar />

      {/* Recently Mutated Banner */}
      {recentlyMutated.length > 0 && (
        <div 
          className="px-4 py-3 text-center border-b-2" 
          style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
        >
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="font-medium">
              🎨 Token{recentlyMutated.length > 1 ? 's' : ''} {recentlyMutated.join(', ')} {recentlyMutated.length > 1 ? 'were' : 'was'} recently mutated!
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black" style={{ color: COLORS.black }}>
                Spatters Collection
              </h1>
              <p className="mt-1" style={{ color: COLORS.black }}>
                {supply} tokens minted
              </p>
            </div>
            
            {/* Search and Refresh */}
            <div className="flex gap-4 items-center">
              <button
                onClick={handleRefreshThumbnails}
                className="px-3 py-2 text-sm font-medium border-2 hover:opacity-70 transition-opacity"
                style={{ backgroundColor: COLORS.background, borderColor: COLORS.black, color: COLORS.black }}
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
                  className="px-4 py-2 border-2 w-40"
                  style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}
                />
                <button
                  type="submit"
                  className="px-4 py-2 font-bold border-2 hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: COLORS.blue, borderColor: COLORS.black, color: COLORS.white }}
                >
                  Go
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Token Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredTokens.map((tokenId) => (
            <div
              key={tokenId}
              className="border-2 overflow-hidden hover:opacity-90 transition-opacity"
              style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
            >
              {/* Thumbnail - PNG from storage */}
              <Link href={`/token/${tokenId}`}>
                <div className="aspect-[4/3] cursor-pointer overflow-hidden" style={{ backgroundColor: COLORS.background }}>
                  <img
                    src={`${baseUrl}/api/image/${tokenId}?m=${mutationCounts[tokenId] ?? 0}&c=${contractAddress?.slice(-8) || ''}${imageVersion > 0 ? `&v=${imageVersion}` : ''}`}
                    alt={`Spatter #${tokenId}`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              </Link>

              {/* Token Info */}
              <div className="p-3 border-t-2" style={{ borderColor: COLORS.black }}>
                <div className="flex justify-between items-start">
                  <Link href={`/token/${tokenId}`}>
                    <h3 className="font-bold hover:opacity-70" style={{ color: COLORS.black }}>
                      #{tokenId}
                    </h3>
                  </Link>
                  <a
                    href={`${etherscanBase}/nft/${contractAddress}/${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold hover:opacity-70"
                    style={{ color: COLORS.blue }}
                  >
                    ↗
                  </a>
                </div>
                
                {owners[tokenId] && (
                  <a
                    href={`${etherscanBase}/address/${owners[tokenId]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:opacity-70 font-mono"
                    style={{ color: COLORS.black, opacity: 0.7 }}
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
          <div className="mt-8 flex justify-center gap-2 items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 font-bold border-2 hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ backgroundColor: COLORS.background, borderColor: COLORS.black, color: COLORS.black }}
            >
              ← Previous
            </button>
            
            <span className="px-4 py-2 font-medium" style={{ color: COLORS.black }}>
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 font-bold border-2 hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ backgroundColor: COLORS.background, borderColor: COLORS.black, color: COLORS.black }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
