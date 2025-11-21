'use client';

interface PreviewOption {
  id: number;
  seed: bigint;
  metadata: string;
}

interface PreviewCardProps {
  preview: PreviewOption;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PreviewCard({ preview, isSelected, onSelect }: PreviewCardProps) {
  const metadata = JSON.parse(preview.metadata);

  return (
    <div
      onClick={onSelect}
      className={`
        cursor-pointer border-2 rounded-lg p-4 transition-all
        ${isSelected 
          ? 'border-purple-500 bg-purple-900/20 shadow-lg shadow-purple-500/50' 
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
        }
      `}
    >
      {/* Preview Image Placeholder */}
      <div className="aspect-square bg-gray-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
        {/* In production, this would render the actual p5.js generated image */}
        <div className="text-center p-4">
          <div className="text-4xl mb-2">🎨</div>
          <p className="text-xs text-gray-400">Preview #{preview.id + 1}</p>
          <p className="text-xs text-gray-500 mt-2">Seed: {preview.seed.toString().slice(0, 10)}...</p>
        </div>
      </div>

      {/* Metadata Preview */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Circles:</span>
          <span>{metadata.circles}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Lines:</span>
          <span>{metadata.lines}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Colors:</span>
          <span>{metadata.selectedColors.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Palette:</span>
          <span className="capitalize">{metadata.palette}</span>
        </div>
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="mt-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-600">
            ✓ Selected
          </span>
        </div>
      )}
    </div>
  );
}

