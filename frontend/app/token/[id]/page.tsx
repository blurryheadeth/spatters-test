'use client';

import { useParams } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Abi } from 'viem';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { wasTokenRecentlyMutated, clearMutationRecord } from '@/lib/mutation-tracker';
import Navbar from '@/components/Navbar';

const contractAbi = SpattersABI.abi as Abi;

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

export default function TokenPage() {
  const params = useParams();
  const tokenId = params.id as string;
  const [chainId] = useState<number>(11155111); // Default to Sepolia
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0); // For force-reloading
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [initialMutationCount, setInitialMutationCount] = useState<number | null>(null);
  const [showRecentMutationBanner, setShowRecentMutationBanner] = useState(false);
  const [showStaleCacheBanner, setShowStaleCacheBanner] = useState(false);
  const [cachedMutationCount, setCachedMutationCount] = useState<number | null>(null);

  // Check if this token was recently mutated (from another page in this session)
  useEffect(() => {
    if (tokenId && wasTokenRecentlyMutated(Number(tokenId))) {
      setShowRecentMutationBanner(true);
    }
  }, [tokenId]);

  // Fetch cached pixel status to compare mutation counts
  useEffect(() => {
    if (!tokenId) return;
    
    fetch(`/api/pixel-status/${tokenId}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.cachedMutationCount !== null && data.cachedMutationCount !== undefined) {
          setCachedMutationCount(data.cachedMutationCount);
        }
      })
      .catch(err => console.error('Failed to fetch pixel status:', err));
  }, [tokenId, iframeKey]); // Re-fetch when iframe is refreshed

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

  // Force refresh function - must be after refetchMutations is defined
  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
    setShowUpdateBanner(false);
    setShowRecentMutationBanner(false);
    setShowStaleCacheBanner(false);
    // Clear the mutation record so session banner doesn't show again
    clearMutationRecord(Number(tokenId));
    // Also refetch mutation count and pixel status
    refetchMutations();
  }, [tokenId, refetchMutations]);

  // Only count mutations when data is actually loaded (not undefined/loading)
  const mutationsLoaded = mutations !== undefined;
  const currentMutationCount = Array.isArray(mutations) ? mutations.length : 0;

  // Track initial mutation count and detect changes during this session
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

  // Compare on-chain mutation count with cached count to detect stale data
  // This catches cases where someone else mutated, or user visits hours/days later
  useEffect(() => {
    if (!mutationsLoaded || cachedMutationCount === null) return;
    
    // If on-chain has more mutations than cached, data is stale
    if (currentMutationCount > cachedMutationCount) {
      setShowStaleCacheBanner(true);
    } else {
      setShowStaleCacheBanner(false);
    }
  }, [currentMutationCount, cachedMutationCount, mutationsLoaded]);

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
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div 
              className="animate-spin h-12 w-12 border-4 border-t-transparent mx-auto mb-4"
              style={{ borderColor: COLORS.red, borderTopColor: 'transparent' }}
            ></div>
            <p style={{ color: COLORS.black }}>Loading token #{tokenId}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <h1 className="text-4xl font-black mb-4" style={{ color: COLORS.black }}>Token Not Found</h1>
            <p className="mb-6" style={{ color: COLORS.black }}>Token #{tokenId} does not exist yet.</p>
            <Link 
              href="/collection" 
              className="font-bold hover:opacity-70"
              style={{ color: COLORS.blue }}
            >
              ← View Collection
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <Navbar />

      {/* Token Navigation */}
      <div 
        className="border-b-2 px-4 py-3"
        style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link 
            href="/collection" 
            className="font-medium hover:opacity-70"
            style={{ color: COLORS.black }}
          >
            ← Back to Collection
          </Link>
          <h1 className="text-xl font-black" style={{ color: COLORS.black }}>
            Spatter #{tokenId}
          </h1>
          <div className="flex gap-4">
            {Number(tokenId) > 1 && (
              <Link 
                href={`/token/${Number(tokenId) - 1}`} 
                className="font-medium hover:opacity-70"
                style={{ color: COLORS.blue }}
              >
                ← Prev
              </Link>
            )}
            {totalSupply && Number(tokenId) < Number(totalSupply) && (
              <Link 
                href={`/token/${Number(tokenId) + 1}`} 
                className="font-medium hover:opacity-70"
                style={{ color: COLORS.blue }}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Update Available Banner - shows for recent mutations, detected changes, or stale cache */}
      {(showUpdateBanner || showRecentMutationBanner || showStaleCacheBanner) && (
        <div 
          className="px-4 py-3 text-center border-b-2"
          style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
        >
          <div className="flex items-center justify-center gap-3">
            <span className="font-medium">
              🎨 {showStaleCacheBanner 
                ? `Artwork has been updated! (${currentMutationCount} mutation${currentMutationCount !== 1 ? 's' : ''} on-chain, cached version has ${cachedMutationCount})`
                : showRecentMutationBanner 
                  ? 'This artwork was recently mutated!' 
                  : 'Artwork has been mutated!'
              } Click to see the latest version.
            </span>
            <button
              onClick={handleRefresh}
              className="px-4 py-1 text-sm font-bold border-2 hover:opacity-70 transition-opacity"
              style={{ backgroundColor: COLORS.black, borderColor: COLORS.black, color: COLORS.white }}
            >
              Refresh Artwork
            </button>
          </div>
        </div>
      )}

      {/* Centered Artwork Display - Full height based on actual canvas */}
      <div className="w-full flex justify-center py-4" style={{ backgroundColor: COLORS.white }}>
        {!mutationsLoaded ? (
          <div className="flex items-center justify-center" style={{ width: '100%', maxWidth: '1200px', minHeight: '400px' }}>
            <div className="text-center">
              <div 
                className="animate-spin h-8 w-8 border-4 border-t-transparent mx-auto mb-2"
                style={{ borderColor: COLORS.red, borderTopColor: 'transparent' }}
              ></div>
              <p className="text-sm" style={{ color: COLORS.black }}>Loading artwork...</p>
            </div>
          </div>
        ) : (
          <iframe
            key={`${iframeKey}-${currentMutationCount}`}
            src={`${baseUrl}/api/token/${tokenId}?m=${currentMutationCount}&c=${contractAddress?.slice(-8) || ''}${iframeKey > 0 ? `&v=${iframeKey}` : ''}`}
            className="border-0 transition-all duration-300"
            scrolling="no"
            style={{ 
              width: '100%',
              maxWidth: '1200px',
              height: iframeHeight ? `${iframeHeight}px` : 'calc(100vh - 240px)',
              minHeight: '400px',
              overflow: 'hidden',
            }}
            title={`Spatter #${tokenId}`}
          />
        )}
      </div>

      {/* Compact Info Bar */}
      <div 
        className="border-t-2 px-4 py-4"
        style={{ borderColor: COLORS.black, backgroundColor: COLORS.white }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-6 items-center justify-between">
            {/* Owner */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: COLORS.black }}>Owner:</span>
              {typeof ownerAddress === 'string' && (
                <a
                  href={`${etherscanBase}/address/${ownerAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70 font-mono text-sm"
                  style={{ color: COLORS.blue }}
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
                className="hover:opacity-70 font-medium"
                style={{ color: COLORS.blue }}
              >
                Etherscan →
              </a>
            </div>

            {/* Mutation count */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: COLORS.black }}>
                Mutations: {currentMutationCount}
              </span>
              <button
                onClick={handleRefresh}
                className="text-xs font-medium hover:opacity-70"
                style={{ color: COLORS.blue }}
                title="Force refresh artwork"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Interaction hint */}
            <span className="text-sm" style={{ color: COLORS.black, opacity: 0.7 }}>
              💡 Click artwork to cycle through mutations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
