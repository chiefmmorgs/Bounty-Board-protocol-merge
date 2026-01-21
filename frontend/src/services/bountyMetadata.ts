/**
 * Bounty Metadata Storage Service
 * 
 * Stores bounty title and description in localStorage, keyed by requirementsHash.
 * This allows the frontend to display bounty content that was hashed before submission.
 */

const STORAGE_KEY = 'bounty_metadata';

export interface BountyMetadata {
    title: string;
    description: string;
    createdAt: number;     // Unix timestamp
    creator: string;       // Wallet address
}

interface MetadataStore {
    [hash: string]: BountyMetadata;
}

/**
 * Get all stored metadata
 */
function getStore(): MetadataStore {
    if (typeof window === 'undefined') return {};

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Failed to parse bounty metadata store:', e);
        return {};
    }
}

/**
 * Save the entire store
 */
function saveStore(store: MetadataStore): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        console.error('Failed to save bounty metadata store:', e);
    }
}

/**
 * Save metadata for a bounty by its requirements hash
 */
export function saveBountyMetadata(hash: string, metadata: BountyMetadata): void {
    const store = getStore();
    store[hash.toLowerCase()] = metadata;
    saveStore(store);
}

/**
 * Get metadata for a bounty by its requirements hash
 */
export function getBountyMetadata(hash: string): BountyMetadata | null {
    const store = getStore();
    return store[hash.toLowerCase()] || null;
}

/**
 * Check if metadata exists for a hash
 */
export function hasBountyMetadata(hash: string): boolean {
    const store = getStore();
    return hash.toLowerCase() in store;
}

/**
 * Delete metadata for a bounty (cleanup)
 */
export function deleteBountyMetadata(hash: string): void {
    const store = getStore();
    delete store[hash.toLowerCase()];
    saveStore(store);
}

/**
 * Get all stored metadata (for debugging/admin)
 */
export function getAllBountyMetadata(): MetadataStore {
    return getStore();
}

/**
 * Clear all stored metadata (for debugging)
 */
export function clearAllBountyMetadata(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
