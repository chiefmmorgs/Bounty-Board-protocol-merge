'use client';

import { useReadContract } from 'wagmi';
import { contracts } from '@/config/contracts';
import { bountyRegistryAbi, CancellationRequest } from '@/config/abis';

/**
 * Hook to check if user has moderator role
 */
export function useIsModerator(address: `0x${string}` | undefined) {
    // First get the MODERATOR_ROLE bytes32
    const { data: moderatorRole } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'MODERATOR_ROLE',
    });

    const { data: hasRole, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'hasRole',
        args: moderatorRole && address ? [moderatorRole, address] : undefined,
        query: {
            enabled: !!moderatorRole && !!address,
        },
    });

    return {
        isModerator: hasRole ?? false,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch cancellation request for a bounty
 */
export function useCancellationRequest(bountyId: bigint | number | undefined) {
    const id = bountyId !== undefined ? BigInt(bountyId) : undefined;

    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'getCancellationRequest',
        args: id !== undefined ? [id] : undefined,
        query: {
            enabled: id !== undefined && id > BigInt(0),
        },
    });

    const cancellationRequest: CancellationRequest | null = data && data.requestedAt > BigInt(0)
        ? {
            bountyId: data.bountyId,
            requester: data.requester,
            requestedAt: data.requestedAt,
            reviewDeadline: data.reviewDeadline,
            reasonHash: data.reasonHash,
            processed: data.processed,
            approved: data.approved,
        }
        : null;

    // Calculate time remaining until auto-approval
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeRemaining = cancellationRequest && !cancellationRequest.processed
        ? Number(cancellationRequest.reviewDeadline - now)
        : 0;
    const isExpired = timeRemaining <= 0 && cancellationRequest && !cancellationRequest.processed;

    return {
        cancellationRequest,
        isExpired,
        timeRemaining, // seconds
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch the cancellation review period constant
 */
export function useCancellationReviewPeriod() {
    const { data, isLoading, isError, error } = useReadContract({
        address: contracts.bountyRegistry,
        abi: bountyRegistryAbi,
        functionName: 'CANCELLATION_REVIEW_PERIOD',
    });

    return {
        reviewPeriod: data ?? BigInt(7 * 24 * 60 * 60), // default 7 days
        reviewPeriodDays: data ? Number(data) / (24 * 60 * 60) : 7,
        isLoading,
        isError,
        error,
    };
}

/**
 * Hook to format time remaining as human readable string
 */
export function useFormattedCountdown(seconds: number): string {
    if (seconds <= 0) return 'Expired';

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
        return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
    } else {
        return `${minutes}m remaining`;
    }
}
