'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { markTokenMutated } from '@/lib/mutation-tracker';

// Mutation types grouped by category for better UX
const MUTATION_GROUPS: Record<string, { label: string; emoji: string; mutations: string[] }> = {
  circles: {
    label: 'Circles',
    emoji: '⭕',
    mutations: [
      'circleCountChange', 'circleSizeIncrease', 'circleSizeDecrease',
      'circlePositionChange', 'circleMoveLeft', 'circleMoveRight',
      'circleMoveUp', 'circleMoveDown',
    ],
  },
  lines: {
    label: 'Lines',
    emoji: '📏',
    mutations: [
      'lineCountChange', 'lineWidthIncrease', 'lineWidthDecrease',
      'lineAngleChange', 'lineLengthIncrease', 'lineLengthDecrease',
      'linePositionChange', 'lineMoveLeft', 'lineMoveRight',
      'lineMoveUp', 'lineMoveDown',
    ],
  },
  dividers: {
    label: 'Dividers',
    emoji: '➗',
    mutations: ['dividerCountChange', 'dividerMove', 'dividerRotate'],
  },
  palette: {
    label: 'Colors',
    emoji: '🎨',
    mutations: [
      'paletteChangeOne', 'paletteChangeAll', 'paletteCombineOne',
      'paletteCombineAll', 'paletteResetOne', 'paletteResetAll',
      'paletteShuffle',
    ],
  },
  shape: {
    label: 'Shape',
    emoji: '🔷',
    mutations: [
      'shapeExpand', 'shapeShrink', 'shapeMakeWider', 'shapeMakeNarrower',
      'shapeMakeHigher', 'shapeMakeShorter', 'shapeChangeCurveCenters',
      'shapeIncreaseConcavity', 'shapeReduceConcavity', 'shapeChangeRadiuses',
      'shapeMove',
    ],
  },
  seedpoints: {
    label: 'Seed Points',
    emoji: '📍',
    mutations: [
      'seedPointCountIncrease', 'seedPointCountDecrease',
      'seedpointMoveRight', 'seedpointMoveLeft', 'seedpointMoveUp',
      'seedpointMoveDown', 'seedpointChangeCurveCenter',
      'seedpointIncreaseConcavity', 'seedpointDecreaseConcavity',
      'seedpointIncreaseRadius', 'seedpointDecreaseRadius',
    ],
  },
  seedpointsTop: {
    label: 'Points (Top)',
    emoji: '⬆️',
    mutations: [
      'seedpointMoveRight-top', 'seedpointMoveLeft-top',
      'seedpointMoveUp-top', 'seedpointMoveDown-top',
      'seedpointChangeCurveCenter-top', 'seedpointIncreaseConcavity-top',
      'seedpointDecreaseConcavity-top', 'seedpointIncreaseRadius-top',
      'seedpointDecreaseRadius-top',
    ],
  },
  seedpointsBottom: {
    label: 'Points (Bottom)',
    emoji: '⬇️',
    mutations: [
      'seedpointMoveRight-bottom', 'seedpointMoveLeft-bottom',
      'seedpointMoveUp-bottom', 'seedpointMoveDown-bottom',
      'seedpointChangeCurveCenter-bottom', 'seedpointIncreaseConcavity-bottom',
      'seedpointDecreaseConcavity-bottom', 'seedpointIncreaseRadius-bottom',
      'seedpointDecreaseRadius-bottom',
    ],
  },
  seedpointsLeft: {
    label: 'Points (Left)',
    emoji: '⬅️',
    mutations: [
      'seedpointMoveRight-left', 'seedpointMoveLeft-left',
      'seedpointMoveUp-left', 'seedpointMoveDown-left',
      'seedpointChangeCurveCenter-left', 'seedpointIncreaseConcavity-left',
      'seedpointDecreaseConcavity-left', 'seedpointIncreaseRadius-left',
      'seedpointDecreaseRadius-left',
    ],
  },
  seedpointsRight: {
    label: 'Points (Right)',
    emoji: '➡️',
    mutations: [
      'seedpointMoveRight-right', 'seedpointMoveLeft-right',
      'seedpointMoveUp-right', 'seedpointMoveDown-right',
      'seedpointChangeCurveCenter-right', 'seedpointIncreaseConcavity-right',
      'seedpointDecreaseConcavity-right', 'seedpointIncreaseRadius-right',
      'seedpointDecreaseRadius-right',
    ],
  },
  general: {
    label: 'General',
    emoji: '⚙️',
    mutations: [
      'aspectRatioChange', 'baseRadiusIncrease', 'baseRadiusDecrease',
      'gradientTypeChange', 'rotate',
    ],
  },
  history: {
    label: 'History',
    emoji: '⏪',
    mutations: ['undoMutation', 'returnToPreviousVersion'],
  },
};

