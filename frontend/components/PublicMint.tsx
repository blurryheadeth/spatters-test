'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

export default function PublicMint() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewSeeds, setPreviewSeeds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [hasTriggeredGeneration, setHasTriggeredGeneration] = useState(false);
  
  // Dynamic iframe heights based on canvas dimensions from postMessage
  const [iframeHeights, setIframeHeights] = useState<{ [key: string]: number }>({});
  
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Read current mint price
  const { data: mintPrice, refetch: refetchPrice } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getCurrentPrice',
  });

  // Read total supply
  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'totalSupply',
  });

  // Read max supply
  const { data: maxSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'MAX_SUPPLY',
  });

  // Read owner reserve
  const { data: ownerReserve } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'OWNER_RESERVE',
  });

  // Read pending request for current user
  const { data: pendingRequest, refetch: refetchPendingRequest } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getPendingRequest',
    args: [address],
  });

  // Check if any mint selection is in progress (global block)
  const { data: mintSelectionInProgress, refetch: refetchMintStatus } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'isMintSelectionInProgress',
  });

  // Get who has the active mint request
  const { data: activeMintRequester } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'activeMintRequester',
  });

  // Get when the active mint request was made
  const { data: activeMintRequestTime } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'activeMintRequestTime',
  });

  // Check last global mint time for cooldown
  const { data: lastGlobalMintTime } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'lastGlobalMintTime',
  });

  // Request mint transaction
  const { 
    data: requestHash, 
    writeContract: writeRequestMint, 
    isPending: isRequestPending,
    reset: resetRequest
  } = useWriteContract();
  
  const { isLoading: isRequestConfirming, isSuccess: isRequestConfirmed } = 
    useWaitForTransactionReceipt({ hash: requestHash });

  // Complete mint transaction
  const { 
    data: completeHash, 
    writeContract: writeCompleteMint, 
    isPending: isCompletePending,
    reset: resetComplete
  } = useWriteContract();
  
  const { isLoading: isCompleteConfirming, isSuccess: isCompleteConfirmed } = 
    useWaitForTransactionReceipt({ hash: completeHash });

  // Check if current user is the one with the pending mint
  const isCurrentUserPending = activeMintRequester && address && 
    (activeMintRequester as string).toLowerCase() === address.toLowerCase();

  // Calculate remaining time for pending selection
  const getRemainingTime = (): string => {
    if (!activeMintRequestTime) return '';
    const requestTime = Number(activeMintRequestTime);
    if (requestTime === 0) return '';
    
    const expirationTime = requestTime + (55 * 60); // 55 minutes
    const now = Math.floor(Date.now() / 1000);
    const remaining = expirationTime - now;
    
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  // Calculate cooldown remaining
  const getCooldownRemaining = (): string => {
    if (!lastGlobalMintTime) return '';
    const lastMint = Number(lastGlobalMintTime);
    if (lastMint === 0) return '';
    
    const cooldownEnd = lastMint + (24 * 60 * 60); // 24 hours
    const now = Math.floor(Date.now() / 1000);
    const remaining = cooldownEnd - now;
    
    if (remaining <= 0) return '';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Helper to check if a pending request is still within the 55-minute window
  const isRequestStillValid = (timestamp: bigint): boolean => {
    const requestTime = Number(timestamp);
    if (requestTime === 0) return false;
    const expirationTime = requestTime + (55 * 60); // 55 minutes
    const now = Math.floor(Date.now() / 1000);
    return now < expirationTime;
  };

  // Track if user's pending request is expired
  const [isRequestExpired, setIsRequestExpired] = useState(false);

  // Check for existing pending request on page load and auto-resume
  useEffect(() => {
    if (pendingRequest && address) {
      const request = pendingRequest as { seeds: string[]; timestamp: bigint; completed: boolean };
      // If user has an uncompleted pending request with seeds
      if (request.seeds && request.seeds.length === 3 && !request.completed && request.timestamp > BigInt(0)) {
        // Check if seeds are valid (not all zeros)
        const hasValidSeeds = request.seeds.some(s => s !== '0x0000000000000000000000000000000000000000000000000000000000000000');
        if (hasValidSeeds) {
          // Check if the request is still within the time window
          if (isRequestStillValid(request.timestamp)) {
            setPreviewSeeds(request.seeds);
            setIsRequestExpired(false);
          } else {
            // Request has expired
            setIsRequestExpired(true);
            setPreviewSeeds([]); // Clear previews
          }
        }
      }
    }
  }, [pendingRequest, address]);

  // Handle request confirmation - extract seeds from pending request
  useEffect(() => {
    if (isRequestConfirmed) {
      refetchPendingRequest().then(({ data }) => {
        if (data) {
          const request = data as { seeds: string[]; timestamp: bigint; completed: boolean };
          if (request.seeds && request.seeds.length === 3) {
            setPreviewSeeds(request.seeds);
          }
        }
      });
    }
  }, [isRequestConfirmed, refetchPendingRequest]);

  // Listen for canvas dimensions from preview iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        const { height } = event.data;
        // Find which iframe sent this message by checking the source
        const iframes = document.querySelectorAll('iframe[data-preview-seed]');
        iframes.forEach((iframe) => {
          if ((iframe as HTMLIFrameElement).contentWindow === event.source) {
            const seed = iframe.getAttribute('data-preview-seed');
            if (seed) {
              setIframeHeights(prev => ({ ...prev, [seed]: height }));
            }
          }
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle completion confirmation
  useEffect(() => {
    if (isCompleteConfirmed && !hasTriggeredGeneration) {
      setHasTriggeredGeneration(true);
      
      // Calculate new token ID
      const newTokenId = Number(totalSupply) + 1;
      
      // Refetch contract state to clear the "selection in progress" status
      refetchMintStatus();
      refetchPendingRequest();
      
      // Trigger pixel generation in background
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newTokenId, event: 'token-minted' }),
      }).catch(console.error);
      
      // Redirect to the new token's page
      setTimeout(() => {
        router.push(`/token/${newTokenId}`);
      }, 1500);
    }
  }, [isCompleteConfirmed, totalSupply, router, hasTriggeredGeneration, refetchMintStatus, refetchPendingRequest]);

  // Handle request mint
  const handleRequestMint = async () => {
    if (!mintPrice || !address) return;
    setError('');
    
    try {
      await writeRequestMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'requestMint',
        value: mintPrice as bigint,
      });
    } catch (err: any) {
      setError(err.message || 'Request failed');
    }
  };

  // Handle complete mint
  const handleCompleteMint = async () => {
    if (selectedIndex === null) {
      setError('Please select an option');
      return;
    }
    
    try {
      await writeCompleteMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'completeMint',
        args: [selectedIndex],
      });
    } catch (err: any) {
      setError(err.message || 'Mint failed');
    }
  };

  // Reset form
  const resetForm = () => {
    setPreviewSeeds([]);
    setSelectedIndex(null);
    setError('');
    setHasTriggeredGeneration(false);
    setIsRequestExpired(false);
    resetRequest();
    resetComplete();
    // Refetch contract state to get latest status
    refetchMintStatus();
    refetchPendingRequest();
  };

  if (!address) {
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-lg">Please connect your wallet to mint</p>
      </div>
    );
  }

  const supply = Number(totalSupply || 0);
  const reserve = Number(ownerReserve || 25);
  const max = Number(maxSupply || 999);
  const cooldownRemaining = getCooldownRemaining();

  // Check if public minting is available (after owner reserve)
  if (supply < reserve) {
    return (
      <div className="text-center p-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
        <p className="text-lg text-yellow-800 dark:text-yellow-200">
          Public minting not yet available
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
          {reserve - supply} owner reserve tokens remaining before public mint opens
        </p>
      </div>
    );
  }

  // Check if max supply reached
  if (supply >= max) {
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-lg">All tokens have been minted!</p>
      </div>
    );
  }

  // Show blocked message if someone else has a pending selection
  if (mintSelectionInProgress && !isCurrentUserPending && previewSeeds.length === 0) {
    const remainingTime = getRemainingTime();
    return (
      <div className="space-y-6">
        <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-6 shadow-lg border border-orange-300 dark:border-orange-700">
          <h2 className="text-2xl font-bold mb-4 text-orange-800 dark:text-orange-200">
            ⏳ Minting Temporarily Blocked
          </h2>
          <div className="space-y-4">
            <p className="text-orange-700 dark:text-orange-300">
              Another user is currently selecting from 3 preview options. 
              Minting is blocked until they complete their selection or the 55-minute window expires.
            </p>
            <div className="bg-orange-200 dark:bg-orange-800/50 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Active requester:</strong>{' '}
                <span className="font-mono text-xs">
                  {(activeMintRequester as string)?.slice(0, 6)}...{(activeMintRequester as string)?.slice(-4)}
                </span>
              </p>
              {remainingTime && remainingTime !== 'Expired' && (
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-2">
                  <strong>Time remaining:</strong> ~{remainingTime}
                </p>
              )}
              {remainingTime === 'Expired' && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  <strong>Status:</strong> Selection window expired - minting will be available soon
                </p>
              )}
            </div>
            <button
              onClick={() => refetchMintStatus()}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show cooldown message
  if (cooldownRemaining && previewSeeds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-6 shadow-lg border border-blue-300 dark:border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-800 dark:text-blue-200">
            ⏰ Cooldown Active
          </h2>
          <div className="space-y-4">
            <p className="text-blue-700 dark:text-blue-300">
              A token was recently minted. Public minting has a 24-hour cooldown between mints.
            </p>
            <div className="bg-blue-200 dark:bg-blue-800/50 rounded-lg p-4">
              <p className="text-lg text-blue-800 dark:text-blue-200 text-center">
                <strong>Time until next mint:</strong> ~{cooldownRemaining}
              </p>
            </div>
            <button
              onClick={() => refetchMintStatus()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show preview selection (3 options stacked)
  if (previewSeeds.length === 3) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* Sticky Header with Navigation */}
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Cancel
            </button>
            
            {/* Jump to buttons */}
            <div className="flex gap-2">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedIndex(index);
                    document.getElementById(`preview-${index}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedIndex === index
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Option {index + 1}
                  {selectedIndex === index && ' ✓'}
                </button>
              ))}
            </div>

            {/* Mint Button */}
            <button
              onClick={handleCompleteMint}
              disabled={selectedIndex === null || isCompletePending || isCompleteConfirming}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
            >
              {isCompletePending || isCompleteConfirming 
                ? 'Minting...' 
                : selectedIndex !== null 
                  ? `✓ Mint Option ${selectedIndex + 1}`
                  : 'Select Below'
              }
            </button>
          </div>

          {error && (
            <div className="max-w-7xl mx-auto mt-2 p-2 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-200 text-center text-sm">{error}</p>
            </div>
          )}

          {isCompleteConfirmed && (
            <div className="max-w-7xl mx-auto mt-2 p-2 bg-green-900/50 border border-green-700 rounded-lg">
              <p className="text-green-200 text-center font-semibold">
                ✅ Token minted successfully! Redirecting...
              </p>
            </div>
          )}
        </div>

        {/* All 3 Artworks Stacked - All load simultaneously */}
        <div className="flex-1 overflow-auto bg-black">
          {previewSeeds.map((seed, index) => {
            const previewUrl = `${baseUrl}/api/preview?seed=${seed}`;
            
            return (
              <div 
                key={index} 
                id={`preview-${index}`}
                className="border-b-4 border-gray-700 last:border-b-0"
              >
                {/* Option Header - Clickable to select */}
                <div 
                  className={`sticky top-0 z-5 py-3 px-6 flex justify-between items-center cursor-pointer transition-colors ${
                    selectedIndex === index 
                      ? 'bg-green-800' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <h2 className="text-xl font-bold text-white">
                    Option {index + 1}
                    {selectedIndex === index && (
                      <span className="ml-3 text-green-400">✓ Selected</span>
                    )}
                  </h2>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(index);
                    }}
                    className={`px-4 py-1 rounded transition-colors ${
                      selectedIndex === index
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 hover:bg-green-600 text-white'
                    }`}
                  >
                    {selectedIndex === index ? 'Selected' : 'Select This'}
                  </button>
                </div>
                
                {/* Artwork iframe - centered, dynamic height based on canvas */}
                <div className="flex justify-center bg-black">
                  <iframe
                    src={previewUrl}
                    data-preview-seed={seed}
                    className="w-full max-w-[1200px] border-0 transition-all duration-300"
                    style={{ height: iframeHeights[seed] ? `${iframeHeights[seed]}px` : '2400px' }}
                    title={`Preview Option ${index + 1}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Initial state - request mint
  return (
    <div className="space-y-6">
      {/* Show expired request warning */}
      {isRequestExpired && (
        <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 border border-red-300 dark:border-red-700">
          <h3 className="font-bold text-red-800 dark:text-red-200 mb-2">
            ⏰ Previous Selection Expired
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm mb-2">
            Your previous 3-option preview has expired (55-minute window passed). 
            Unfortunately, your payment for that request cannot be recovered.
          </p>
          <p className="text-red-600 dark:text-red-400 text-xs">
            Please generate new options to mint. We recommend completing your selection promptly next time.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Public Mint</h2>
        <div className="space-y-2 mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            Minted: {supply} / {max}
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Current Price: {mintPrice ? formatEther(mintPrice as bigint) : '0'} ETH
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How it works:</h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>Pay the mint price to generate 3 random artwork options</li>
            <li>Preview all 3 options and choose your favorite</li>
            <li>Confirm your selection to mint your chosen artwork</li>
          </ol>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            You have 55 minutes to make your selection. Seeds are generated on-chain.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg mb-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handleRequestMint}
          disabled={isRequestPending || isRequestConfirming || !mintPrice}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          {isRequestPending || isRequestConfirming 
            ? 'Generating Options...' 
            : `Generate 3 Options (${mintPrice ? formatEther(mintPrice as bigint) : '0'} ETH)`}
        </button>
      </div>
    </div>
  );
}
