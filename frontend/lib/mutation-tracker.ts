// Track recently mutated tokens across pages using sessionStorage
// This allows other pages to know when they need to refresh cached content

const STORAGE_KEY = 'spatters-recent-mutations';

interface MutationRecord {
  tokenId: number;
  timestamp: number; // When the mutation was confirmed
}

export function markTokenMutated(tokenId: number): void {
  try {
    const records = getRecentMutations();
    
    // Update or add the record
    const existingIndex = records.findIndex(r => r.tokenId === tokenId);
    if (existingIndex >= 0) {
      records[existingIndex].timestamp = Date.now();
    } else {
      records.push({ tokenId, timestamp: Date.now() });
    }
    
    // Keep only last 50 records to avoid storage bloat
    const trimmed = records.slice(-50);
    
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save mutation record:', e);
  }
}

export function getRecentMutations(): MutationRecord[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as MutationRecord[];
  } catch {
    return [];
  }
}

export function wasTokenRecentlyMutated(tokenId: number, withinMs: number = 5 * 60 * 1000): boolean {
  const records = getRecentMutations();
  const record = records.find(r => r.tokenId === tokenId);
  if (!record) return false;
  return Date.now() - record.timestamp < withinMs;
}

export function getRecentlyMutatedTokenIds(withinMs: number = 5 * 60 * 1000): number[] {
  const records = getRecentMutations();
  const cutoff = Date.now() - withinMs;
  return records
    .filter(r => r.timestamp > cutoff)
    .map(r => r.tokenId);
}

export function clearMutationRecord(tokenId: number): void {
  try {
    const records = getRecentMutations();
    const filtered = records.filter(r => r.tokenId !== tokenId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to clear mutation record:', e);
  }
}

export function clearAllMutationRecords(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear mutation records:', e);
  }
}

