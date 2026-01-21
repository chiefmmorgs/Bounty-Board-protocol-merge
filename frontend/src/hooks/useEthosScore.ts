'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEthosUserByAddress, type EthosUser } from '@/services/EthosApiService';

/**
 * Hook to fetch Ethos score for a wallet address
 */
export function useEthosScore(address: `0x${string}` | string | undefined) {
    const [user, setUser] = useState<EthosUser | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchScore = useCallback(async () => {
        if (!address) {
            setUser(null);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const ethosUser = await getEthosUserByAddress(address);
            setUser(ethosUser);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch Ethos score');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        fetchScore();
    }, [fetchScore]);

    return {
        // Main score (0-2000)
        score: user?.score ?? null,
        // Full user data
        user,
        // Loading state
        isLoading,
        // Error if any
        error,
        // Whether user exists on Ethos
        hasEthosProfile: user !== null,
        // Refetch function
        refetch: fetchScore,
    };
}

/**
 * Hook to get full Ethos user data with stats
 */
export function useEthosUser(address: `0x${string}` | string | undefined) {
    const { user, isLoading, error, refetch } = useEthosScore(address);

    return {
        user,
        isLoading,
        error,
        refetch,
        // Convenience accessors
        score: user?.score ?? 0,
        displayName: user?.displayName ?? null,
        username: user?.username ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        profileLink: user?.links?.profile ?? null,
        scoreBreakdownLink: user?.links?.scoreBreakdown ?? null,
        // Stats
        reviewsReceived: user?.stats?.review?.received ?? { positive: 0, neutral: 0, negative: 0 },
        vouchesReceived: user?.stats?.vouch?.received ?? { count: 0, amountWeiTotal: 0 },
        vouchesGiven: user?.stats?.vouch?.given ?? { count: 0, amountWeiTotal: 0 },
        // XP
        xpTotal: user?.xpTotal ?? 0,
        xpStreakDays: user?.xpStreakDays ?? 0,
    };
}

/**
 * Hook to check if an address meets minimum Ethos score requirement
 */
export function useEthosScoreCheck(
    address: `0x${string}` | string | undefined,
    minimumScore: number
) {
    const { score, isLoading, hasEthosProfile } = useEthosScore(address);

    return {
        meetsRequirement: hasEthosProfile && score !== null && score >= minimumScore,
        score,
        minimumScore,
        isLoading,
        hasEthosProfile,
        shortfall: score !== null ? Math.max(0, minimumScore - score) : minimumScore,
    };
}
