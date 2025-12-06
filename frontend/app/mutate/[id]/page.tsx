'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';

// All 92 mutation types from spatters.js
const MUTATION_TYPES = [
  // Color mutations
  'paletteChangeAll', 'paletteChangeOne', 'paletteInvert', 'paletteSwap',
  // Shape mutations
  'shapeExpand', 'shapeContract', 'shapeRotate', 'shapeChangeCurveCenters',
  'shapeChangeLineEndpoints', 'shapeFlip',
  // Gradient mutations
  'gradientTypeChange', 'gradientDirectionChange',
  // Divider mutations
  'dividerAdd', 'dividerRemove', 'dividerMove',
  // Circle mutations
  'circleAdd', 'circleRemove', 'circleMove', 'circleResize',
  // Line mutations
  'lineAdd', 'lineRemove', 'lineMove', 'lineRotate',
  // Complex mutations
  'aspectRatioChange', 'explode', 'implode', 'fade', 'intensify',
  'scramble', 'undoMutation', 'returnToPreviousVersion',
];

// Calculate mutation-eligible dates for a token
function getMutationDates(tokenId: number, mintTimestamp: number, collectionLaunchDate: number): {
  allDates: { date: Date; reason: string }[];
  upcomingDates: { date: Date; reason: string }[];
  canMutateToday: boolean;
  todayReason: string | null;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const allDates: { date: Date; reason: string }[] = [];
  
  // Helper to check if same day
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth();

  // 1. Individual Anniversary (mint date)
  if (mintTimestamp > 0) {
    const mintDate = new Date(mintTimestamp * 1000);
    const anniversaryThisYear = new Date(currentYear, mintDate.getMonth(), mintDate.getDate());
    allDates.push({ date: anniversaryThisYear, reason: 'Mint Anniversary' });
  }

  // 2. Collection Anniversary
  if (collectionLaunchDate > 0) {
    const launchDate = new Date(collectionLaunchDate * 1000);
    const collectionAnniversary = new Date(currentYear, launchDate.getMonth(), launchDate.getDate());
    allDates.push({ date: collectionAnniversary, reason: 'Collection Anniversary' });
  }

  // 3. Quarterly dates based on tokenId
  const assignedMonth = (tokenId % 12) + 1;
  // Q1: March 31 (months 1, 5)
  if (assignedMonth === 1 || assignedMonth === 5) {
    allDates.push({ date: new Date(currentYear, 2, 31), reason: 'Q1 End (Token Month)' });
  }
  // Q2: June 30 (month 2)
  if (assignedMonth === 2) {
    allDates.push({ date: new Date(currentYear, 5, 30), reason: 'Q2 End (Token Month)' });
  }
  // Q3: September 30 (month 3)
  if (assignedMonth === 3) {
    allDates.push({ date: new Date(currentYear, 8, 30), reason: 'Q3 End (Token Month)' });
  }
  // Q4: December 31 (month 4)
  if (assignedMonth === 4) {
    allDates.push({ date: new Date(currentYear, 11, 31), reason: 'Q4 End (Token Month)' });
  }

  // 4. Equinoxes and Solstices (using middle dates)
  allDates.push({ date: new Date(currentYear, 2, 20), reason: 'Vernal Equinox' });
  allDates.push({ date: new Date(currentYear, 5, 21), reason: 'Summer Solstice' });
  allDates.push({ date: new Date(currentYear, 8, 23), reason: 'Autumnal Equinox' });
  allDates.push({ date: new Date(currentYear, 11, 22), reason: 'Winter Solstice' });

  // Sort by date
  allDates.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Filter upcoming dates
  const upcomingDates = allDates.filter(d => d.date >= now);

  // Check if today is a mutation day
  let canMutateToday = false;
  let todayReason: string | null = null;

  // Check equinox/solstice ranges
  const isEquinoxOrSolstice = (date: Date) => {
    const month = date.getMonth();
    const day = date.getDate();
    if (month === 2 && day >= 19 && day <= 21) return 'Vernal Equinox';
    if (month === 5 && day >= 20 && day <= 22) return 'Summer Solstice';
    if (month === 8 && day >= 22 && day <= 24) return 'Autumnal Equinox';
    if (month === 11 && day >= 21 && day <= 23) return 'Winter Solstice';
    return null;
  };

  const equinoxReason = isEquinoxOrSolstice(now);
  if (equinoxReason) {
    canMutateToday = true;
    todayReason = equinoxReason;
  }

  // Check other dates
  for (const { date, reason } of allDates) {
    if (isSameDay(now, date)) {
      canMutateToday = true;
      todayReason = reason;
      break;
    }
  }

  return { allDates, upcomingDates, canMutateToday, todayReason };
}

