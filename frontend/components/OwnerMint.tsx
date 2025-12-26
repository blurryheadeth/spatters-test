'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { Abi } from 'viem';

const DEFAULT_COLORS = ['#fc1a4a', '#75d494', '#2587c3', '#f2c945', '#000000', '#FFFFFF'];
const MAX_SEED_VALUE = 9007199254740991; // JavaScript's Number.MAX_SAFE_INTEGER (2^53 - 1)

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

/**
 * Parse a comma-separated string of hex colors into an array of 6 colors.
 * Handles formats like: "#07B0F0","#140902"... or #07B0F0,#140902...
 */
function parsePaletteString(input: string): string[] | null {
  // Remove all whitespace and quotes
  const cleaned = input.replace(/[\s"']/g, '');
  // Split by comma
  const parts = cleaned.split(',').filter(p => p.length > 0);
  
  // Validate we have exactly 6 parts
  if (parts.length !== 6) return null;
  
  // Validate each is a valid hex color
  const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
  const colors: string[] = [];
  
  for (const part of parts) {
    if (!hexRegex.test(part)) return null;
    // Ensure it starts with #
    colors.push(part.startsWith('#') ? part : '#' + part);
  }
  
  return colors;
}

type MintMode = 'choose' | 'direct' | 'preview';

/**
 * Convert a JavaScript integer seed to bytes32 format for contract storage.
 * 
 * The renderer's hexToSeed() reads the first 13 hex digits (52 bits) of the bytes32.
 * To recover the exact original integer:
 * 1. LEFT-pad the hex to 13 digits (so hexToSeed reads the full value)
 * 2. RIGHT-pad to 64 digits total (to make valid bytes32)
 * 
 * Example: 1763114204158 → "0x00019a8c8c77fe00000000000000000000000000000000000000000000000000"
 *          hexToSeed reads "00019a8c8c77fe" → parseInt → 1763114204158 ✓
 */
function integerToBytes32(seed: number | bigint): string {
  const hex = BigInt(seed).toString(16);
  // LEFT-pad to 13 hex digits (what hexToSeed reads - 52 bits, stays within MAX_SAFE_INTEGER)
  const leftPadded = hex.padStart(13, '0');
  // RIGHT-pad to 64 hex digits total (valid bytes32)
  const fullPadded = leftPadded.padEnd(64, '0');
  return '0x' + fullPadded;
}

/**
 * Validate that a seed integer is within p5.js randomSeed's 32-bit range.
 */
function isValidSeedInteger(value: string): boolean {
  try {
    const num = BigInt(value);
    return num >= BigInt(0) && num <= BigInt(MAX_SEED_VALUE);
  } catch {
    return false;
  }
}

export default function OwnerMint() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const [useCustomPalette, setUseCustomPalette] = useState(false);
  const [customPalette, setCustomPalette] = useState<string[]>(DEFAULT_COLORS);
  const [bulkPaletteInput, setBulkPaletteInput] = useState('');
  const [customSeed, setCustomSeed] = useState('');
  const [error, setError] = useState('');
  const [mintMode, setMintMode] = useState<MintMode>('choose');
  
  // For 3-option preview flow
  const [previewSeeds, setPreviewSeeds] = useState<string[]>([]);
  const [selectedSeedIndex, setSelectedSeedIndex] = useState<number | null>(null);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
  
  // Track if we've already triggered generation (prevent double triggers)
  const [hasTriggeredGeneration, setHasTriggeredGeneration] = useState(false);
  
  // Store supply BEFORE mint to calculate correct token ID (avoids race condition)
  const [supplyBeforeMint, setSupplyBeforeMint] = useState<number | null>(null);
  
  // Dynamic iframe heights based on canvas dimensions from postMessage
  const [iframeHeights, setIframeHeights] = useState<{ [key: string]: number }>({});
  
  // Sequential loading: track which previews should be loaded (starts with just index 0)
  const [loadedPreviews, setLoadedPreviews] = useState<Set<number>>(new Set([0]));
  
  // Track which previews have finished rendering (received postMessage)
  const [finishedPreviews, setFinishedPreviews] = useState<Set<number>>(new Set());
  
  // Confirmation modal for 55-minute warning
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Dynamic countdown timer for remaining mint time
  const [remainingMinutes, setRemainingMinutes] = useState<number>(55);
  
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

  // Read the global pending request (only one can exist at a time)
  const { data: pendingRequest, refetch: refetchPendingRequest } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getPendingRequest',
    args: [],  // No address param needed - single global request
  });

  // Read pending palette (single global palette, since only one mint can be active at a time)
  const pendingPaletteCalls = [0, 1, 2, 3, 4, 5].map(i => ({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi as Abi,
    functionName: 'pendingPalette' as const,
    args: [BigInt(i)] as const,
  }));

  const { data: pendingPaletteResults } = useReadContracts({
    contracts: pendingPaletteCalls,
    query: {
      enabled: !!contractAddress,
    },
  });

  // Check if any mint selection is in progress (global block)
  // Returns tuple: [active: boolean, requester: address, expiresAt: uint256]
  const { data: mintSelectionData, refetch: refetchMintStatus } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'isMintSelectionInProgress',
  });

  // Extract values from the tuple
  const mintSelectionInProgress = mintSelectionData ? (mintSelectionData as [boolean, string, bigint])[0] : false;
  const activeMintRequester = mintSelectionData ? (mintSelectionData as [boolean, string, bigint])[1] : null;
  const activeMintRequestExpiry = mintSelectionData ? (mintSelectionData as [boolean, string, bigint])[2] : BigInt(0);

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
      const request = pendingRequest as { seeds: string[]; timestamp: bigint; completed: boolean; hasCustomPalette: boolean };
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
            
            // ONLY restore custom palette if the request was made WITH a custom palette
            // (check the hasCustomPalette flag from the contract, not just if palette data exists)
            if (request.hasCustomPalette && pendingPaletteResults && pendingPaletteResults.length === 6) {
              const restoredPalette = pendingPaletteResults.map(result => 
                result.status === 'success' ? (result.result as string) : ''
              );
              // Check if the first color is non-empty
              if (restoredPalette[0] && restoredPalette[0].length > 0) {
                setCustomPalette(restoredPalette);
                setUseCustomPalette(true);
              }
            } else {
              // No custom palette for this request - reset to defaults
              setUseCustomPalette(false);
              setCustomPalette(DEFAULT_COLORS);
            }
          } else {
            // Request has expired - show expired message
            setIsRequestExpired(true);
            setMintMode('choose'); // Go back to choose mode
          }
        }
      }
    }
  }, [pendingRequest, address, pendingPaletteResults]);

  // Check if current user is the one with the pending mint
  const isCurrentUserPending = activeMintRequester && address && 
    activeMintRequester.toLowerCase() === address.toLowerCase();

  // Calculate remaining time for pending selection
  const getRemainingTime = (): string => {
    if (!activeMintRequestExpiry || activeMintRequestExpiry === BigInt(0)) return '';
    
    const expirationTime = Number(activeMintRequestExpiry);
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

  // Update remaining minutes countdown when in preview mode
  useEffect(() => {
    if (previewSeeds.length !== 3) return;
    
    // Calculate from either the global expiry or the pending request timestamp
    const getExpirationTimestamp = (): number => {
      // Use global expiry if available
      if (activeMintRequestExpiry && activeMintRequestExpiry > BigInt(0)) {
        return Number(activeMintRequestExpiry);
      }
      // Fallback to pending request timestamp + 55 minutes
      if (pendingRequest) {
        const request = pendingRequest as { timestamp: bigint };
        if (request.timestamp && request.timestamp > BigInt(0)) {
          return Number(request.timestamp) + (55 * 60);
        }
      }
      // Default: 55 minutes from now (shouldn't happen)
      return Math.floor(Date.now() / 1000) + (55 * 60);
    };
    
    const updateCountdown = () => {
      const expirationTime = getExpirationTimestamp();
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, expirationTime - now);
      const minutes = Math.ceil(remaining / 60); // Round up to show "1 minute" until truly expired
      setRemainingMinutes(minutes);
    };
    
    // Update immediately
    updateCountdown();
    
    // Update every 10 seconds for smoother UX
    const interval = setInterval(updateCountdown, 10000);
    
    return () => clearInterval(interval);
  }, [previewSeeds.length, activeMintRequestExpiry, pendingRequest]);

  // Handle completion confirmation
  useEffect(() => {
    if ((isCompleteConfirmed || isDirectConfirmed) && !hasTriggeredGeneration && supplyBeforeMint !== null) {
      // Mark as triggered to prevent double triggers
      setHasTriggeredGeneration(true);
      
      // Use the supply we captured BEFORE the transaction
      // New token ID = supplyBeforeMint + 1 (avoids race condition with stale totalSupply)
      const newTokenId = supplyBeforeMint + 1;
      
      // Refetch contract state to clear the "selection in progress" status
      refetchMintStatus();
      refetchPendingRequest();
      refetchSupply();
      
      // Trigger pixel generation in background
      console.log(`[OwnerMint] Triggering pixel generation for token ${newTokenId}`);
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newTokenId, event: 'token-minted' }),
      })
        .then(res => res.json())
        .then(data => console.log('[OwnerMint] Trigger response:', data))
        .catch(err => console.error('[OwnerMint] Trigger error:', err));
      
      // Redirect to the new token's page after a short delay
      setTimeout(() => {
        router.push(`/token/${newTokenId}`);
      }, 1500);
    }
  }, [isCompleteConfirmed, isDirectConfirmed, supplyBeforeMint, router, hasTriggeredGeneration, refetchMintStatus, refetchPendingRequest, refetchSupply]);

  // Listen for canvas dimensions from preview iframes and auto-load next preview
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        const { height } = event.data;
        // Find which iframe sent this message by checking the source
        const iframes = document.querySelectorAll('iframe[data-preview-seed]');
        iframes.forEach((iframe) => {
          if ((iframe as HTMLIFrameElement).contentWindow === event.source) {
            const seed = iframe.getAttribute('data-preview-seed');
            const previewIndex = iframe.getAttribute('data-preview-index');
            if (seed) {
              setIframeHeights(prev => ({ ...prev, [seed]: height }));
            }
            if (previewIndex !== null) {
              const index = parseInt(previewIndex, 10);
              // Mark this preview as finished
              setFinishedPreviews(prev => new Set([...prev, index]));
              // Auto-load the next preview if it exists
              if (index < 2) {
                setLoadedPreviews(prev => new Set([...prev, index + 1]));
              }
            }
          }
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Hide body scrollbar when preview modal is open (prevents double scrollbar)
  useEffect(() => {
    if (previewSeeds.length === 3) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewSeeds.length]);

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

  // Handle bulk palette populate
  const handlePopulatePalette = () => {
    const parsed = parsePaletteString(bulkPaletteInput);
    if (parsed) {
      setCustomPalette(parsed);
      setError('');
    } else {
      setError('Invalid palette format. Please enter exactly 6 hex colors (e.g., "#07B0F0","#140902","#F7F2D7","#EDC5D4","#9EE4F7","#E25252")');
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setMintMode('choose');
    setUseCustomPalette(false);
    setCustomPalette(DEFAULT_COLORS);
    setBulkPaletteInput('');
    setCustomSeed('');
    setPreviewSeeds([]);
    setSelectedSeedIndex(null);
    setIsLoadingPreviews(false);
    setHasTriggeredGeneration(false);
    setIsRequestExpired(false);
    setLoadedPreviews(new Set([0])); // Reset to only first preview
    setFinishedPreviews(new Set()); // Clear finished tracking
    setIframeHeights({}); // Clear iframe heights
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
        args: [paletteParam],
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
    
    // Store current supply BEFORE transaction to avoid race condition
    setSupplyBeforeMint(Number(totalSupply));
    
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
      setError(`Invalid seed. Must be a positive integer up to ${MAX_SEED_VALUE.toLocaleString()}`);
      return;
    }
    
    // Store current supply BEFORE transaction to avoid race condition
    setSupplyBeforeMint(Number(totalSupply));
    
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
        args: [paletteParam, seedBytes32],
      });
    } catch (err: any) {
      setError(err.message || 'Mint failed');
    }
  };

  if (!address) {
    return (
      <div className="text-center p-8 border-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
        <p className="text-lg" style={{ color: COLORS.black }}>Please connect your wallet</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="text-center p-8 border-2" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
        <p className="text-lg" style={{ color: COLORS.white }}>
          Owner minting is restricted to contract owner only
        </p>
        <p className="text-sm mt-2" style={{ color: COLORS.white, opacity: 0.9 }}>
          Owner address: {ownerAddress as string}
        </p>
      </div>
    );
  }

  const supply = Number(totalSupply || 0);
  const reserve = Number(ownerReserve || 30);
  const max = Number(maxSupply || 999);
  const remainingReserve = Math.max(0, reserve - supply);
  const canMintAfterReserve = supply >= reserve && supply < max;

  if (remainingReserve <= 0 && !canMintAfterReserve) {
    return (
      <div className="text-center p-8 border-2" style={{ backgroundColor: COLORS.yellow, borderColor: COLORS.black }}>
        <p className="text-lg font-bold" style={{ color: COLORS.black }}>
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
        <div className="border-2 p-6" style={{ backgroundColor: COLORS.yellow, borderColor: COLORS.black }}>
          <h2 className="text-2xl font-black mb-4" style={{ color: COLORS.black }}>
            ⏳ Minting Temporarily Blocked
          </h2>
          <div className="space-y-4">
            <p style={{ color: COLORS.black }}>
              Another user is currently selecting from 3 preview options. 
              Minting is blocked until they complete their selection or the 55-minute window expires.
            </p>
            <div className="border-2 p-4" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
              <p className="text-sm" style={{ color: COLORS.black }}>
                <strong>Active requester:</strong>{' '}
                <span className="font-mono text-xs">
                  {(activeMintRequester as string)?.slice(0, 6)}...{(activeMintRequester as string)?.slice(-4)}
                </span>
              </p>
              {remainingTime && remainingTime !== 'Expired' && (
                <p className="text-sm mt-2" style={{ color: COLORS.black }}>
                  <strong>Time remaining:</strong> ~{remainingTime}
                </p>
              )}
              {remainingTime === 'Expired' && (
                <p className="text-sm mt-2" style={{ color: COLORS.green }}>
                  <strong>Status:</strong> Selection window expired - minting will be available soon
                </p>
              )}
            </div>
            <button
              onClick={() => refetchMintStatus()}
              className="w-full font-bold py-2 px-4 border-2 hover:opacity-70 transition-opacity"
              style={{ backgroundColor: COLORS.black, borderColor: COLORS.black, color: COLORS.white }}
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
          <div className="border-2 p-4" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
            <h3 className="font-bold mb-2" style={{ color: COLORS.white }}>
              ⏰ Previous Selection Expired
            </h3>
            <p className="text-sm" style={{ color: COLORS.white }}>
              Your previous 3-option preview has expired (55-minute window passed). 
              Please generate new options to continue.
            </p>
          </div>
        )}

        <div className="border-2 p-6" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
          <h2 className="text-2xl font-black mb-4" style={{ color: COLORS.black }}>Owner Mint</h2>
          <div className="space-y-2 mb-6">
            <p style={{ color: COLORS.black }}>
              {supply < reserve 
                ? `Owner Reserve Remaining: ${remainingReserve} / ${reserve}`
                : `Public Supply: ${supply - reserve} / ${max - reserve}`
              }
            </p>
            <p className="text-sm" style={{ color: COLORS.black, opacity: 0.7 }}>
              Choose your minting method:
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setMintMode('preview')}
              className="p-6 border-2 hover:opacity-70 transition-opacity text-left"
              style={{ backgroundColor: COLORS.background, borderColor: COLORS.blue }}
            >
              <h3 className="font-bold text-lg mb-2" style={{ color: COLORS.blue }}>Preview 3 Options</h3>
              <p className="text-sm" style={{ color: COLORS.black }}>
                Generate 3 random seeds and preview the artwork before choosing one to mint.
                Seeds are generated by the smart contract.
              </p>
            </button>
            
            <button
              onClick={() => setMintMode('direct')}
              className="p-6 border-2 hover:opacity-70 transition-opacity text-left"
              style={{ backgroundColor: COLORS.background, borderColor: COLORS.green }}
            >
              <h3 className="font-bold text-lg mb-2" style={{ color: COLORS.green }}>Direct Mint with Seed</h3>
              <p className="text-sm" style={{ color: COLORS.black }}>
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
        <div className="border-2 p-6" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black" style={{ color: COLORS.black }}>Direct Mint with Custom Seed</h2>
            <button
              onClick={resetForm}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: COLORS.black }}
            >
              ← Back
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Custom Seed (Required) - as integer */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: COLORS.black }}>Custom Seed (integer) *</label>
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="601234567890123512"
                className="w-full px-4 py-2 border-2 font-mono text-sm"
                style={{ borderColor: COLORS.black, backgroundColor: COLORS.background, color: COLORS.black }}
              />
              <p className="text-xs mt-1" style={{ color: COLORS.black, opacity: 0.7 }}>
                Enter a positive integer up to {MAX_SEED_VALUE.toLocaleString()}
              </p>
              {customSeed && !isValidSeed(customSeed) && (
                <p className="text-xs mt-1" style={{ color: COLORS.red }}>
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
              <label htmlFor="useCustomPalette" className="text-sm font-medium" style={{ color: COLORS.black }}>
                Use Custom Palette
              </label>
            </div>

            {/* Palette Inputs */}
            {useCustomPalette && (
              <div className="space-y-4">
                {/* Bulk Paste Input */}
                <div className="border-2 p-4" style={{ backgroundColor: COLORS.background, borderColor: COLORS.black }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: COLORS.black }}>Quick Paste (6 hex colors)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={bulkPaletteInput}
                      onChange={(e) => setBulkPaletteInput(e.target.value)}
                      placeholder={'"#07B0F0","#140902","#F7F2D7","#EDC5D4","#9EE4F7","#E25252"'}
                      className="flex-1 px-3 py-2 border-2 text-sm font-mono"
                      style={{ borderColor: COLORS.black, backgroundColor: COLORS.white, color: COLORS.black }}
                    />
                    <button
                      type="button"
                      onClick={handlePopulatePalette}
                      className="px-4 py-2 font-medium border-2 hover:opacity-70 transition-opacity whitespace-nowrap"
                      style={{ backgroundColor: COLORS.blue, borderColor: COLORS.black, color: COLORS.white }}
                    >
                      Populate
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: COLORS.black, opacity: 0.7 }}>
                    Paste comma-separated hex colors to auto-fill below
                  </p>
                </div>

                {/* Individual Color Inputs */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {customPalette.map((color, index) => (
                    <div key={index} className="space-y-2">
                      <label className="block text-sm" style={{ color: COLORS.black }}>Color {index + 1}</label>
                      <div className="flex space-x-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value)}
                          className="w-12 h-10 cursor-pointer border-2"
                          style={{ borderColor: COLORS.black }}
                        />
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value)}
                          className="flex-1 px-2 py-1 border-2 text-sm"
                          style={{ borderColor: COLORS.black, color: COLORS.black }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 border-2" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
                <p style={{ color: COLORS.white }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleDirectOwnerMint}
              disabled={isDirectPending || isDirectConfirming || !customSeed}
              className="w-full font-bold py-3 px-6 border-2 hover:opacity-70 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
            >
              {isDirectPending || isDirectConfirming ? 'Minting...' : 'Mint Token'}
            </button>

            {isDirectConfirmed && (
              <div className="p-4 border-2 text-center" style={{ backgroundColor: COLORS.green, borderColor: COLORS.black }}>
                <p className="font-semibold" style={{ color: COLORS.black }}>
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
      <div className="border-2 p-6" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black" style={{ color: COLORS.black }}>Preview 3 Options</h2>
          <button
            onClick={resetForm}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: COLORS.black }}
          >
            ← Back
          </button>
        </div>

        {/* Step 1: Configure and Request */}
        {previewSeeds.length === 0 && (
          <div className="space-y-6">
            {/* Custom Palette Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useCustomPalettePreview"
                checked={useCustomPalette}
                onChange={(e) => setUseCustomPalette(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="useCustomPalettePreview" className="text-sm font-medium" style={{ color: COLORS.black }}>
                Use Custom Palette
              </label>
            </div>

            {/* Palette Inputs */}
            {useCustomPalette && (
              <div className="space-y-4">
                {/* Bulk Paste Input */}
                <div className="border-2 p-4" style={{ backgroundColor: COLORS.background, borderColor: COLORS.black }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: COLORS.black }}>Quick Paste (6 hex colors)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={bulkPaletteInput}
                      onChange={(e) => setBulkPaletteInput(e.target.value)}
                      placeholder={'"#07B0F0","#140902","#F7F2D7","#EDC5D4","#9EE4F7","#E25252"'}
                      className="flex-1 px-3 py-2 border-2 text-sm font-mono"
                      style={{ borderColor: COLORS.black, backgroundColor: COLORS.white, color: COLORS.black }}
                    />
                    <button
                      type="button"
                      onClick={handlePopulatePalette}
                      className="px-4 py-2 font-medium border-2 hover:opacity-70 transition-opacity whitespace-nowrap"
                      style={{ backgroundColor: COLORS.blue, borderColor: COLORS.black, color: COLORS.white }}
                    >
                      Populate
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: COLORS.black, opacity: 0.7 }}>
                    Paste comma-separated hex colors to auto-fill below
                  </p>
                </div>

                {/* Individual Color Inputs */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {customPalette.map((color, index) => (
                    <div key={index} className="space-y-2">
                      <label className="block text-sm" style={{ color: COLORS.black }}>Color {index + 1}</label>
                      <div className="flex space-x-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value)}
                          className="w-12 h-10 cursor-pointer border-2"
                          style={{ borderColor: COLORS.black }}
                        />
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value)}
                          className="flex-1 px-2 py-1 border-2 text-sm"
                          style={{ borderColor: COLORS.black, color: COLORS.black }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 border-2" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
                <p style={{ color: COLORS.white }}>{error}</p>
              </div>
            )}

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isRequestPending || isRequestConfirming || isLoadingPreviews}
              className="w-full font-bold py-3 px-6 transition-colors border-2"
              style={{ 
                backgroundColor: '#2587c3', 
                borderColor: '#000000',
                color: '#FFFFFF',
                opacity: (isRequestPending || isRequestConfirming || isLoadingPreviews) ? 0.5 : 1,
              }}
            >
              {isRequestPending || isRequestConfirming ? 'Generating Seeds...' : 
               isLoadingPreviews ? 'Loading Previews...' : 'Generate 3 Previews'}
            </button>
          </div>
        )}

        {/* Step 2: Show all 3 previews stacked - All load simultaneously */}
        {previewSeeds.length === 3 && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#EBE5D9' }}>
            {/* URGENT Warning Banner with Dynamic Countdown */}
            <div 
              className="flex-shrink-0 py-3 px-4 text-center border-b-2"
              style={{ backgroundColor: '#fc1a4a', color: '#FFFFFF', borderColor: '#000000' }}
            >
              <p className="font-bold">
                ⚠️ WARNING: You have <span className="underline">{remainingMinutes} minute{remainingMinutes !== 1 ? 's' : ''}</span> to select an option. If you do not choose, 
                your mint will be cancelled and the minting fee is NOT refundable. ⚠️
              </p>
              <p className="text-sm mt-1 opacity-90">
                If you encounter any website issues, you can complete your mint directly on{' '}
                <a 
                  href={`https://sepolia.etherscan.io/address/${contractAddress}#writeContract`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-70"
                >
                  Etherscan
                </a>
                {' '}by calling <code className="bg-white/20 px-1 rounded">completeOwnerMint(0, 1, or 2)</code>
              </p>
            </div>

            {/* Sticky Header with Navigation */}
            <div className="flex-shrink-0 border-b-2 px-4 py-3 sticky top-0 z-10" style={{ backgroundColor: '#EBE5D9', borderColor: '#000000' }}>
              <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                <button
                  onClick={resetForm}
                  className="font-medium hover:opacity-70 transition-opacity"
                  style={{ color: '#000000' }}
                >
                  ← Cancel
                </button>
                
                {/* Jump to buttons OR loading indicator */}
                {finishedPreviews.size < 3 ? (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: COLORS.blue, borderTopColor: 'transparent' }}></div>
                    <span className="text-sm font-medium" style={{ color: COLORS.black }}>
                      Images still loading ({finishedPreviews.size}/3)...
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {[0, 1, 2].map((index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedSeedIndex(index);
                          document.getElementById(`preview-${index}`)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-4 py-2 font-medium transition-opacity border-2 hover:opacity-70"
                        style={{
                          backgroundColor: selectedSeedIndex === index ? COLORS.green : COLORS.white,
                          borderColor: COLORS.black,
                          color: COLORS.black,
                        }}
                      >
                        Option {index + 1}
                        {selectedSeedIndex === index && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Mint Button */}
                <button
                  onClick={handleCompleteOwnerMint}
                  disabled={selectedSeedIndex === null || isCompletePending || isCompleteConfirming}
                  className="px-6 py-2 font-bold border-2 transition-opacity hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}
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
                <div className="max-w-7xl mx-auto mt-2 p-2 border-2" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
                  <p className="text-center text-sm" style={{ color: COLORS.white }}>{error}</p>
                </div>
              )}

              {isCompleteConfirmed && (
                <div className="max-w-7xl mx-auto mt-2 p-2 border-2" style={{ backgroundColor: COLORS.green, borderColor: COLORS.black }}>
                  <p className="text-center font-semibold" style={{ color: COLORS.black }}>
                    ✅ Token minted successfully! Redirecting...
                  </p>
                </div>
              )}
            </div>

            {/* All 3 Artworks Stacked - Sequential loading to prevent browser crash */}
            <div className="flex-1 overflow-auto" style={{ backgroundColor: COLORS.white }}>
              {previewSeeds.map((seed, index) => {
                // URL encode palette - # must be %23 to avoid being treated as fragment
                const paletteQuery = useCustomPalette ? `&palette=${encodeURIComponent(customPalette.join(','))}` : '';
                const previewUrl = `${baseUrl}/api/preview?seed=${seed}${paletteQuery}`;
                const isLoaded = loadedPreviews.has(index);
                const isFinished = finishedPreviews.has(index);
                
                return (
                  <div 
                    key={index} 
                    id={`preview-${index}`}
                    className="border-b-2 last:border-b-0"
                    style={{ borderColor: COLORS.black }}
                  >
                    {/* Option Header - Clickable to select */}
                    <div 
                      className="sticky top-0 z-5 py-3 px-6 flex justify-between items-center cursor-pointer transition-opacity hover:opacity-90 border-b-2"
                      style={{ 
                        backgroundColor: selectedSeedIndex === index ? COLORS.green : COLORS.background,
                        borderColor: COLORS.black,
                      }}
                      onClick={() => setSelectedSeedIndex(index)}
                    >
                      <h2 className="text-xl font-bold" style={{ color: COLORS.black }}>
                        Option {index + 1}
                        {selectedSeedIndex === index && (
                          <span className="ml-3" style={{ color: COLORS.black }}>✓ Selected</span>
                        )}
                        {isLoaded && !isFinished && (
                          <span className="ml-3 text-sm font-normal" style={{ color: COLORS.blue }}>
                            (Generating...)
                          </span>
                        )}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSeedIndex(index);
                        }}
                        className="px-4 py-1 border-2 transition-opacity hover:opacity-70"
                        style={{ 
                          backgroundColor: selectedSeedIndex === index ? COLORS.black : COLORS.white,
                          borderColor: COLORS.black,
                          color: selectedSeedIndex === index ? COLORS.white : COLORS.black,
                        }}
                      >
                        {selectedSeedIndex === index ? 'Selected' : 'Select This'}
                      </button>
                    </div>
                    
                    {/* Artwork iframe - sequential loading to prevent browser crash */}
                    <div className="flex justify-center" style={{ backgroundColor: COLORS.white }}>
                      {isLoaded ? (
                        <iframe
                          src={previewUrl}
                          data-preview-seed={seed}
                          data-preview-index={index}
                          className="w-full max-w-[1200px] border-0 transition-all duration-300"
                          scrolling="no"
                          style={{ height: iframeHeights[seed] ? `${iframeHeights[seed]}px` : '2400px', overflow: 'hidden' }}
                          title={`Preview Option ${index + 1}`}
                        />
                      ) : (
                        <div 
                          className="w-full max-w-[1200px] flex flex-col items-center justify-center py-16"
                          style={{ backgroundColor: COLORS.background, minHeight: '400px' }}
                        >
                          <div className="text-center space-y-4">
                            <p className="text-lg font-medium" style={{ color: COLORS.black }}>
                              ⏳ Waiting for Option {index} to finish...
                            </p>
                            <p className="text-sm" style={{ color: COLORS.black, opacity: 0.7 }}>
                              Previews load one at a time to prevent browser slowdown
                            </p>
                            <button
                              onClick={() => setLoadedPreviews(prev => new Set([...prev, index]))}
                              className="px-6 py-3 border-2 font-medium hover:opacity-70 transition-opacity"
                              style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}
                            >
                              Load Now (May Slow Browser)
                            </button>
                            <p className="text-xs" style={{ color: COLORS.black, opacity: 0.6 }}>
                              You can still select this option without viewing the preview
                            </p>
                            <p className="text-xs font-mono" style={{ color: COLORS.black, opacity: 0.5 }}>
                              Seed: {seed.slice(0, 18)}...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirmation Modal for 55-minute warning */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div 
              className="max-w-lg w-full p-6 border-2"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#000000' }}
            >
              <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: '#fc1a4a' }}>
                ⚠️ Important Warning
              </h3>
              <div className="space-y-4 mb-6">
                <p style={{ color: '#000000' }}>
                  You are about to request 3 preview options for your mint. Please understand:
                </p>
                <ul className="list-disc pl-6 space-y-2" style={{ color: '#000000' }}>
                  <li>
                    <strong>You will have exactly 55 minutes</strong> to select one of the 3 options.
                  </li>
                  <li>
                    If you <strong>do not select an option</strong> within this time, 
                    your mint request will be <strong>automatically cancelled</strong>.
                  </li>
                  <li style={{ color: '#fc1a4a' }}>
                    <strong>Your minting fee is NOT refundable</strong> if you fail to complete the selection in time.
                  </li>
                </ul>
                <p className="font-semibold" style={{ color: '#000000' }}>
                  Make sure you have time to review and select an option before proceeding.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 px-6 font-bold border-2 transition-opacity hover:opacity-70"
                  style={{ backgroundColor: '#EBE5D9', borderColor: '#000000', color: '#000000' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleRequestOwnerMint();
                  }}
                  className="flex-1 py-3 px-6 font-bold border-2 transition-opacity hover:opacity-70"
                  style={{ backgroundColor: '#2587c3', borderColor: '#000000', color: '#FFFFFF' }}
                >
                  I Understand, Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
