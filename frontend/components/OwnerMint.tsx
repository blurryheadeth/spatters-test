'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

const DEFAULT_COLORS = ['#fc1a4a', '#75d494', '#2587c3', '#f2c945', '#000000', '#FFFFFF'];
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

type MintMode = 'choose' | 'direct' | 'preview';

export default function OwnerMint() {
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

  // Read pending request
  const { data: pendingRequest, refetch: refetchPendingRequest } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getPendingRequest',
    args: [address],
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
    if (isCompleteConfirmed || isDirectConfirmed) {
      refetchSupply();
      
      // Trigger pixel generation
      const newTokenId = Number(totalSupply) + 1;
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newTokenId, event: 'token-minted' }),
      }).catch(console.error);
      
      // Reset form
      resetForm();
    }
  }, [isCompleteConfirmed, isDirectConfirmed, totalSupply, refetchSupply]);

  // Validate hex color
  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  // Validate bytes32 seed
  const isValidBytes32 = (value: string): boolean => {
    return /^0x[0-9A-Fa-f]{64}$/.test(value);
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
    setError('');
    resetRequest();
    resetComplete();
    resetDirect();
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

  // Handle direct owner mint (with custom seed)
  const handleDirectOwnerMint = async () => {
    if (!validateInputs()) return;
    
    if (!customSeed || !isValidBytes32(customSeed)) {
      setError('Invalid seed format. Must be 0x followed by 64 hex characters (bytes32)');
      return;
    }
    
    const paletteParam: [string, string, string, string, string, string] = useCustomPalette
      ? customPalette as [string, string, string, string, string, string]
      : ['', '', '', '', '', ''];
    
    try {
      await writeDirectMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'ownerMint',
        args: [recipient as `0x${string}`, paletteParam, customSeed],
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

  // Render mode selection
  if (mintMode === 'choose') {
    return (
      <div className="space-y-6">
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
                Provide a specific bytes32 seed to mint a deterministic artwork immediately.
                Useful for recreating specific pieces.
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

            {/* Custom Seed (Required) */}
            <div>
              <label className="block text-sm font-medium mb-2">Custom Seed (bytes32) *</label>
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
              />
              {customSeed && !isValidBytes32(customSeed) && (
                <p className="text-xs text-red-600 mt-1">
                  Invalid format. Must be 0x followed by 64 hex characters.
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

        {/* Step 2: Show previews and select */}
        {previewSeeds.length === 3 && (
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-400">
              Click on a preview to select it, then confirm your selection to mint.
            </p>
            
            <div className="grid md:grid-cols-3 gap-4">
              {previewSeeds.map((seed, index) => {
                const paletteQuery = useCustomPalette 
                  ? `&palette=${customPalette.join(',')}`
                  : '';
                const previewUrl = `${baseUrl}/api/preview?seed=${seed}${paletteQuery}`;
                
                return (
                  <div
                    key={index}
                    onClick={() => setSelectedSeedIndex(index)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-4 transition-all ${
                      selectedSeedIndex === index
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="aspect-[2/1] bg-gray-100 dark:bg-gray-900">
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title={`Preview ${index + 1}`}
                      />
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 text-center">
                      <span className="text-sm font-medium">
                        Option {index + 1}
                        {selectedSeedIndex === index && ' ✓'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={handleCompleteOwnerMint}
              disabled={selectedSeedIndex === null || isCompletePending || isCompleteConfirming}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isCompletePending || isCompleteConfirming 
                ? 'Minting...' 
                : selectedSeedIndex !== null 
                  ? `Confirm Selection & Mint Option ${selectedSeedIndex + 1}`
                  : 'Select an Option Above'
              }
            </button>

            {isCompleteConfirmed && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                <p className="text-green-800 dark:text-green-200 font-semibold">
                  ✅ Token minted successfully!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
