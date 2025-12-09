'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';
import { getContractAddress } from '@/lib/config';
import SpattersABI from '@/contracts/Spatters.json';
import { markTokenMutated } from '@/lib/mutation-tracker';
import Navbar from '@/components/Navbar';

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

// Human-readable descriptions for each mutation
const MUTATION_DESCRIPTIONS: Record<string, string> = {
  // General
  aspectRatioChange: 'Change aspect ratio',
  baseRadiusIncrease: 'Increase base radius for points',
  baseRadiusDecrease: 'Decrease base radius for points',
  undoMutation: 'Undo last mutation',
  returnToPreviousVersion: 'Return to random previous version',
  dividerCountChange: 'Change number of colored sections',
  dividerMove: 'Move a limit between colored sections',
  dividerRotate: 'Change angles of a limit between colored sections',
  seedPointCountIncrease: 'Add points to shape',
  seedPointCountDecrease: 'Remove points from shape',
  
  // Shape
  rotate: 'Rotate shape',
  shapeExpand: 'Expand shape',
  shapeShrink: 'Shrink shape',
  shapeMakeWider: 'Make shape wider',
  shapeMakeNarrower: 'Make shape narrower',
  shapeMakeHigher: 'Make shape taller',
  shapeMakeShorter: 'Make shape shorter',
  shapeChangeCurveCenters: 'Change curve centers',
  shapeIncreaseConcavity: 'Increase whole shape concavity',
  shapeReduceConcavity: 'Reduce whole shape concavity',
  shapeChangeRadiuses: 'Change radiuses of points in whole shape',
  shapeMove: 'Move shape',
  
  // Colors
  gradientTypeChange: 'Change color blending mode',
  paletteChangeOne: 'Change one color from the palette',
  paletteChangeAll: 'Change all colors in the palette',
  paletteCombineOne: 'Blend one color with another in the palette',
  paletteCombineAll: 'Blend all colors in the palette',
  paletteResetOne: 'Reset one color in the palette to a default',
  paletteResetAll: 'Reset all colors in the palette to defaults',
  paletteShuffle: 'Shuffle the colors selected for the shape',
  
  // Circles
  circleCountChange: 'Change number of circles in shape',
  circleSizeIncrease: 'Increase size of a circle',
  circleSizeDecrease: 'Decrease size of a circle',
  circlePositionChange: 'Change a circle position',
  circleMoveLeft: 'Move a cricle left',
  circleMoveRight: 'Move a circle right',
  circleMoveUp: 'Move a circle up',
  circleMoveDown: 'Move a circle down',
  
  // Lines
  lineCountChange: 'Change number of lines in shape',
  lineWidthIncrease: 'Increase width of a line',
  lineWidthDecrease: 'Decrease width of a line',
  lineAngleChange: 'Change angle of a line',
  lineLengthIncrease: 'Increase length of a line',
  lineLengthDecrease: 'Decrease length of a line',
  linePositionChange: 'Change position of a line',
  lineMoveLeft: 'Move a line left',
  lineMoveRight: 'Move a line right',
  lineMoveUp: 'Move a line up',
  lineMoveDown: 'Move a line down',
  
  // Points - Any
  seedpointMoveRight: 'Move a point right',
  seedpointMoveLeft: 'Move a point left',
  seedpointMoveUp: 'Move a point up',
  seedpointMoveDown: 'Move a point down',
  seedpointChangeCurveCenter: 'Change a curve\'s center',
  seedpointIncreaseConcavity: 'Increase a curve\'s concavity',
  seedpointDecreaseConcavity: 'Decrease a curve\'s concavity',
  seedpointIncreaseRadius: 'Increase a point\'s radius',
  seedpointDecreaseRadius: 'Decrease a point\'s radius',
  
  // Points - Top
  'seedpointMoveRight-top': 'Move a point right',
  'seedpointMoveLeft-top': 'Move a point left',
  'seedpointMoveUp-top': 'Move a point up',
  'seedpointMoveDown-top': 'Move a point down',
  'seedpointChangeCurveCenter-top': 'Change a curve\'s center',
  'seedpointIncreaseConcavity-top': 'Increase a curve\'s concavity',
  'seedpointDecreaseConcavity-top': 'Decrease a curve\'s concavity',
  'seedpointIncreaseRadius-top': 'Increase a point\'s radius',
  'seedpointDecreaseRadius-top': 'Decrease a point\'s radius',
  
  // Points - Bottom
  'seedpointMoveRight-bottom': 'Move a point right',
  'seedpointMoveLeft-bottom': 'Move a point left',
  'seedpointMoveUp-bottom': 'Move a point up',
  'seedpointMoveDown-bottom': 'Move a point down',
  'seedpointChangeCurveCenter-bottom': 'Change a curve\'s center',
  'seedpointIncreaseConcavity-bottom': 'Increase a curve\'s concavity',
  'seedpointDecreaseConcavity-bottom': 'Decrease a curve\'s concavity',
  'seedpointIncreaseRadius-bottom': 'Increase a point\'s radius',
  'seedpointDecreaseRadius-bottom': 'Decrease a point\'s radius',
  
  // Points - Left
  'seedpointMoveRight-left': 'Move a point right',
  'seedpointMoveLeft-left': 'Move a point left',
  'seedpointMoveUp-left': 'Move a point up',
  'seedpointMoveDown-left': 'Move a point down',
  'seedpointChangeCurveCenter-left': 'Change a curve\'s center',
  'seedpointIncreaseConcavity-left': 'Increase a curve\'s concavity',
  'seedpointDecreaseConcavity-left': 'Decrease a curve\'s concavity',
  'seedpointIncreaseRadius-left': 'Increase a point\'s radius',
  'seedpointDecreaseRadius-left': 'Decrease a point\'s radius',
  
  // Points - Right
  'seedpointMoveRight-right': 'Move a point right',
  'seedpointMoveLeft-right': 'Move a point left',
  'seedpointMoveUp-right': 'Move a point up',
  'seedpointMoveDown-right': 'Move a point down',
  'seedpointChangeCurveCenter-right': 'Change a curve\'s center',
  'seedpointIncreaseConcavity-right': 'Increase a curve\'s concavity',
  'seedpointDecreaseConcavity-right': 'Decrease a curve\'s concavity',
  'seedpointIncreaseRadius-right': 'Increase a point\'s radius',
  'seedpointDecreaseRadius-right': 'Decrease a point\'s radius',
};

