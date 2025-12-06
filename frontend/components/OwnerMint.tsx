'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

const DEFAULT_COLORS = ['#fc1a4a', '#75d494', '#2587c3', '#f2c945', '#000000', '#FFFFFF'];
const MAX_SAFE_INTEGER = 9007199254740991; // JavaScript's Number.MAX_SAFE_INTEGER (2^53 - 1)

type MintMode = 'choose' | 'direct' | 'preview';

/**
 * Convert a JavaScript integer seed to bytes32 format for contract storage.
 * 
 * The renderer's hexToSeed() reads the first 16 hex digits (64 bits) of the bytes32.
 * To recover the exact original integer:
 * 1. LEFT-pad the hex to 16 digits (so hexToSeed reads the full value)
 * 2. RIGHT-pad to 64 digits total (to make valid bytes32)
 * 
 * Example: 1763114204158 → "0x0000019a8c8c77fe000000000000000000000000000000000000000000000000"
 *          hexToSeed reads "0x0000019a8c8c77fe" → parseInt → 1763114204158 ✓
 */
function integerToBytes32(seed: number | bigint): string {
  const hex = BigInt(seed).toString(16);
  // LEFT-pad to 16 hex digits (what hexToSeed reads)
  const leftPadded = hex.padStart(16, '0');
  // RIGHT-pad to 64 hex digits total (valid bytes32)
  const fullPadded = leftPadded.padEnd(64, '0');
  return '0x' + fullPadded;
}

/**
 * Validate that a seed integer is within JavaScript's safe integer range.
 */
function isValidSeedInteger(value: string): boolean {
  try {
    const num = BigInt(value);
    return num >= BigInt(0) && num <= BigInt(MAX_SAFE_INTEGER);
  } catch {
    return false;
  }
}

