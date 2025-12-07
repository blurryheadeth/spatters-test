'use client';

import { useParams } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Abi } from 'viem';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

const contractAbi = SpattersABI.abi as Abi;

export default function TokenPage() {
  const params = useParams();
  const tokenId = params.id as string;
  const [chainId] = useState<number>(11155111); // Default to Sepolia
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0); // For force-reloading
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [initialMutationCount, setInitialMutationCount] = useState<number | null>(null);

  // Listen for canvas dimensions from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        setIframeHeight(event.data.height);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Force refresh function
  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
    setShowUpdateBanner(false);
    // Also refetch mutation count
    refetchMutations();
  }, []);
  
  const contractAddress = getContractAddress(chainId);
  const etherscanBase = getEtherscanBaseUrl(chainId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Check if token exists
  const { isLoading: isLoadingToken } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'tokens',
    args: [BigInt(tokenId)],
  });

  // Get owner of token
  const { data: ownerAddress, isLoading: isLoadingOwner } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
  });

  // Get total supply to check if token ID is valid
  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'totalSupply',
  });

  // Get mutation count for this token
  const { data: mutations, refetch: refetchMutations } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'getTokenMutations',
    args: [BigInt(tokenId)],
  });

  // Only count mutations when data is actually loaded (not undefined/loading)
  const mutationsLoaded = mutations !== undefined;
  const currentMutationCount = Array.isArray(mutations) ? mutations.length : 0;

  // Track initial mutation count and detect changes
  // Only set initial count AFTER data is loaded to avoid false positives
  useEffect(() => {
    if (!mutationsLoaded) return; // Wait for data to load
    
    if (initialMutationCount === null) {
      // First time we have real data - set baseline
      setInitialMutationCount(currentMutationCount);
    } else if (currentMutationCount > initialMutationCount) {
      // Mutations increased since page load - show update banner
      setShowUpdateBanner(true);
    }
  }, [currentMutationCount, initialMutationCount, mutationsLoaded]);

  // Poll for mutation changes every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchMutations();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchMutations]);

  const isValidToken = totalSupply && Number(tokenId) <= Number(totalSupply) && Number(tokenId) > 0;
  const isLoading = isLoadingToken || isLoadingOwner;

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading token #{tokenId}...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">Token Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Token #{tokenId} does not exist yet.</p>
          <Link href="/collection" className="text-blue-600 hover:underline">
            ← View Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/collection" className="text-blue-600 hover:underline">
            ← Back to Collection
          </Link>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Spatter #{tokenId}
          </h1>
          <div className="flex gap-4">
            {Number(tokenId) > 1 && (
              <Link href={`/token/${Number(tokenId) - 1}`} className="text-blue-600 hover:underline">
                ← Prev
              </Link>
            )}
            {totalSupply && Number(tokenId) < Number(totalSupply) && (
              <Link href={`/token/${Number(tokenId) + 1}`} className="text-blue-600 hover:underline">
                Next →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Update Available Banner */}
      {showUpdateBanner && (
        <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <span>🎨 Artwork has been mutated! Click to see the latest version.</span>
            <button
              onClick={handleRefresh}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Refresh Artwork
            </button>
          </div>
        </div>
      )}

      {/* Centered Artwork Display - Full height based on actual canvas */}
      <div className="w-full bg-gray-100 dark:bg-gray-950 flex justify-center py-4">
        <iframe
          key={iframeKey}
          src={`${baseUrl}/api/token/${tokenId}${iframeKey > 0 ? `?v=${iframeKey}` : ''}`}
          className="border-0 transition-all duration-300"
          style={{ 
            width: '100%',
            maxWidth: '1200px',
            height: iframeHeight ? `${iframeHeight}px` : 'calc(100vh - 180px)',
            minHeight: '400px',
          }}
          title={`Spatter #${tokenId}`}
        />
      </div>

      {/* Compact Info Bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-6 items-center justify-between">
            {/* Owner */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Owner:</span>
              {typeof ownerAddress === 'string' && (
                <a
                  href={`${etherscanBase}/address/${ownerAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono text-sm"
                >
                  {formatAddress(ownerAddress)}
                </a>
              )}
            </div>

            {/* Links */}
            <div className="flex gap-4 text-sm">
              <a
                href={`${etherscanBase}/nft/${contractAddress}/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Etherscan →
              </a>
              <a
                href={`${baseUrl}/api/metadata/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Metadata →
              </a>
            </div>

            {/* Mutation count */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Mutations: {currentMutationCount} / 200
              </span>
              <button
                onClick={handleRefresh}
                className="text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-400"
                title="Force refresh artwork"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Interaction hint */}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              💡 Click artwork to cycle through mutations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