// Helper to get description or fallback to mutation name
const getMutationLabel = (mutation: string): string => {
  return MUTATION_DESCRIPTIONS[mutation] || mutation;
};

// Main mutation categories (6 high-level groups)
const MUTATION_GROUPS: Record<string, { label: string; emoji: string; mutations: string[] }> = {
  general: {
    label: 'General',
    emoji: '⚙️',
    mutations: [
      'aspectRatioChange', 'baseRadiusIncrease', 'baseRadiusDecrease',
      'undoMutation', 'returnToPreviousVersion', 'dividerCountChange',
      'dividerMove', 'dividerRotate', 'seedPointCountIncrease', 'seedPointCountDecrease',
    ],
  },
  shape: {
    label: 'Shape',
    emoji: '🔷',
    mutations: [
      'rotate', 'shapeExpand', 'shapeShrink', 'shapeMakeWider', 'shapeMakeNarrower',
      'shapeMakeHigher', 'shapeMakeShorter', 'shapeChangeCurveCenters',
      'shapeIncreaseConcavity', 'shapeReduceConcavity', 'shapeChangeRadiuses', 'shapeMove',
    ],
  },
  colors: {
    label: 'Colors',
    emoji: '🎨',
    mutations: [
      'gradientTypeChange', 'paletteChangeOne', 'paletteChangeAll', 'paletteCombineOne',
      'paletteCombineAll', 'paletteResetOne', 'paletteResetAll', 'paletteShuffle',
    ],
  },
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
      'linePositionChange', 'lineMoveLeft', 'lineMoveRight', 'lineMoveUp', 'lineMoveDown',
    ],
  },
};

