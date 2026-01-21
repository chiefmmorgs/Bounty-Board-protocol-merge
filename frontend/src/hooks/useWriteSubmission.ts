'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { contracts } from '@/config/contracts';
import { submissionManagerAbi } from '@/config/abis';
import { keccak256, toBytes } from 'viem';
import { useCallback } from 'react';

/**
 * Hook for submitting work
 */
export function useSubmitWork() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const submitWork = useCallback(
        async (bountyId: bigint | number, workHash: string) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            // Convert work hash to bytes32
            const hashBytes = workHash.startsWith('0x')
                ? (workHash as `0x${string}`)
                : keccak256(toBytes(workHash));

            writeContract({
                address: contracts.submissionManager,
                abi: submissionManagerAbi,
                functionName: 'submitWork',
                args: [BigInt(bountyId), hashBytes],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        submitWork,
        hash,
        isPending,
        isConfirming,
        isConfirmed,
        isLoading: isPending || isConfirming,
        isSuccess: isConfirmed,
        isError: !!error,
        error: error as Error | null,
        reset,
    };
}

/**
 * Hook for starting review
 */
export function useStartReview() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const startReview = useCallback(
        async (submissionId: bigint | number) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.submissionManager,
                abi: submissionManagerAbi,
                functionName: 'startReview',
                args: [BigInt(submissionId)],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        startReview,
        hash,
        isPending,
        isConfirming,
        isConfirmed,
        isLoading: isPending || isConfirming,
        isSuccess: isConfirmed,
        isError: !!error,
        error: error as Error | null,
        reset,
    };
}

/**
 * Hook for accepting a submission
 */
export function useAcceptSubmission() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const acceptSubmission = useCallback(
        async (submissionId: bigint | number, feedback: string = '') => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            // Convert feedback to bytes32 hash
            const feedbackHash = feedback
                ? keccak256(toBytes(feedback))
                : ('0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`);

            writeContract({
                address: contracts.submissionManager,
                abi: submissionManagerAbi,
                functionName: 'acceptSubmission',
                args: [BigInt(submissionId), feedbackHash],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        acceptSubmission,
        hash,
        isPending,
        isConfirming,
        isConfirmed,
        isLoading: isPending || isConfirming,
        isSuccess: isConfirmed,
        isError: !!error,
        error: error as Error | null,
        reset,
    };
}

/**
 * Hook for rejecting a submission
 */
export function useRejectSubmission() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const rejectSubmission = useCallback(
        async (submissionId: bigint | number, feedback: string) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            if (!feedback) {
                throw new Error('Feedback is required for rejection');
            }

            // Convert feedback to bytes32 hash
            const feedbackHash = keccak256(toBytes(feedback));

            writeContract({
                address: contracts.submissionManager,
                abi: submissionManagerAbi,
                functionName: 'rejectSubmission',
                args: [BigInt(submissionId), feedbackHash],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        rejectSubmission,
        hash,
        isPending,
        isConfirming,
        isConfirmed,
        isLoading: isPending || isConfirming,
        isSuccess: isConfirmed,
        isError: !!error,
        error: error as Error | null,
        reset,
    };
}
