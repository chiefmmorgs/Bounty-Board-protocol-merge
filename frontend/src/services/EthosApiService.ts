/**
 * Ethos Network API v2 Service
 * Fetches real user reputation scores from Ethos Network
 */

const ETHOS_API_BASE = 'https://api.ethos.network/api/v2';

/**
 * Ethos user data as returned by the API
 */
export interface EthosUser {
    id: number;
    profileId: number;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    description: string | null;
    score: number; // 0-2000 scale
    status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
    userkeys: string[];
    xpTotal: number;
    xpStreakDays: number;
    xpRemovedDueToAbuse: boolean;
    influenceFactor: number;
    influenceFactorPercentile: number;
    links: {
        profile: string;
        scoreBreakdown: string;
    };
    stats: {
        review: {
            received: {
                negative: number;
                neutral: number;
                positive: number;
            };
        };
        vouch: {
            given: {
                amountWeiTotal: number;
                count: number;
            };
            received: {
                amountWeiTotal: number;
                count: number;
            };
        };
    };
}

/**
 * Get a user by Ethereum address
 */
export async function getEthosUserByAddress(address: string): Promise<EthosUser | null> {
    try {
        const response = await fetch(`${ETHOS_API_BASE}/user/by/address/${address}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (response.status === 404) {
            // User not found on Ethos - this is normal for new users
            return null;
        }

        if (!response.ok) {
            throw new Error(`Ethos API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch Ethos user:', error);
        return null;
    }
}

/**
 * Get multiple users by Ethereum addresses (batch)
 */
export async function getEthosUsersByAddresses(addresses: string[]): Promise<Map<string, EthosUser>> {
    try {
        const response = await fetch(`${ETHOS_API_BASE}/users/by/address`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ addresses }),
        });

        if (!response.ok) {
            throw new Error(`Ethos API error: ${response.status}`);
        }

        const users: EthosUser[] = await response.json();
        const result = new Map<string, EthosUser>();

        // Match users back to addresses via userkeys
        for (const user of users) {
            for (const key of user.userkeys) {
                // Userkeys may include addresses in various formats
                if (key.toLowerCase().startsWith('0x')) {
                    result.set(key.toLowerCase(), user);
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Failed to batch fetch Ethos users:', error);
        return new Map();
    }
}

/**
 * Get a user by Twitter/X username or account ID
 */
export async function getEthosUserByTwitter(usernameOrId: string): Promise<EthosUser | null> {
    try {
        const response = await fetch(`${ETHOS_API_BASE}/user/by/x/${usernameOrId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Ethos API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch Ethos user by Twitter:', error);
        return null;
    }
}

/**
 * Get a user by Discord user ID
 */
export async function getEthosUserByDiscord(discordId: string): Promise<EthosUser | null> {
    try {
        const response = await fetch(`${ETHOS_API_BASE}/user/by/discord/${discordId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Ethos API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch Ethos user by Discord:', error);
        return null;
    }
}

/**
 * Search users by query string
 */
export async function searchEthosUsers(
    query: string,
    options?: {
        limit?: number;
        offset?: number;
        userKeyType?: 'ADDRESS' | 'DISCORD' | 'FARCASTER' | 'GITHUB' | 'TELEGRAM' | 'TWITTER' | 'PROFILE';
    }
): Promise<{ users: EthosUser[]; total: number }> {
    try {
        const params = new URLSearchParams({ query });
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());
        if (options?.userKeyType) params.set('userKeyType', options.userKeyType);

        const response = await fetch(`${ETHOS_API_BASE}/users/search?${params}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Ethos API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            users: data.values || [],
            total: data.total || 0,
        };
    } catch (error) {
        console.error('Failed to search Ethos users:', error);
        return { users: [], total: 0 };
    }
}

/**
 * Calculate score tier from Ethos score (0-2000)
 */
export function getEthosScoreTier(score: number): {
    tier: 'Untrusted' | 'Low' | 'Neutral' | 'Reputable' | 'Highly Reputable' | 'Exemplary';
    color: string;
    bgColor: string;
} {
    if (score < 400) {
        return { tier: 'Untrusted', color: 'text-red-500', bgColor: 'bg-red-500/20' };
    } else if (score < 700) {
        return { tier: 'Low', color: 'text-orange-500', bgColor: 'bg-orange-500/20' };
    } else if (score < 1000) {
        return { tier: 'Neutral', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20' };
    } else if (score < 1400) {
        return { tier: 'Reputable', color: 'text-green-500', bgColor: 'bg-green-500/20' };
    } else if (score < 1800) {
        return { tier: 'Highly Reputable', color: 'text-emerald-500', bgColor: 'bg-emerald-500/20' };
    } else {
        return { tier: 'Exemplary', color: 'text-cyan-400', bgColor: 'bg-cyan-400/20' };
    }
}

/**
 * Format Ethos vouch amount from wei
 */
export function formatVouchAmount(weiAmount: number): string {
    const eth = weiAmount / 1e18;
    if (eth >= 1) {
        return `${eth.toFixed(2)} ETH`;
    } else if (eth >= 0.001) {
        return `${(eth * 1000).toFixed(2)} mETH`;
    } else {
        return `${weiAmount.toLocaleString()} wei`;
    }
}
