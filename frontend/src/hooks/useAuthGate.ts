'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePrivyUser } from './usePrivyUser';
import { useEthosScoreCheck } from './useEthosScore';

// Minimum Ethos score required for platform access (0-2000 scale)
const MINIMUM_ETHOS_SCORE = 400;

export type AuthStatus =
    | 'unauthenticated'
    | 'connecting'
    | 'checking'
    | 'blocked'
    | 'authenticated';

export interface AuthGateState {
    status: AuthStatus;
    walletAddress: `0x${string}` | undefined;
    ethosScore: number | null;
    meetsRequirement: boolean;
    isLoading: boolean;
    blockReason?: string;
}

/**
 * Hook to manage authentication + reputation gating
 * Combines Privy wallet auth with Ethos score verification
 */
export function useAuthGate(): AuthGateState {
    const { walletAddress, isAuthenticated, isReady } = usePrivyUser();
    const { meetsRequirement, score, isLoading: scoreLoading, hasEthosProfile, shortfall } =
        useEthosScoreCheck(walletAddress, MINIMUM_ETHOS_SCORE);

    const [hasCheckedScore, setHasCheckedScore] = useState(false);

    // Track when score check completes
    useEffect(() => {
        if (walletAddress && !scoreLoading) {
            setHasCheckedScore(true);
        }
    }, [walletAddress, scoreLoading]);

    // Reset when wallet disconnects
    useEffect(() => {
        if (!isAuthenticated) {
            setHasCheckedScore(false);
        }
    }, [isAuthenticated]);

    return useMemo(() => {
        // Not ready yet
        if (!isReady) {
            return {
                status: 'unauthenticated',
                walletAddress: undefined,
                ethosScore: null,
                meetsRequirement: false,
                isLoading: true,
            };
        }

        // Not authenticated
        if (!isAuthenticated || !walletAddress) {
            return {
                status: 'unauthenticated',
                walletAddress: undefined,
                ethosScore: null,
                meetsRequirement: false,
                isLoading: false,
            };
        }

        // Checking score
        if (scoreLoading || !hasCheckedScore) {
            return {
                status: 'checking',
                walletAddress,
                ethosScore: null,
                meetsRequirement: false,
                isLoading: true,
            };
        }

        // Blocked - doesn't meet requirements
        if (!meetsRequirement) {
            let blockReason: string;

            if (!hasEthosProfile) {
                blockReason = 'No Ethos profile found. Create one at ethos.network to access the platform.';
            } else {
                blockReason = `Your Ethos score (${score}) is below the minimum required (${MINIMUM_ETHOS_SCORE}). You need ${shortfall} more points.`;
            }

            return {
                status: 'blocked',
                walletAddress,
                ethosScore: score,
                meetsRequirement: false,
                isLoading: false,
                blockReason,
            };
        }

        // Authenticated and meets requirements
        return {
            status: 'authenticated',
            walletAddress,
            ethosScore: score,
            meetsRequirement: true,
            isLoading: false,
        };
    }, [isReady, isAuthenticated, walletAddress, scoreLoading, hasCheckedScore, meetsRequirement, hasEthosProfile, score, shortfall]);
}

/**
 * Get the minimum required Ethos score
 */
export function getMinimumEthosScore(): number {
    return MINIMUM_ETHOS_SCORE;
}
