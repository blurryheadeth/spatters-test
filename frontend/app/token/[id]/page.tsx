'use client';

import { useParams } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { useState } from 'react';
import Link from 'next/link';
import { Abi } from 'viem';
import { getContractAddress, getEtherscanBaseUrl } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

const contractAbi = SpattersABI.abi as Abi;

export default function TokenPage() {
  const params = useParams();
  const tokenId = params.id as string;
  const [chainId, setChainId] = useState<number>(11155111); // Default to Sepolia
  
  const contractAddress = getContractAddress(chainId);
  const etherscanBase = getEtherscanBaseUrl(chainId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Check if token exists
  const { data: tokenData, isLoading: isLoadingToken } = useReadContract({
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation */}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/collection" className="text-blue-600 hover:underline">
            ← Back to Collection
          </Link>
          <div className="flex gap-4">
            {Number(tokenId) > 1 && (
              <Link href={`/token/${Number(tokenId) - 1}`} className="text-blue-600 hover:underline">
                ← Previous
              </Link>
            )}
            {totalSupply && Number(tokenId) < Number(totalSupply) && (
              <Link href={`/token/${Number(tokenId) + 1}`} className="text-blue-600 hover:underline">
                Next →
              </Link>
            )}
          </div>
        </div>

        {/* Token Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {/* Artwork */}
          <div className="aspect-[2/1] bg-black">
            <iframe
              src={`${baseUrl}/api/token/${tokenId}`}
              className="w-full h-full border-0"
              title={`Spatter #${tokenId}`}
            />
          </div>

          {/* Token Info */}
          <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Spatter #{tokenId}
            </h1>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Owner */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Owner</h3>
                {typeof ownerAddress === 'string' && (
                  <a
                    href={`${etherscanBase}/address/${ownerAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-mono"
                  >
                    {formatAddress(ownerAddress)}
                  </a>
                )}
              </div>

              {/* Contract */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contract</h3>
                <a
                  href={`${etherscanBase}/token/${contractAddress}?a=${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono"
                >
                  {formatAddress(contractAddress)}
                </a>
              </div>

              {/* Token ID on Etherscan */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">View on Etherscan</h3>
                <a
                  href={`${etherscanBase}/nft/${contractAddress}/${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Token #{tokenId} →
                </a>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Metadata</h3>
                <a
                  href={`${baseUrl}/api/metadata/${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View JSON →
                </a>
              </div>
            </div>

            {/* Interaction hint */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 <strong>Tip:</strong> Click on the artwork to cycle through mutation history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

