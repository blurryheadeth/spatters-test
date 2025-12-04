'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

interface SeedPreview {
  seed: string;
  index: number;
  imageUrl: string;
}

export default function PublicMint() {
  const { address, chainId } = useAccount();
  const [step, setStep] = useState<'idle' | 'requesting' | 'previewing' | 'completing'>('idle');
  const [previews, setPreviews] = useState<SeedPreview[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  
  const contractAddress = chainId ? getContractAddress(chainId) : '';

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

  // Read pending request
  const { data: pendingRequest } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'pendingRequests',
    args: address ? [address] : undefined,
  });

  // Request mint transaction
  const { 
    data: requestHash, 
    writeContract: writeRequestMint, 
    isPending: isRequestPending 
  } = useWriteContract();
  
  const { 
    isLoading: isRequestConfirming, 
    isSuccess: isRequestConfirmed 
  } = useWaitForTransactionReceipt({ hash: requestHash });

  // Complete mint transaction
  const { 
    data: completeHash, 
    writeContract: writeCompleteMint, 
    isPending: isCompletePending 
  } = useWriteContract();
  
  const { 
    isLoading: isCompleteConfirming, 
    isSuccess: isCompleteConfirmed 
  } = useWaitForTransactionReceipt({ hash: completeHash });

  // Handle request mint
  const handleRequestMint = async () => {
    if (!mintPrice || !address) return;
    
    setStep('requesting');
    try {
      await writeRequestMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'requestMint',
        value: mintPrice as bigint,
      });
    } catch (error) {
      console.error('Error requesting mint:', error);
      setStep('idle');
    }
  };

  // Generate preview images when request is confirmed
  useEffect(() => {
    if (isRequestConfirmed && pendingRequest) {
      generatePreviewImages();
    }
  }, [isRequestConfirmed, pendingRequest]);

  const generatePreviewImages = async () => {
    if (!pendingRequest) return;
    
    setIsGeneratingPreviews(true);
    setStep('previewing');
    
    // pendingRequest is a tuple: [seeds[3], timestamp, completed]
    const seeds = pendingRequest[0] as [string, string, string];
    
    const newPreviews: SeedPreview[] = [];
    
    for (let i = 0; i < 3; i++) {
      // In production, this would actually render the p5.js artwork
      // For now, we'll use a placeholder
      newPreviews.push({
        seed: seeds[i],
        index: i,
        imageUrl: `/api/preview?seed=${seeds[i]}`, // This would be your preview endpoint
      });
    }
    
    setPreviews(newPreviews);
    setIsGeneratingPreviews(false);
  };

  // Handle complete mint
  const handleCompleteMint = async (index: number) => {
    setSelectedIndex(index);
    setStep('completing');
    
    try {
      await writeCompleteMint({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'completeMint',
        args: [index],
      });
    } catch (error) {
      console.error('Error completing mint:', error);
      setStep('previewing');
      setSelectedIndex(null);
    }
  };

  // Reset after successful mint
  useEffect(() => {
    if (isCompleteConfirmed) {
      setStep('idle');
      setPreviews([]);
      setSelectedIndex(null);
      refetchPrice();
    }
  }, [isCompleteConfirmed]);

  if (!address) {
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-lg">Please connect your wallet to mint</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mint Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Mint a Spatter</h2>
        <div className="space-y-2">
          <p className="text-gray-600 dark:text-gray-300">
            Total Minted: {totalSupply?.toString() || '0'} / 999
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Current Price: {mintPrice ? formatEther(mintPrice as bigint) : '0'} ETH
          </p>
        </div>
      </div>

      {/* Step 1: Request Mint */}
      {step === 'idle' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Step 1: Generate Preview Options</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Click below to generate 3 unique artwork previews. You'll be able to choose your favorite!
          </p>
          <button
            onClick={handleRequestMint}
            disabled={isRequestPending || !mintPrice}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {isRequestPending ? 'Requesting...' : `Request Mint (${mintPrice ? formatEther(mintPrice as bigint) : '0'} ETH)`}
          </button>
        </div>
      )}

      {/* Step 2: Preview Selection */}
      {(step === 'previewing' || step === 'requesting' && isRequestConfirming) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Step 2: Choose Your Artwork</h3>
          
          {isRequestConfirming || isGeneratingPreviews ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                {isRequestConfirming ? 'Confirming transaction...' : 'Generating previews...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {previews.map((preview) => (
                <div
                  key={preview.index}
                  className={`border-4 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedIndex === preview.index
                      ? 'border-blue-600 scale-105'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onClick={() => !isCompletePending && handleCompleteMint(preview.index)}
                >
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 relative">
                    {/* Preview Image - In production, render actual p5.js artwork */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-gray-500">Preview {preview.index + 1}</p>
                      <p className="text-xs text-gray-400 mt-2">Seed: {preview.seed.slice(0, 10)}...</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900">
                    <button
                      disabled={isCompletePending || selectedIndex !== null}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                      {selectedIndex === preview.index && isCompletePending
                        ? 'Minting...'
                        : 'Choose This One'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completing */}
      {step === 'completing' && isCompleteConfirming && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Completing your mint...</p>
        </div>
      )}

      {/* Success */}
      {isCompleteConfirmed && (
        <div className="bg-green-100 dark:bg-green-900 rounded-lg p-6 shadow-lg text-center">
          <h3 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
            🎉 Mint Successful!
          </h3>
          <p className="text-green-700 dark:text-green-300">
            Your Spatter has been minted. Check your wallet!
          </p>
        </div>
      )}
    </div>
  );
}




