'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { contracts } from '@/config/contracts';
import { bountyRegistryAbi, Bounty, BountyStatus, statusNames } from '@/config/abis';

/**
 * Hook to fetch total bounty count
 */
export function useBountyCount() {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'bountyCounter',
    });

    return {
        count: data ?? BigInt(0),
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch a single bounty by ID
 */
export function useBounty(bountyId: bigint | number | undefined) {
    const id = bountyId !== undefined ? BigInt(bountyId) : undefined;

    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'getBounty',
        args: id !== undefined ? [id] : undefined,
        query: {
            enabled: id !== undefined && id > 0n,
        },
    });

    const bounty: Bounty | null = data
        ? {
            bountyId: data.bountyId,
            client: data.client,
            escrowAmount: data.escrowAmount,
            platformFee: data.platformFee,
            minRepRequired: data.minRepRequired,
            maxRevisions: data.maxRevisions,
            status: data.status as BountyStatus,
            deadline: data.deadline,
            createdAt: data.createdAt,
            reviewPeriod: data.reviewPeriod,
            requirementsHash: data.requirementsHash,
        }
        : null;

    return {
        bounty,
        statusName: bounty ? statusNames[bounty.status] : null,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch the assigned freelancer for a bounty
 */
export function useBountyAssignment(bountyId: bigint | number | undefined) {
    const id = bountyId !== undefined ? BigInt(bountyId) : undefined;

    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'bountyAssignments',
        args: id !== undefined ? [id] : undefined,
        query: {
            enabled: id !== undefined && id > 0n,
        },
    });

    const freelancer = data && data !== '0x0000000000000000000000000000000000000000' ? data : null;

    return {
        freelancer,
        isAssigned: !!freelancer,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch multiple bounties at once
 */
export function useBounties(bountyIds: (bigint | number)[]) {
    const ids = bountyIds.map((id) => BigInt(id));

    const { data, isLoading, isError, error, refetch } = useReadContracts({
        contracts: ids.map((id) => ({
            address: contracts.bountyRegistry,
            abi: bountyRegistryAbi,
            functionName: 'getBounty' as const,
            args: [id] as const,
        })),
        query: {
            enabled: ids.length > 0,
        },
    });

    const bounties: Bounty[] = (data ?? [])
        .map((result) => {
            if (result.status !== 'success' || !result.result) return null;
            const d = result.result;
            return {
                bountyId: d.bountyId,
                client: d.client,
                escrowAmount: d.escrowAmount,
                platformFee: d.platformFee,
                minRepRequired: d.minRepRequired,
                maxRevisions: d.maxRevisions,
                status: d.status as BountyStatus,
                deadline: d.deadline,
                createdAt: d.createdAt,
                reviewPeriod: d.reviewPeriod,
                requirementsHash: d.requirementsHash,
            } as Bounty;
        })
        .filter((b): b is Bounty => b !== null);

    return {
        bounties,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch user's active bounty count
 */
export function useActiveBountyCount(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'getActiveBountyCount',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    return {
        count: data ?? BigInt(0),
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to list recent bounties (fetches last N bounties)
 */
export function useRecentBounties(limit: number = 10) {
    const { count, isLoading: isCountLoading } = useBountyCount();

    // Generate IDs for the last `limit` bounties
    const startId = count > BigInt(limit) ? count - BigInt(limit) + 1n : 1n;
    const endId = count;
    const ids: bigint[] = [];

    for (let i = endId; i >= startId && i > 0n; i--) {
        ids.push(i);
        if (ids.length >= limit) break;
    }

    const { bounties, isLoading: isBountiesLoading, isError, error, refetch } = useBounties(ids);

    return {
        bounties,
        totalCount: count,
        isLoading: isCountLoading || isBountiesLoading,
        isError,
        error,
        refetch,
    };
}