export default function OwnerMint() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const [recipient, setRecipient] = useState('');
  const [useCustomPalette, setUseCustomPalette] = useState(false);
  const [customPalette, setCustomPalette] = useState<string[]>(DEFAULT_COLORS);
  const [customSeed, setCustomSeed] = useState('');
  const [error, setError] = useState('');
  const [mintMode, setMintMode] = useState<MintMode>('choose');
  
  // For 3-option preview flow
  const [previewSeeds, setPreviewSeeds] = useState<string[]>([]);
  const [selectedSeedIndex, setSelectedSeedIndex] = useState<number | null>(null);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
  
  // Track if we've already triggered generation (prevent double triggers)
  const [hasTriggeredGeneration, setHasTriggeredGeneration] = useState(false);
  
  // Dynamic iframe heights based on canvas dimensions from postMessage
  const [iframeHeights, setIframeHeights] = useState<{ [key: string]: number }>({});
  
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Read owner address
  const { data: ownerAddress } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'owner',
  });

  // Read total supply
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'totalSupply',
  });

  // Read owner reserve
  const { data: ownerReserve } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'OWNER_RESERVE',
  });

  // Read max supply
  const { data: maxSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'MAX_SUPPLY',
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

  // Request owner mint transaction (3-option flow)
  const { 
    data: requestHash, 
    writeContract: writeRequestMint, 
    isPending: isRequestPending,
    reset: resetRequest 
  } = useWriteContract();
  
  const { isLoading: isRequestConfirming, isSuccess: isRequestConfirmed } = 
    useWaitForTransactionReceipt({ hash: requestHash });

  // Complete owner mint transaction (3-option flow)
  const { 
    data: completeHash, 
    writeContract: writeCompleteMint, 
    isPending: isCompletePending,
    reset: resetComplete 
  } = useWriteContract();
  
  const { isLoading: isCompleteConfirming, isSuccess: isCompleteConfirmed } = 
    useWaitForTransactionReceipt({ hash: completeHash });

  // Direct owner mint transaction (with custom seed)
  const { 
    data: directHash, 
    writeContract: writeDirectMint, 
    isPending: isDirectPending,
    reset: resetDirect 
  } = useWriteContract();
  
  const { isLoading: isDirectConfirming, isSuccess: isDirectConfirmed } = 
    useWaitForTransactionReceipt({ hash: directHash });

  // Check if connected wallet is owner
  const isOwner = address && ownerAddress && 
    address.toLowerCase() === (ownerAddress as string).toLowerCase();

  // Set recipient to owner by default
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address, recipient]);

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
            setMintMode('preview');
            setIsRequestExpired(false);
          } else {
            // Request has expired - show expired message
            setIsRequestExpired(true);
            setMintMode('choose'); // Go back to choose mode
          }
        }
      }
    }
  }, [pendingRequest, address]);

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

  // Handle request confirmation - extract seeds from pending request
  useEffect(() => {
    if (isRequestConfirmed) {
      refetchPendingRequest().then(({ data }) => {
        if (data) {
          const request = data as { seeds: string[]; timestamp: bigint; completed: boolean };
          if (request.seeds && request.seeds.length === 3) {
            setPreviewSeeds(request.seeds);
            setIsLoadingPreviews(false);
          }
        }
      });
    }
  }, [isRequestConfirmed, refetchPendingRequest]);

  // Handle completion confirmation
  useEffect(() => {
    if ((isCompleteConfirmed || isDirectConfirmed) && !hasTriggeredGeneration) {
      // Mark as triggered to prevent double triggers
      setHasTriggeredGeneration(true);
      
      // Calculate new token ID before refetch
      const newTokenId = Number(totalSupply) + 1;
      
      // Refetch contract state to clear the "selection in progress" status
      refetchMintStatus();
      refetchPendingRequest();
      refetchSupply();
      
      // Trigger pixel generation in background
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newTokenId, event: 'token-minted' }),
      }).catch(console.error);
      
      // Redirect to the new token's page after a short delay
      setTimeout(() => {
        router.push(`/token/${newTokenId}`);
      }, 1500);
    }
  }, [isCompleteConfirmed, isDirectConfirmed, totalSupply, router, hasTriggeredGeneration, refetchMintStatus, refetchPendingRequest, refetchSupply]);

  // Listen for canvas dimensions from preview iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        const { width, height } = event.data;
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

  // Validate hex color
  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  // Validate seed as integer (within JavaScript safe range)
  const isValidSeed = (value: string): boolean => {
    if (!value || value.trim() === '') return false;
    return isValidSeedInteger(value.trim());
  };

  // Handle palette color change
  const handleColorChange = (index: number, value: string) => {
    const newPalette = [...customPalette];
    newPalette[index] = value;
    setCustomPalette(newPalette);
    
    if (newPalette.every(isValidHexColor)) {
      setError('');
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setMintMode('choose');
    setRecipient(address || '');
    setUseCustomPalette(false);
    setCustomPalette(DEFAULT_COLORS);
    setCustomSeed('');
    setPreviewSeeds([]);
    setSelectedSeedIndex(null);
    setIsLoadingPreviews(false);
    setHasTriggeredGeneration(false);
    setIsRequestExpired(false);
    setError('');
    resetRequest();
    resetComplete();
    resetDirect();
    // Refetch contract state to get latest status
    refetchMintStatus();
    refetchPendingRequest();
    refetchSupply();
  };

  // Validate common inputs
  const validateInputs = (): boolean => {
    setError('');
    
    if (!recipient || !/^0x[0-9A-Fa-f]{40}$/.test(recipient)) {
      setError('Invalid recipient address');
      return false;
    }
    
    if (useCustomPalette) {
      for (let i = 0; i < 6; i++) {
        if (!isValidHexColor(customPalette[i])) {
          setError(`Invalid hex color at position ${i + 1}: ${customPalette[i]}`);
          return false;
        }
      }
    }
    
    return true;
  };

  // Handle request owner mint (3-option flow)
  const handleRequestOwnerMint = async () => {
    if (!validateInputs()) return;
    
    const paletteParam: [string, string, string, string, string, string] = useCustomPalette
      ? customPalette as [string, string, string, string, string, string]
      : ['', '', '', '', '', ''];
    
    setIsLoadingPreviews(true);
    
    try {
      await writeRequestMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'requestOwnerMint',
        args: [recipient as `0x${string}`, paletteParam],
      });
    } catch (err: any) {
      setError(err.message || 'Request failed');
      setIsLoadingPreviews(false);
    }
  };

  // Handle complete owner mint (choose from 3 options)
  const handleCompleteOwnerMint = async () => {
    if (selectedSeedIndex === null) {
      setError('Please select an option');
      return;
    }
    
    try {
      await writeCompleteMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'completeOwnerMint',
        args: [selectedSeedIndex],
      });
    } catch (err: any) {
      setError(err.message || 'Mint failed');
    }
  };

  // Handle direct owner mint (with custom seed as integer)
  const handleDirectOwnerMint = async () => {
    if (!validateInputs()) return;
    
    if (!customSeed || !isValidSeed(customSeed)) {
      setError(`Invalid seed. Must be a positive integer up to ${MAX_SAFE_INTEGER.toLocaleString()}`);
      return;
    }
    
    // Convert integer seed to bytes32 with trailing zeros
    const seedBytes32 = integerToBytes32(BigInt(customSeed.trim()));
    
    const paletteParam: [string, string, string, string, string, string] = useCustomPalette
      ? customPalette as [string, string, string, string, string, string]
      : ['', '', '', '', '', ''];
    
    try {
      await writeDirectMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'ownerMint',
        args: [recipient as `0x${string}`, paletteParam, seedBytes32],
      });
    } catch (err: any) {
      setError(err.message || 'Mint failed');
    }
  };

  if (!address) {
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-lg">Please connect your wallet</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="text-center p-8 bg-red-100 dark:bg-red-900 rounded-lg">
        <p className="text-lg text-red-800 dark:text-red-200">
          Owner minting is restricted to contract owner only
        </p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
          Owner address: {ownerAddress as string}
        </p>
      </div>
    );
  }

  const supply = Number(totalSupply || 0);
  const reserve = Number(ownerReserve || 25);
  const max = Number(maxSupply || 999);
  const remainingReserve = Math.max(0, reserve - supply);
  const canMintAfterReserve = supply >= reserve && supply < max;

  if (remainingReserve <= 0 && !canMintAfterReserve) {
    return (
      <div className="text-center p-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
        <p className="text-lg text-yellow-800 dark:text-yellow-200">
          Max supply reached
        </p>
      </div>
    );
  }

  // Show blocked message if someone else has a pending selection
  if (mintSelectionInProgress && !isCurrentUserPending && mintMode === 'choose') {
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

  // Render mode selection
  if (mintMode === 'choose') {
    return (
      <div className="space-y-6">
        {/* Show expired request warning */}
        {isRequestExpired && (
          <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 border border-red-300 dark:border-red-700">
            <h3 className="font-bold text-red-800 dark:text-red-200 mb-2">
              ⏰ Previous Selection Expired
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Your previous 3-option preview has expired (55-minute window passed). 
              Please generate new options to continue.
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Owner Mint</h2>
          <div className="space-y-2 mb-6">
            <p className="text-gray-600 dark:text-gray-300">
              {supply < reserve 
                ? `Owner Reserve Remaining: ${remainingReserve} / ${reserve}`
                : `Public Supply: ${supply - reserve} / ${max - reserve}`
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose your minting method:
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setMintMode('preview')}
              className="p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
            >
              <h3 className="font-bold text-lg mb-2">Preview 3 Options</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate 3 random seeds and preview the artwork before choosing one to mint.
                Seeds are generated by the smart contract.
              </p>
            </button>
            
            <button
              onClick={() => setMintMode('direct')}
              className="p-6 border-2 border-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
            >
              <h3 className="font-bold text-lg mb-2">Direct Mint with Seed</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Provide a specific integer seed to mint a deterministic artwork immediately.
                The seed is stored on-chain and passed directly to spatters.js.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render direct mint mode
  if (mintMode === 'direct') {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Direct Mint with Custom Seed</h2>
            <button
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← Back
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium mb-2">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>

            {/* Custom Seed (Required) - as integer */}
            <div>
              <label className="block text-sm font-medium mb-2">Custom Seed (integer) *</label>
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="601234567890123512"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a positive integer up to {MAX_SAFE_INTEGER.toLocaleString()}
              </p>
              {customSeed && !isValidSeed(customSeed) && (
                <p className="text-xs text-red-600 mt-1">
                  Invalid seed. Must be a positive integer within safe range.
                </p>
              )}
            </div>

            {/* Custom Palette Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useCustomPalette"
                checked={useCustomPalette}
                onChange={(e) => setUseCustomPalette(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="useCustomPalette" className="text-sm font-medium">
                Use Custom Palette
              </label>
            </div>

            {/* Palette Inputs */}
            {useCustomPalette && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {customPalette.map((color, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm">Color {index + 1}</label>
                    <div className="flex space-x-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={handleDirectOwnerMint}
              disabled={isDirectPending || isDirectConfirming || !recipient || !customSeed}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isDirectPending || isDirectConfirming ? 'Minting...' : 'Mint Token'}
            </button>

            {isDirectConfirmed && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                <p className="text-green-800 dark:text-green-200 font-semibold">
                  ✅ Token minted successfully!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render preview mode (3-option flow)
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Preview 3 Options</h2>
          <button
            onClick={resetForm}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← Back
          </button>
        </div>

        {/* Step 1: Configure and Request */}
        {previewSeeds.length === 0 && (
          <div className="space-y-6">
            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium mb-2">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>

            {/* Custom Palette Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useCustomPalettePreview"
                checked={useCustomPalette}
                onChange={(e) => setUseCustomPalette(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="useCustomPalettePreview" className="text-sm font-medium">
                Use Custom Palette
              </label>
            </div>

            {/* Palette Inputs */}
            {useCustomPalette && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {customPalette.map((color, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm">Color {index + 1}</label>
                    <div className="flex space-x-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={handleRequestOwnerMint}
              disabled={isRequestPending || isRequestConfirming || isLoadingPreviews || !recipient}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isRequestPending || isRequestConfirming ? 'Generating Seeds...' : 
               isLoadingPreviews ? 'Loading Previews...' : 'Generate 3 Previews'}
            </button>
          </div>
        )}

        {/* Step 2: Show all 3 previews stacked - All load simultaneously */}
        {previewSeeds.length === 3 && (
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
                        setSelectedSeedIndex(index);
                        document.getElementById(`preview-${index}`)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedSeedIndex === index
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Option {index + 1}
                      {selectedSeedIndex === index && ' ✓'}
                    </button>
                  ))}
                </div>

                {/* Mint Button */}
                <button
                  onClick={handleCompleteOwnerMint}
                  disabled={selectedSeedIndex === null || isCompletePending || isCompleteConfirming}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                >
                  {isCompletePending || isCompleteConfirming 
                    ? 'Minting...' 
                    : selectedSeedIndex !== null 
                      ? `✓ Mint Option ${selectedSeedIndex + 1}`
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
                const paletteQuery = useCustomPalette ? `&palette=${customPalette.join(',')}` : '';
                const previewUrl = `${baseUrl}/api/preview?seed=${seed}${paletteQuery}`;
                
                return (
                  <div 
                    key={index} 
                    id={`preview-${index}`}
                    className="border-b-4 border-gray-700 last:border-b-0"
                  >
                    {/* Option Header - Clickable to select */}
                    <div 
                      className={`sticky top-0 z-5 py-3 px-6 flex justify-between items-center cursor-pointer transition-colors ${
                        selectedSeedIndex === index 
                          ? 'bg-green-800' 
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                      onClick={() => setSelectedSeedIndex(index)}
                    >
                      <h2 className="text-xl font-bold text-white">
                        Option {index + 1}
                        {selectedSeedIndex === index && (
                          <span className="ml-3 text-green-400">✓ Selected</span>
                        )}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSeedIndex(index);
                        }}
                        className={`px-4 py-1 rounded transition-colors ${
                          selectedSeedIndex === index
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 hover:bg-green-600 text-white'
                        }`}
                      >
                        {selectedSeedIndex === index ? 'Selected' : 'Select This'}
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
        )}
      </div>
    </div>
  );
}