export default function MutatePage() {
  const params = useParams();
  const router = useRouter();
  const tokenId = parseInt(params.id as string, 10);
  const { address, chainId, isConnected } = useAccount();
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const [selectedMutation, setSelectedMutation] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);

  // Listen for iframe dimensions
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        setIframeHeight(event.data.height);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check token owner
  const { data: ownerAddress, isLoading: isLoadingOwner } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
    query: { enabled: !!contractAddress && !isNaN(tokenId) },
  });

  // Get token data (mint timestamp)
  const { data: tokenData, isLoading: isLoadingToken } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(tokenId)],
    query: { enabled: !!contractAddress && !isNaN(tokenId) },
  });

  // Get collection launch date
  const { data: collectionLaunchDate } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'collectionLaunchDate',
    query: { enabled: !!contractAddress },
  });

  // Check if can mutate (from contract)
  const { data: canMutateContract, refetch: refetchCanMutate } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'canMutate',
    args: [BigInt(tokenId)],
    query: { enabled: !!contractAddress && !isNaN(tokenId) },
  });

  // Get existing mutations
  const { data: existingMutations } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'getTokenMutations',
    args: [BigInt(tokenId)],
    query: { enabled: !!contractAddress && !isNaN(tokenId) },
  });

  // Mutate transaction
  const { 
    data: mutateHash, 
    writeContract: writeMutate, 
    isPending: isMutatePending,
    error: mutateError,
  } = useWriteContract();

  const { isLoading: isMutateConfirming, isSuccess: isMutateConfirmed } = 
    useWaitForTransactionReceipt({ hash: mutateHash });

  // Calculate mutation dates
  const mutationDates = useMemo(() => {
    const mintTimestamp = tokenData ? Number((tokenData as any).mintTimestamp || 0) : 0;
    const launchDate = collectionLaunchDate ? Number(collectionLaunchDate) : 0;
    return getMutationDates(tokenId, mintTimestamp, launchDate);
  }, [tokenId, tokenData, collectionLaunchDate]);

  // Handle mutate submission
  const handleMutate = async () => {
    if (!selectedMutation) {
      alert('Please select a mutation type');
      return;
    }

    try {
      await writeMutate({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'mutate',
        args: [BigInt(tokenId), selectedMutation],
      });
    } catch (err) {
      console.error('Mutation error:', err);
    }
  };

  // After successful mutation
  useEffect(() => {
    if (isMutateConfirmed) {
      // Trigger pixel regeneration
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, event: 'token-mutated' }),
      }).catch(console.error);

      // Refetch mutation eligibility
      refetchCanMutate();
    }
  }, [isMutateConfirmed, tokenId, refetchCanMutate]);

  const isLoading = isLoadingOwner || isLoadingToken;
  const isOwner = ownerAddress && address && 
    (ownerAddress as string).toLowerCase() === address.toLowerCase();
  const mutationCount = existingMutations ? (existingMutations as any[]).length : 0;

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Connect Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to access mutations.
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not owner
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-red-100 dark:bg-red-900/30 rounded-lg max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-red-800 dark:text-red-200">Access Denied</h1>
          <p className="text-red-700 dark:text-red-300 mb-6">
            You do not own Spatter #{tokenId}. Only the owner can access the mutation page.
          </p>
          <Link href="/my-spatters" className="text-blue-600 hover:underline">
            ← Back to My Spatters
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/my-spatters" className="text-blue-600 hover:underline">
            ← Back to My Spatters
          </Link>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Mutate Spatter #{tokenId}
          </h1>
          <Link href={`/token/${tokenId}`} className="text-blue-600 hover:underline">
            View Token →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Artwork Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Current Artwork
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Mutations: {mutationCount} / 200
              </p>
            </div>
            <div className="bg-black flex justify-center">
              <iframe
                src={`${baseUrl}/api/token/${tokenId}`}
                className="border-0 w-full transition-all duration-300"
                style={{ 
                  maxWidth: '600px',
                  height: iframeHeight ? `${Math.min(iframeHeight, 600)}px` : '400px',
                }}
                title={`Spatter #${tokenId}`}
              />
            </div>
            <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
              Click to cycle through mutation history
            </div>
          </div>

          {/* Right: Mutation Panel */}
          <div className="space-y-6">
            {/* Mutation Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                Mutation Schedule
              </h2>

              {/* All dates this year */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  All Eligible Dates This Year
                </h3>
                <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  {mutationDates.allDates.map((d, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-200 dark:border-gray-700 last:border-0">
                      <span className="text-gray-600 dark:text-gray-400">
                        {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">{d.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming dates */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upcoming Dates
                </h3>
                {mutationDates.upcomingDates.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No more eligible dates this year.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {mutationDates.upcomingDates.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                        <span className="font-medium text-blue-800 dark:text-blue-200">
                          {d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-sm text-blue-600 dark:text-blue-400">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mutation Interface */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                Apply Mutation
              </h2>

              {canMutateContract ? (
                <div className="space-y-4">
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
                    <p className="text-green-800 dark:text-green-200 font-medium">
                      ✓ Mutation Available Today!
                    </p>
                    {mutationDates.todayReason && (
                      <p className="text-green-700 dark:text-green-300 text-sm">
                        Reason: {mutationDates.todayReason}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Mutation Type
                    </label>
                    <select
                      value={selectedMutation}
                      onChange={(e) => setSelectedMutation(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">-- Select a mutation --</option>
                      {MUTATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {mutateError && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                      <p className="text-red-800 dark:text-red-200 text-sm">
                        Error: {(mutateError as any).shortMessage || mutateError.message}
                      </p>
                    </div>
                  )}

                  {isMutateConfirmed && (
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
                      <p className="text-green-800 dark:text-green-200 font-medium">
                        ✓ Mutation Applied Successfully!
                      </p>
                      <p className="text-green-700 dark:text-green-300 text-sm">
                        Refresh the page to see the updated artwork.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleMutate}
                    disabled={!selectedMutation || isMutatePending || isMutateConfirming}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    {isMutatePending || isMutateConfirming ? 'Processing...' : 'Apply Mutation'}
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    Mutation Not Available Today
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    Check the schedule above for the next eligible mutation date.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