// Flat list for validation (all 94 mutations)
const MUTATION_TYPES = Object.values(MUTATION_GROUPS).flatMap(g => g.mutations);

interface MilestoneData {
  tokenId: number;
  mintTimestamp: number;
  exists: boolean;
}

// Helper to format mutation date with year if different from current
function formatMutationDate(date: Date): string {
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() !== currentYear) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Mutation interface component (reusable for both regular and owner)
interface MutationInterfaceProps {
  isOwnerBypass?: boolean;
  onMutate: (mutationType: string) => void;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  onReset: () => void;
}

function MutationInterface({ 
  isOwnerBypass = false,
  onMutate,
  isPending,
  isConfirming,
  isConfirmed,
  error,
  onReset,
}: MutationInterfaceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const handleMutationClick = (mutationType: string) => {
    onMutate(mutationType);
    setIsModalOpen(false);
    setSelectedGroup(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGroup(null);
  };

  return (
    <div className="space-y-4">
      {isOwnerBypass && (
        <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-lg p-3">
          <p className="text-purple-800 dark:text-purple-200 font-medium">
            🔧 Contract Owner Bypass
          </p>
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            As contract owner, you can mutate at any time (testing only).
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error: {(error as any)?.shortMessage || error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
          <p className="text-green-800 dark:text-green-200 font-medium">
            ✓ Mutation Applied Successfully!
          </p>
          <p className="text-green-700 dark:text-green-300 text-sm">
            The artwork will regenerate automatically.
          </p>
          <button 
            onClick={onReset}
            className="mt-2 text-sm text-green-600 dark:text-green-400 underline"
          >
            Apply another mutation
          </button>
        </div>
      )}

      {!isConfirmed && (
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isPending || isConfirming}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
            isOwnerBypass 
              ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400' 
              : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400'
          } disabled:cursor-not-allowed text-white`}
        >
          {isPending || isConfirming ? 'Processing...' : '🧬 Mutate'}
        </button>
      )}

      {/* Mutation Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {selectedGroup ? (
                  <button 
                    onClick={() => setSelectedGroup(null)}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    <span>←</span>
                    <span>{MUTATION_GROUPS[selectedGroup]?.emoji} {MUTATION_GROUPS[selectedGroup]?.label}</span>
                  </button>
                ) : (
                  'Select Mutation Type'
                )}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
              {!selectedGroup ? (
                /* Group Selection */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(MUTATION_GROUPS).map(([key, group]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedGroup(key)}
                      className="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors border-2 border-transparent hover:border-blue-500"
                    >
                      <span className="text-2xl mb-1">{group.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{group.mutations.length} options</span>
                    </button>
                  ))}
                </div>
              ) : (
                /* Mutation Selection within Group */
                <div className="space-y-2">
                  {MUTATION_GROUPS[selectedGroup]?.mutations.map((mutation) => (
                    <button
                      key={mutation}
                      onClick={() => handleMutationClick(mutation)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${
                        isOwnerBypass
                          ? 'bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/50 text-purple-800 dark:text-purple-200'
                          : 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-800 dark:text-green-200'
                      }`}
                    >
                      {mutation}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Calculate mutation-eligible dates for a token based on milestone anniversaries
// Now returns dates from multiple years to ensure at least 5 upcoming dates
function getMutationDates(
  tokenId: number, 
  ownMintTimestamp: number, 
  milestones: MilestoneData[]
): {
  allDatesThisYear: { date: Date; reason: string }[];
  upcomingDates: { date: Date; reason: string }[];
  canMutateToday: boolean;
  todayReason: string | null;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Helper to check if same month and day (for anniversaries)
  const isSameMonthAndDay = (d1: Date, d2: Date) => 
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth();

  // Collect base anniversary dates (month/day pairs with reasons)
  const anniversaries: { month: number; day: number; reason: string }[] = [];

  // Add own mint anniversary
  if (ownMintTimestamp > 0) {
    const mintDate = new Date(ownMintTimestamp * 1000);
    anniversaries.push({ 
      month: mintDate.getMonth(), 
      day: mintDate.getDate(), 
      reason: `Token #${tokenId} Mint Anniversary` 
    });
  }

  // Add milestone token anniversaries (only if they exist)
  for (const milestone of milestones) {
    if (milestone.tokenId === tokenId) continue;
    
    if (milestone.exists && milestone.mintTimestamp > 0) {
      const milestoneDate = new Date(milestone.mintTimestamp * 1000);
      
      // Don't add duplicate month/day
      const isDuplicate = anniversaries.some(a => 
        a.month === milestoneDate.getMonth() && a.day === milestoneDate.getDate()
      );
      
      if (!isDuplicate) {
        anniversaries.push({ 
          month: milestoneDate.getMonth(), 
          day: milestoneDate.getDate(), 
          reason: `Token #${milestone.tokenId} Anniversary` 
        });
      }
    }
  }

  // Generate dates for this year
  const allDatesThisYear: { date: Date; reason: string }[] = anniversaries.map(a => ({
    date: new Date(currentYear, a.month, a.day),
    reason: a.reason,
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  // Generate upcoming dates (including future years to get at least 5)
  const upcomingDates: { date: Date; reason: string }[] = [];
  let yearOffset = 0;
  
  while (upcomingDates.length < 5 && yearOffset < 10) {
    const year = currentYear + yearOffset;
    
    for (const ann of anniversaries) {
      const date = new Date(year, ann.month, ann.day);
      
      // Only add if in the future
      if (date > now) {
        // Check not already added (same date)
        const alreadyExists = upcomingDates.some(d => d.date.getTime() === date.getTime());
        if (!alreadyExists) {
          upcomingDates.push({ date, reason: ann.reason });
        }
      }
    }
    
    yearOffset++;
  }

  // Sort upcoming dates and limit to 5
  upcomingDates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const limitedUpcoming = upcomingDates.slice(0, 5);

  // Check if today is a mutation day
  let canMutateToday = false;
  let todayReason: string | null = null;

  for (const ann of anniversaries) {
    const todayAnniversary = new Date(currentYear, ann.month, ann.day);
    if (isSameMonthAndDay(now, todayAnniversary)) {
      canMutateToday = true;
      todayReason = ann.reason;
      break;
    }
  }

  return { allDatesThisYear, upcomingDates: limitedUpcoming, canMutateToday, todayReason };
}

export default function MutatePage() {
  const params = useParams();
  const tokenId = parseInt(params.id as string, 10);
  const { address, chainId, isConnected } = useAccount();
  const contractAddress = chainId ? getContractAddress(chainId) : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const [iframeHeight, setIframeHeight] = useState<number>(600);
  
  // Regeneration tracking
  const [regenerationStatus, setRegenerationStatus] = useState<'idle' | 'waiting' | 'ready' | 'error'>('idle');
  const [regenerationMessage, setRegenerationMessage] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0); // Force iframe reload

  // Listen for iframe dimensions
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spatters-canvas-ready') {
        setIframeHeight(event.data.height || 600);
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

  // Check contract owner
  const { data: contractOwner } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'owner',
    query: { enabled: !!contractAddress },
  });

  // Get token data (mint timestamp)
  const { data: tokenData, isLoading: isLoadingToken } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(tokenId)],
    query: { enabled: !!contractAddress && !isNaN(tokenId) },
  });

  // Get total supply (to know which milestones exist)
  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'totalSupply',
    query: { enabled: !!contractAddress },
  });

  // Get milestone token data (tokens 1, 100, 500, 750, 999)
  const { data: token1Data } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(1)],
    query: { enabled: !!contractAddress && Number(totalSupply || 0) >= 1 },
  });

  const { data: token100Data } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(100)],
    query: { enabled: !!contractAddress && Number(totalSupply || 0) >= 100 },
  });

  const { data: token500Data } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(500)],
    query: { enabled: !!contractAddress && Number(totalSupply || 0) >= 500 },
  });

  const { data: token750Data } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(750)],
    query: { enabled: !!contractAddress && Number(totalSupply || 0) >= 750 },
  });

  const { data: token999Data } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SpattersABI.abi,
    functionName: 'tokens',
    args: [BigInt(999)],
    query: { enabled: !!contractAddress && Number(totalSupply || 0) >= 999 },
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

  // Regular mutate transaction
  const { 
    data: mutateHash, 
    writeContract: writeMutate, 
    isPending: isMutatePending,
    error: mutateError,
    reset: resetMutate,
  } = useWriteContract();

  const { isLoading: isMutateConfirming, isSuccess: isMutateConfirmed } = 
    useWaitForTransactionReceipt({ hash: mutateHash });

  // Owner mutate transaction (bypass)
  const { 
    data: ownerMutateHash, 
    writeContract: writeOwnerMutate, 
    isPending: isOwnerMutatePending,
    error: ownerMutateError,
    reset: resetOwnerMutate,
  } = useWriteContract();

  const { isLoading: isOwnerMutateConfirming, isSuccess: isOwnerMutateConfirmed } = 
    useWaitForTransactionReceipt({ hash: ownerMutateHash });

  // Build milestone data array
  // Token data is returned as array: [mintSeed, mintTimestamp]
  const milestoneData: MilestoneData[] = useMemo(() => {
    const supply = Number(totalSupply || 0);
    return [
      { tokenId: 1, mintTimestamp: Number((token1Data as any)?.[1] || 0), exists: supply >= 1 },
      { tokenId: 100, mintTimestamp: Number((token100Data as any)?.[1] || 0), exists: supply >= 100 },
      { tokenId: 500, mintTimestamp: Number((token500Data as any)?.[1] || 0), exists: supply >= 500 },
      { tokenId: 750, mintTimestamp: Number((token750Data as any)?.[1] || 0), exists: supply >= 750 },
      { tokenId: 999, mintTimestamp: Number((token999Data as any)?.[1] || 0), exists: supply >= 999 },
    ];
  }, [totalSupply, token1Data, token100Data, token500Data, token750Data, token999Data]);

  // Calculate mutation dates
  const mutationDates = useMemo(() => {
    // tokenData is returned as array: [mintSeed, mintTimestamp]
    const mintTimestamp = tokenData ? Number((tokenData as any)[1] || 0) : 0;
    return getMutationDates(tokenId, mintTimestamp, milestoneData);
  }, [tokenId, tokenData, milestoneData]);

  // Handle regular mutate submission
  const handleMutate = async (mutationType: string) => {
    if (!mutationType) {
      alert('Please select a mutation type');
      return;
    }

    try {
      await writeMutate({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'mutate',
        args: [BigInt(tokenId), mutationType],
      });
    } catch (err) {
      console.error('Mutation error:', err);
    }
  };

  // Handle owner mutate submission (bypass)
  const handleOwnerMutate = async (mutationType: string) => {
    if (!mutationType) {
      alert('Please select a mutation type');
      return;
    }

    try {
      await writeOwnerMutate({
        address: contractAddress as `0x${string}`,
        abi: SpattersABI.abi,
        functionName: 'ownerMutate',
        args: [BigInt(tokenId), mutationType],
      });
    } catch (err) {
      console.error('Owner mutation error:', err);
    }
  };

  // After successful mutation (regular or owner)
  useEffect(() => {
    if (isMutateConfirmed || isOwnerMutateConfirmed) {
      // Mark token as recently mutated (for other pages to detect)
      markTokenMutated(tokenId);
      
      // Set waiting status
      setRegenerationStatus('waiting');
      setRegenerationMessage('Triggering artwork regeneration...');
      
      // Capture the time we started (to compare against file timestamps)
      const mutationTime = new Date().toISOString();
      
      // Trigger pixel regeneration
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, event: 'token-mutated' }),
      }).then(() => {
        setRegenerationMessage('Waiting for artwork to regenerate (this may take 1-2 minutes)...');
        
        // Start polling for completion
        let pollCount = 0;
        const maxPolls = 60; // Poll for up to 5 minutes (60 * 5s)
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          try {
            const response = await fetch(`/api/pixel-status/${tokenId}`, { cache: 'no-store' });
            const data = await response.json();
            
            // Check if the file was updated AFTER we triggered the mutation
            if (data.exists && data.lastModified) {
              const fileTime = new Date(data.lastModified);
              const mutTime = new Date(mutationTime);
              
              if (fileTime > mutTime) {
                // File was regenerated after our mutation!
                clearInterval(pollInterval);
                setRegenerationStatus('ready');
                setRegenerationMessage('Artwork regenerated successfully!');
                
                // Force iframe reload with cache-busting
                setIframeKey(prev => prev + 1);
                
                // Refetch mutation eligibility
                refetchCanMutate();
                
                // Clear success message after a few seconds
                setTimeout(() => {
                  setRegenerationStatus('idle');
                  setRegenerationMessage('');
                }, 5000);
              }
            }
            
            // Update progress message
            if (pollCount % 6 === 0) { // Every 30 seconds
              setRegenerationMessage(`Still waiting for regeneration... (${Math.floor(pollCount * 5 / 60)} min elapsed)`);
            }
            
          } catch (error) {
            console.error('Polling error:', error);
          }
          
          // Stop polling after max attempts
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setRegenerationStatus('error');
            setRegenerationMessage('Regeneration taking longer than expected. Please refresh manually in a few minutes.');
          }
        }, 5000); // Poll every 5 seconds
        
        // Cleanup on unmount
        return () => clearInterval(pollInterval);
        
      }).catch((error) => {
        console.error('Trigger error:', error);
        setRegenerationStatus('error');
        setRegenerationMessage('Failed to trigger regeneration. Please try refreshing the page.');
      });
    }
  }, [isMutateConfirmed, isOwnerMutateConfirmed, tokenId, refetchCanMutate]);

  const isLoading = isLoadingOwner || isLoadingToken;
  const isTokenOwner = ownerAddress && address && 
    (ownerAddress as string).toLowerCase() === address.toLowerCase();
  const isContractOwner = contractOwner && address && 
    (contractOwner as string).toLowerCase() === address.toLowerCase();
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
  if (!isTokenOwner) {
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <Link href="/my-spatters" className="text-blue-600 hover:underline text-sm">
            ← Back to My Spatters
          </Link>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            Mutate Spatter #{tokenId}
          </h1>
          <Link href={`/token/${tokenId}`} className="text-blue-600 hover:underline text-sm">
            View Token →
          </Link>
        </div>
      </header>

      {/* Regeneration Status Banner */}
      {regenerationStatus !== 'idle' && (
        <div className={`px-4 py-3 text-center ${
          regenerationStatus === 'waiting' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' :
          regenerationStatus === 'ready' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
          'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
        }`}>
          <div className="flex items-center justify-center gap-2">
            {regenerationStatus === 'waiting' && (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {regenerationStatus === 'ready' && <span>✓</span>}
            {regenerationStatus === 'error' && <span>⚠</span>}
            <span>{regenerationMessage}</span>
          </div>
        </div>
      )}

      <main className="flex flex-col xl:flex-row">
        <div className="w-full xl:w-[1200px] xl:flex-shrink-0 bg-black">
          <iframe
            key={iframeKey}
            src={`${baseUrl}/api/token/${tokenId}?v=${iframeKey}`}
            className="border-0 w-full"
            style={{ 
              height: `${iframeHeight}px`,
              maxWidth: '1200px',
            }}
            title={`Spatter #${tokenId}`}
          />
          <div className="bg-gray-900 text-center text-sm text-gray-400 py-2">
            Click artwork to cycle through mutation history • Mutations: {mutationCount} / 200
          </div>
        </div>

        <div 
          className="flex-1 p-4 xl:p-6 xl:overflow-y-auto space-y-4"
          style={{ maxHeight: iframeHeight ? `${iframeHeight + 40}px` : undefined }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Next Mutation Dates
            </h2>
            <div className="space-y-2">
              {mutationDates.upcomingDates.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No eligible dates available.
                </p>
              )}
              {mutationDates.upcomingDates.map((d, i) => (
                <div key={i} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                  <span className="font-medium text-blue-800 dark:text-blue-200 text-sm">
                    {formatMutationDate(d.date)}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">{d.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Mutations
            </h2>
            {(canMutateContract as boolean) ? (
              <div className="space-y-4">
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
                  <p className="text-green-800 dark:text-green-200 font-medium text-sm">
                    ✓ Mutation Available Today!
                  </p>
                  {mutationDates.todayReason && (
                    <p className="text-green-700 dark:text-green-300 text-xs">
                      Reason: {mutationDates.todayReason}
                    </p>
                  )}
                </div>
                <MutationInterface
                  onMutate={handleMutate}
                  isPending={isMutatePending}
                  isConfirming={isMutateConfirming}
                  isConfirmed={isMutateConfirmed}
                  error={mutateError}
                  onReset={resetMutate}
                />
              </div>
            ) : (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium text-sm">
                  Mutation Not Available Today
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                  Check the schedule above for the next eligible date.
                </p>
              </div>
            )}
          </div>

          {Boolean(isContractOwner) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border-2 border-purple-300 dark:border-purple-700">
              <h2 className="text-base font-semibold mb-3 text-purple-800 dark:text-purple-200">
                🔧 Owner Mutation (Testing)
              </h2>
              <MutationInterface
                isOwnerBypass
                onMutate={handleOwnerMutate}
                isPending={isOwnerMutatePending}
                isConfirming={isOwnerMutateConfirming}
                isConfirmed={isOwnerMutateConfirmed}
                error={ownerMutateError}
                onReset={resetOwnerMutate}
              />
            </div>
          )}

          <details className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <summary className="p-4 cursor-pointer text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">
              All Eligible Dates This Year ({mutationDates.allDatesThisYear.length})
            </summary>
            <div className="px-4 pb-4">
              <div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                {mutationDates.allDatesThisYear.map((d, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400">
                      {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200 text-xs">{d.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