// Points sub-categories (shown when "Points" is selected)
const POINTS_SUBGROUPS: Record<string, { label: string; emoji: string; mutations: string[] }> = {
  any: {
    label: 'Any',
    emoji: '🎯',
    mutations: [
      'seedpointMoveRight', 'seedpointMoveLeft', 'seedpointMoveUp', 'seedpointMoveDown',
      'seedpointChangeCurveCenter', 'seedpointIncreaseConcavity', 'seedpointDecreaseConcavity',
      'seedpointIncreaseRadius', 'seedpointDecreaseRadius',
    ],
  },
  top: {
    label: 'Top',
    emoji: '⬆️',
    mutations: [
      'seedpointMoveRight-top', 'seedpointMoveLeft-top', 'seedpointMoveUp-top', 'seedpointMoveDown-top',
      'seedpointChangeCurveCenter-top', 'seedpointIncreaseConcavity-top', 'seedpointDecreaseConcavity-top',
      'seedpointIncreaseRadius-top', 'seedpointDecreaseRadius-top',
    ],
  },
  bottom: {
    label: 'Bottom',
    emoji: '⬇️',
    mutations: [
      'seedpointMoveRight-bottom', 'seedpointMoveLeft-bottom', 'seedpointMoveUp-bottom', 'seedpointMoveDown-bottom',
      'seedpointChangeCurveCenter-bottom', 'seedpointIncreaseConcavity-bottom', 'seedpointDecreaseConcavity-bottom',
      'seedpointIncreaseRadius-bottom', 'seedpointDecreaseRadius-bottom',
    ],
  },
  left: {
    label: 'Left',
    emoji: '⬅️',
    mutations: [
      'seedpointMoveRight-left', 'seedpointMoveLeft-left', 'seedpointMoveUp-left', 'seedpointMoveDown-left',
      'seedpointChangeCurveCenter-left', 'seedpointIncreaseConcavity-left', 'seedpointDecreaseConcavity-left',
      'seedpointIncreaseRadius-left', 'seedpointDecreaseRadius-left',
    ],
  },
  right: {
    label: 'Right',
    emoji: '➡️',
    mutations: [
      'seedpointMoveRight-right', 'seedpointMoveLeft-right', 'seedpointMoveUp-right', 'seedpointMoveDown-right',
      'seedpointChangeCurveCenter-right', 'seedpointIncreaseConcavity-right', 'seedpointDecreaseConcavity-right',
      'seedpointIncreaseRadius-right', 'seedpointDecreaseRadius-right',
    ],
  },
};

// All points mutations count for display
const POINTS_TOTAL_COUNT = Object.values(POINTS_SUBGROUPS).reduce((sum, g) => sum + g.mutations.length, 0);

