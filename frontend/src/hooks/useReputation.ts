'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { contracts } from '@/config/contracts';
import { reputationOracleAbi, ReputationTier, tierNames } from '@/config/abis';

// Reputation score type matching contract struct
export interface ReputationScore {
    qualityScore: number;
    reliabilityScore: number;
    professionalismScore: number;
    overallScore: number;
    tier: number;
    totalBountiesCompleted: bigint;
    totalEarnings: bigint;
    disputesLost: bigint;
    lastUpdated: bigint;
}

/**
 * Hook to fetch user reputation data
 */
export function useReputation(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.reputationOracle,
        abi: reputationOracleAbi,
        functionName: 'getReputation',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    // Parse the result - wagmi returns the struct as an object
    const result = data as any;
    const reputation: ReputationScore | null = result
        ? {
            qualityScore: result.qualityScore,
            reliabilityScore: result.reliabilityScore,
            professionalismScore: result.professionalismScore,
            overallScore: result.overallScore,
            tier: result.tier,
            totalBountiesCompleted: result.totalBountiesCompleted,
            totalEarnings: result.totalEarnings,
            disputesLost: result.disputesLost,
            lastUpdated: result.lastUpdated,
        }
        : null;

    return {
        reputation,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch user reputation tier
 */
export function useReputationTier(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.reputationOracle,
        abi: reputationOracleAbi,
        functionName: 'getTier',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    const tier = data !== undefined ? (data as ReputationTier) : null;
    const tierName = tier !== null ? tierNames[tier] : null;

    return {
        tier,
        tierName,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch user dispute statistics
 */
export function useDisputeStats(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.reputationOracle,
        abi: reputationOracleAbi,
        functionName: 'getDisputeStats',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    const stats = data
        ? {
            initiated: data[0],
            lost: data[1],
            winRate: data[2],
        }
        : null;

    return {
        stats,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Combined hook for all reputation data
 */
export function useFullReputation(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContracts({
        contracts: address
            ? [
                {
                    address: contracts.reputationOracle,
                    abi: reputationOracleAbi,
                    functionName: 'getReputation',
                    args: [address],
                },
                {
                    address: contracts.reputationOracle,
                    abi: reputationOracleAbi,
                    functionName: 'getTier',
                    args: [address],
                },
                {
                    address: contracts.reputationOracle,
                    abi: reputationOracleAbi,
                    functionName: 'getDisputeStats',
                    args: [address],
                },
            ]
            : [],
        query: {
            enabled: !!address,
        },
    });

    const reputation: ReputationScore | null =
        data?.[0]?.result
            ? {
                qualityScore: (data[0].result as any)[0],
                reliabilityScore: (data[0].result as any)[1],
                professionalismScore: (data[0].result as any)[2],
                overallScore: (data[0].result as any)[3],
                tier: (data[0].result as any)[4],
                totalBountiesCompleted: (data[0].result as any)[5],
                totalEarnings: (data[0].result as any)[6],
                disputesLost: (data[0].result as any)[7],
                lastUpdated: (data[0].result as any)[8],
            }
            : null;

    const tier = data?.[1]?.result !== undefined ? (data[1].result as ReputationTier) : null;
    const tierName = tier !== null ? tierNames[tier] : null;

    const disputeStats = data?.[2]?.result
        ? {
            initiated: (data[2].result as any)[0] as bigint,
            lost: (data[2].result as any)[1] as bigint,
            winRate: (data[2].result as any)[2] as bigint,
        }
        : null;

    return {
        reputation,
        tier,
        tierName,
        disputeStats,
        isLoading,
        isError,
        error,
        refetch,
    };
}
