'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

const DEFAULT_COLORS = ['#fc1a4a', '#75d494', '#2587c3', '#f2c945', '#000000', '#FFFFFF'];
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default function OwnerMint() {
  const { address, chainId } = useAccount();
  const [recipient, setRecipient] = useState('');
  const [useCustomPalette, setUseCustomPalette] = useState(false);
  const [customPalette, setCustomPalette] = useState<string[]>(DEFAULT_COLORS);
  const [useCustomSeed, setUseCustomSeed] = useState(false);
  const [customSeed, setCustomSeed] = useState('');
  const [error, setError] = useState('');
  
  const contractAddress = chainId ? getContractAddress(chainId) : '';

  // Read owner address
  const { data: ownerAddress } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'owner',
  });

  // Read total supply
  const { data: totalSupply } = useReadContract({
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

  // Owner mint transaction
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  // Check if connected wallet is owner
  const isOwner = address && ownerAddress && 
    address.toLowerCase() === (ownerAddress as string).toLowerCase();

  // Set recipient to owner by default
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address]);

  // Validate hex color
  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  // Validate bytes32 seed (64 hex chars with 0x prefix)
  const isValidBytes32 = (value: string): boolean => {
    return /^0x[0-9A-Fa-f]{64}$/.test(value);
  };

  // Handle palette color change
  const handleColorChange = (index: number, value: string) => {
    const newPalette = [...customPalette];
    newPalette[index] = value;
    setCustomPalette(newPalette);
    
    // Clear error if all colors are valid
    if (newPalette.every(isValidHexColor)) {
      setError('');
    }
  };

  // Handle owner mint
  const handleOwnerMint = async () => {
    setError('');
    
    // Validate recipient address
    if (!recipient || !/^0x[0-9A-Fa-f]{40}$/.test(recipient)) {
      setError('Invalid recipient address');
      return;
    }
    
    // Validate custom palette if enabled
    if (useCustomPalette) {
      for (let i = 0; i < 6; i++) {
        if (!isValidHexColor(customPalette[i])) {
          setError(`Invalid hex color at position ${i + 1}: ${customPalette[i]}`);
          return;
        }
      }
    }

    // Validate custom seed if enabled
    if (useCustomSeed && customSeed && !isValidBytes32(customSeed)) {
      setError('Invalid seed format. Must be 0x followed by 64 hex characters (bytes32)');
      return;
    }
    
    // Prepare palette parameter
    const paletteParam: [string, string, string, string, string, string] = useCustomPalette
      ? customPalette as [string, string, string, string, string, string]
      : ['', '', '', '', '', ''];

    // Prepare seed parameter (bytes32(0) = auto-generate, otherwise use custom)
    const seedParam = useCustomSeed && customSeed ? customSeed : ZERO_BYTES32;
    
    try {
      await writeContract({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'ownerMint',
        args: [recipient as `0x${string}`, paletteParam, seedParam],
      });
    } catch (err: any) {
      setError(err.message || 'Mint failed');
    }
  };

  // Reset form and trigger pixel generation after successful mint
  useEffect(() => {
    if (isConfirmed && totalSupply !== undefined) {
      // The new token ID is totalSupply (which was incremented after mint)
      const newTokenId = Number(totalSupply);
      
      // Trigger pixel generation in background
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newTokenId, event: 'token-minted' }),
      }).catch(console.error);
      
      // Reset form
      setRecipient(address || '');
      setUseCustomPalette(false);
      setCustomPalette(DEFAULT_COLORS);
      setUseCustomSeed(false);
      setCustomSeed('');
    }
  }, [isConfirmed, address, totalSupply]);

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

  const remainingReserve = ownerReserve && totalSupply 
    ? Number(ownerReserve) - Number(totalSupply)
    : 0;

  if (remainingReserve <= 0) {
    return (
      <div className="text-center p-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
        <p className="text-lg text-yellow-800 dark:text-yellow-200">
          Owner reserve exhausted
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Owner Mint</h2>
        <div className="space-y-2">
          <p className="text-gray-600 dark:text-gray-300">
            Owner Reserve Remaining: {remainingReserve} / {ownerReserve?.toString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            As owner, you can mint the first 25 tokens for free, with optional custom palettes
          </p>
        </div>
      </div>

      {/* Mint Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="space-y-6">
          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Custom Seed Toggle */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useCustomSeed"
                checked={useCustomSeed}
                onChange={(e) => setUseCustomSeed(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="useCustomSeed" className="text-sm font-medium">
                Use Custom Seed (bytes32)
              </label>
            </div>
            
            {useCustomSeed && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Provide a specific seed for deterministic artwork generation. 
                  Leave empty for auto-generation.
                </p>
                <input
                  type="text"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                />
                {customSeed && !isValidBytes32(customSeed) && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Invalid format. Must be 0x followed by 64 hex characters.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Custom Palette Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="useCustomPalette"
              checked={useCustomPalette}
              onChange={(e) => setUseCustomPalette(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="useCustomPalette" className="text-sm font-medium">
              Use Custom Palette (6 colors)
            </label>
          </div>

          {/* Custom Palette Inputs */}
          {useCustomPalette && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Default palette: {DEFAULT_COLORS.join(', ')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {customPalette.map((color, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm font-medium">
                      Color {index + 1}
                    </label>
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
                        placeholder="#RRGGBB"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                      />
                    </div>
                    {!isValidHexColor(color) && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Invalid hex color
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Mint Button */}
          <button
            onClick={handleOwnerMint}
            disabled={isPending || isConfirming || !recipient}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {isPending || isConfirming ? 'Minting...' : 'Mint Token'}
          </button>

          {/* Success Message */}
          {isConfirmed && (
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