// Flat list for validation (all 94 mutations)
const MUTATION_TYPES = [
  ...Object.values(MUTATION_GROUPS).flatMap(g => g.mutations),
  ...Object.values(POINTS_SUBGROUPS).flatMap(g => g.mutations),
];

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
  const [selectedPointsSubgroup, setSelectedPointsSubgroup] = useState<string | null>(null);

  const handleMutationClick = (mutationType: string) => {
    onMutate(mutationType);
    setIsModalOpen(false);
    setSelectedGroup(null);
    setSelectedPointsSubgroup(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGroup(null);
    setSelectedPointsSubgroup(null);
  };

  const goBack = () => {
    if (selectedPointsSubgroup) {
      setSelectedPointsSubgroup(null);
    } else if (selectedGroup) {
      setSelectedGroup(null);
    }
  };

  // Determine current title for header
  const getHeaderTitle = () => {
    if (selectedPointsSubgroup) {
      const subgroup = POINTS_SUBGROUPS[selectedPointsSubgroup];
      return `${subgroup?.emoji} Points - ${subgroup?.label}`;
    }
    if (selectedGroup === 'points') {
      return '📍 Points';
    }
    if (selectedGroup) {
      const group = MUTATION_GROUPS[selectedGroup];
      return `${group?.emoji} ${group?.label}`;
    }
    return 'Select Mutation Type';
  };

  return (
    <div className="space-y-4">
      {isOwnerBypass && (
        <div className="border-2 p-3" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black, color: COLORS.white }}>
          <p className="font-medium">
            🔧 Contract Owner Bypass
          </p>
          <p className="text-sm">
            As contract owner, you can mutate at any time (testing only).
          </p>
        </div>
      )}

      {error && (
        <div className="border-2 p-3" style={{ backgroundColor: COLORS.red, borderColor: COLORS.black }}>
          <p className="text-sm" style={{ color: COLORS.white }}>
            Error: {(error as any)?.shortMessage || error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="border-2 p-3" style={{ backgroundColor: COLORS.green, borderColor: COLORS.black, color: COLORS.black }}>
          <p className="font-medium">
            ✓ Mutation Applied Successfully!
          </p>
          <p className="text-sm">
            The artwork will regenerate automatically.
          </p>
          <button 
            onClick={onReset}
            className="mt-2 text-sm underline font-medium"
            style={{ color: COLORS.black }}
          >
            Apply another mutation
          </button>
        </div>
      )}

      {!isConfirmed && (
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isPending || isConfirming}
          className="w-full font-bold py-3 px-4 border-2 transition-opacity hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: isOwnerBypass ? COLORS.red : COLORS.green, 
            borderColor: COLORS.black,
            color: isOwnerBypass ? COLORS.white : COLORS.black
          }}
        >
          {isPending || isConfirming ? 'Processing...' : '🧬 Mutate'}
        </button>
      )}

      {/* Mutation Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden border-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b-2" style={{ borderColor: COLORS.black }}>
              <h3 className="text-lg font-bold" style={{ color: COLORS.black }}>
                {(selectedGroup || selectedPointsSubgroup) ? (
                  <button 
                    onClick={goBack}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    style={{ color: COLORS.black }}
                  >
                    <span>←</span>
                    <span>{getHeaderTitle()}</span>
                  </button>
                ) : (
                  'Select Mutation Type'
                )}
              </h3>
              <button
                onClick={closeModal}
                className="text-2xl font-bold w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
                style={{ color: COLORS.black }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]" style={{ backgroundColor: COLORS.background }}>
              {!selectedGroup ? (
                /* Top-Level Group Selection (6 categories) */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(MUTATION_GROUPS).map(([key, group]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedGroup(key)}
                      className="flex flex-col items-center justify-center p-4 border-2 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
                    >
                      <span className="text-2xl mb-1">{group.emoji}</span>
                      <span className="text-sm font-medium" style={{ color: COLORS.black }}>{group.label}</span>
                      <span className="text-xs" style={{ color: COLORS.black, opacity: 0.7 }}>{group.mutations.length} options</span>
                    </button>
                  ))}
                  {/* Points - special category with sub-menu */}
                  <button
                    onClick={() => setSelectedGroup('points')}
                    className="flex flex-col items-center justify-center p-4 border-2 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
                  >
                    <span className="text-2xl mb-1">📍</span>
                    <span className="text-sm font-medium" style={{ color: COLORS.black }}>Points</span>
                    <span className="text-xs" style={{ color: COLORS.black, opacity: 0.7 }}>{POINTS_TOTAL_COUNT} options</span>
                  </button>
                </div>
              ) : selectedGroup === 'points' && !selectedPointsSubgroup ? (
                /* Points Sub-Group Selection */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(POINTS_SUBGROUPS).map(([key, subgroup]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPointsSubgroup(key)}
                      className="flex flex-col items-center justify-center p-4 border-2 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}
                    >
                      <span className="text-2xl mb-1">{subgroup.emoji}</span>
                      <span className="text-sm font-medium" style={{ color: COLORS.black }}>{subgroup.label}</span>
                      <span className="text-xs" style={{ color: COLORS.black, opacity: 0.7 }}>{subgroup.mutations.length} options</span>
                    </button>
                  ))}
                </div>
              ) : selectedGroup === 'points' && selectedPointsSubgroup ? (
                /* Points Mutation Selection */
                <div className="space-y-2">
                  {POINTS_SUBGROUPS[selectedPointsSubgroup]?.mutations.map((mutation) => (
                    <button
                      key={mutation}
                      onClick={() => handleMutationClick(mutation)}
                      className="w-full text-left px-4 py-3 border-2 transition-opacity hover:opacity-80"
                      style={{ 
                        backgroundColor: isOwnerBypass ? COLORS.red : COLORS.green, 
                        borderColor: COLORS.black,
                        color: isOwnerBypass ? COLORS.white : COLORS.black
                      }}
                    >
                      <span className="font-medium">{getMutationLabel(mutation)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                /* Regular Group Mutation Selection */
                <div className="space-y-2">
                  {MUTATION_GROUPS[selectedGroup]?.mutations.map((mutation) => (
                    <button
                      key={mutation}
                      onClick={() => handleMutationClick(mutation)}
                      className="w-full text-left px-4 py-3 border-2 transition-opacity hover:opacity-80"
                      style={{ 
                        backgroundColor: isOwnerBypass ? COLORS.red : COLORS.green, 
                        borderColor: COLORS.black,
                        color: isOwnerBypass ? COLORS.white : COLORS.black
                      }}
                    >
                      <span className="font-medium">{getMutationLabel(mutation)}</span>
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
    let pollInterval: NodeJS.Timeout | null = null;
    let isCancelled = false;
    
    if (isMutateConfirmed || isOwnerMutateConfirmed) {
      // Mark token as recently mutated (for other pages to detect)
      markTokenMutated(tokenId);
      
      // Set waiting status
      setRegenerationStatus('waiting');
      setRegenerationMessage('Triggering artwork regeneration...');
      
      // The expected mutation count AFTER this mutation
      // Current count + 1 (the mutation we just made)
      const currentMutationCount = existingMutations ? (existingMutations as any[]).length : 0;
      const expectedMutationCount = currentMutationCount + 1;
      
      console.log(`[Mutate] Mutation confirmed. Current: ${currentMutationCount}, Expected after regen: ${expectedMutationCount}`);
      
      // Trigger pixel regeneration
      fetch('/api/trigger-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, event: 'token-mutated' }),
      }).then((response) => {
        if (isCancelled) return;
        
        console.log('[Mutate] Trigger response:', response.status);
        setRegenerationMessage('Waiting for artwork to regenerate (this may take 1-2 minutes)...');
        
        // Start polling for completion
        let pollCount = 0;
        const maxPolls = 60; // Poll for up to 5 minutes (60 * 5s)
        
        pollInterval = setInterval(async () => {
          if (isCancelled) {
            if (pollInterval) clearInterval(pollInterval);
            return;
          }
          
          pollCount++;
          
          try {
            // Add timestamp to prevent any caching
            const response = await fetch(`/api/pixel-status/${tokenId}?t=${Date.now()}`, { 
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            
            console.log(`[Mutate] Poll #${pollCount}:`, {
              exists: data.exists,
              cachedMutationCount: data.cachedMutationCount,
              expectedMutationCount,
              lastModified: data.lastModified
            });
            
            // Check if cached mutation count matches expected
            // This is more reliable than timestamp comparison
            if (data.exists && data.cachedMutationCount !== null && data.cachedMutationCount >= expectedMutationCount) {
              // File has been regenerated with the new mutation!
              console.log('[Mutate] Regeneration complete! Cached count matches expected.');
              
              if (pollInterval) clearInterval(pollInterval);
              pollInterval = null;
              
              if (isCancelled) return;
              
              setRegenerationStatus('ready');
              setRegenerationMessage('Artwork regenerated! Refreshing page...');
              
              // Full page reload to ensure all caches are bypassed
              setTimeout(() => {
                window.location.reload();
              }, 1500);
              
              return;
            }
            
            // Update progress message
            if (pollCount % 6 === 0) { // Every 30 seconds
              if (!isCancelled) {
                setRegenerationMessage(`Still waiting for regeneration... (${Math.floor(pollCount * 5 / 60)} min elapsed)`);
              }
            }
            
          } catch (error) {
            console.error('[Mutate] Polling error:', error);
          }
          
          // Stop polling after max attempts
          if (pollCount >= maxPolls) {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
            if (!isCancelled) {
              setRegenerationStatus('error');
              setRegenerationMessage('Regeneration taking longer than expected. Please refresh manually in a few minutes.');
            }
          }
        }, 5000); // Poll every 5 seconds
        
      }).catch((error) => {
        console.error('[Mutate] Trigger error:', error);
        if (!isCancelled) {
          setRegenerationStatus('error');
          setRegenerationMessage('Failed to trigger regeneration. Please try refreshing the page.');
        }
      });
    }
    
    // Cleanup on unmount or dependency change
    return () => {
      isCancelled = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isMutateConfirmed, isOwnerMutateConfirmed, tokenId, existingMutations]);

  const isLoading = isLoadingOwner || isLoadingToken;
  const isTokenOwner = ownerAddress && address && 
    (ownerAddress as string).toLowerCase() === address.toLowerCase();
  const isContractOwner = contractOwner && address && 
    (contractOwner as string).toLowerCase() === address.toLowerCase();
  const mutationCount = existingMutations ? (existingMutations as any[]).length : 0;

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center p-8 border-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
            <h1 className="text-2xl font-black mb-4" style={{ color: COLORS.black }}>Connect Wallet</h1>
            <p style={{ color: COLORS.black }}>
              Please connect your wallet to access mutations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin h-12 w-12 border-4 border-t-transparent" style={{ borderColor: COLORS.red, borderTopColor: 'transparent' }}></div>
        </div>
      </div>
    );
  }

  // Not owner
  if (!isTokenOwner) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center p-8 border-2 max-w-md" style={{ backgroundColor: COLORS.white, borderColor: COLORS.red }}>
            <h1 className="text-2xl font-black mb-4" style={{ color: COLORS.red }}>Access Denied</h1>
            <p className="mb-6" style={{ color: COLORS.black }}>
              You do not own Spatter #{tokenId}. Only the owner can access the mutation page.
            </p>
            <Link href="/my-spatters" className="font-bold hover:opacity-70" style={{ color: COLORS.blue }}>
              ← Back to My Spatters
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <Navbar />
      <header className="border-b-2 px-4 py-3 sticky top-[65px] z-10" style={{ backgroundColor: COLORS.background, borderColor: COLORS.black }}>
        <div className="flex justify-between items-center">
          <Link href="/my-spatters" className="text-sm font-medium hover:opacity-70" style={{ color: COLORS.black }}>
            ← Back to My Spatters
          </Link>
          <h1 className="text-lg font-black" style={{ color: COLORS.black }}>
            Mutate Spatter #{tokenId}
          </h1>
          <Link href={`/token/${tokenId}`} className="text-sm font-medium hover:opacity-70" style={{ color: COLORS.blue }}>
            View Token →
          </Link>
        </div>
      </header>

      {/* Regeneration Status Banner */}
      {regenerationStatus !== 'idle' && (
        <div 
          className="px-4 py-3 text-center border-b-2"
          style={{ 
            backgroundColor: regenerationStatus === 'waiting' ? COLORS.yellow : regenerationStatus === 'ready' ? COLORS.green : COLORS.red,
            borderColor: COLORS.black,
            color: regenerationStatus === 'waiting' ? COLORS.black : COLORS.black
          }}
        >
          <div className="flex items-center justify-center gap-2 font-medium">
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
        <div className="w-full xl:w-[1200px] xl:flex-shrink-0" style={{ backgroundColor: COLORS.white }}>
          <iframe
            key={iframeKey}
            src={`${baseUrl}/api/token/${tokenId}?c=${contractAddress?.slice(-8) || ''}&v=${iframeKey}`}
            className="border-0 w-full"
            scrolling="no"
            style={{ 
              height: `${iframeHeight}px`,
              maxWidth: '1200px',
              overflow: 'hidden',
            }}
            title={`Spatter #${tokenId}`}
          />
          <div className="text-center text-sm py-2 border-t-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black, color: COLORS.black }}>
            Click artwork to cycle through mutation history • Mutations: {mutationCount}
          </div>
        </div>

        <div 
          className="flex-1 p-4 xl:p-6 xl:overflow-y-auto space-y-4"
          style={{ maxHeight: iframeHeight ? `${iframeHeight + 40}px` : undefined, backgroundColor: COLORS.background }}
        >
          <div className="border-2 p-4" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
            <h2 className="text-base font-bold mb-3" style={{ color: COLORS.black }}>
              Next Mutation Dates
            </h2>
            <div className="space-y-2">
              {mutationDates.upcomingDates.length === 0 && (
                <p className="text-sm" style={{ color: COLORS.black, opacity: 0.7 }}>
                  No eligible dates available.
                </p>
              )}
              {mutationDates.upcomingDates.map((d, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-2" style={{ backgroundColor: COLORS.background, borderColor: COLORS.blue }}>
                  <span className="font-medium text-sm" style={{ color: COLORS.blue }}>
                    {formatMutationDate(d.date)}
                  </span>
                  <span className="text-xs" style={{ color: COLORS.blue }}>{d.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 p-4" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
            <h2 className="text-base font-bold mb-3" style={{ color: COLORS.black }}>
              Mutations
            </h2>
            {(canMutateContract as boolean) ? (
              <div className="space-y-4">
                <div className="border-2 p-3" style={{ backgroundColor: COLORS.green, borderColor: COLORS.black }}>
                  <p className="font-medium text-sm" style={{ color: COLORS.black }}>
                    ✓ Mutation Available Today!
                  </p>
                  {mutationDates.todayReason && (
                    <p className="text-xs" style={{ color: COLORS.black }}>
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
              <div className="border-2 p-3" style={{ backgroundColor: COLORS.yellow, borderColor: COLORS.black }}>
                <p className="font-medium text-sm" style={{ color: COLORS.black }}>
                  Mutation Not Available Today
                </p>
                <p className="text-xs" style={{ color: COLORS.black }}>
                  Check the schedule above for the next eligible date.
                </p>
              </div>
            )}
          </div>

          {Boolean(isContractOwner) && (
            <div className="border-2 p-4" style={{ backgroundColor: COLORS.white, borderColor: COLORS.red }}>
              <h2 className="text-base font-bold mb-3" style={{ color: COLORS.red }}>
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

          <details className="border-2" style={{ backgroundColor: COLORS.white, borderColor: COLORS.black }}>
            <summary className="p-4 cursor-pointer text-base font-bold hover:opacity-70" style={{ color: COLORS.black }}>
              All Eligible Dates This Year ({mutationDates.allDatesThisYear.length})
            </summary>
            <div className="px-4 pb-4">
              <div className="max-h-48 overflow-y-auto p-3 border-t-2" style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}>
                {mutationDates.allDatesThisYear.map((d, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm border-b last:border-0" style={{ borderColor: COLORS.black }}>
                    <span style={{ color: COLORS.black }}>
                      {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs" style={{ color: COLORS.black }}>{d.reason}</span>
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
