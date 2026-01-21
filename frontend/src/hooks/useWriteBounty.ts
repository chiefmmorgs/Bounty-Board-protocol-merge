'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { contracts } from '@/config/contracts';
import { bountyRegistryAbi } from '@/config/abis';
import { parseEther, keccak256, toBytes } from 'viem';
import { useState, useCallback, useEffect } from 'react';

export type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'error';

export interface TransactionState {
    status: TransactionStatus;
    hash: `0x${string}` | undefined;
    error: Error | null;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
}

/**
 * Hook for creating a new bounty
 */
export function useCreateBounty() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const [txState, setTxState] = useState<TransactionState>({
        status: 'idle',
        hash: undefined,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
    });

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    // Update state based on transaction progress
    useEffect(() => {
        if (isPending) {
            setTxState({
                status: 'pending',
                hash: undefined,
                error: null,
                isLoading: true,
                isSuccess: false,
                isError: false,
            });
        } else if (hash && isConfirming) {
            setTxState({
                status: 'confirming',
                hash,
                error: null,
                isLoading: true,
                isSuccess: false,
                isError: false,
            });
        } else if (isConfirmed) {
            setTxState({
                status: 'confirmed',
                hash,
                error: null,
                isLoading: false,
                isSuccess: true,
                isError: false,
            });
        } else if (writeError || confirmError) {
            setTxState({
                status: 'error',
                hash,
                error: (writeError || confirmError) as Error,
                isLoading: false,
                isSuccess: false,
                isError: true,
            });
        }
    }, [isPending, hash, isConfirming, isConfirmed, writeError, confirmError]);

    const createBounty = useCallback(
        async (params: {
            requirementsHash: string;
            deadline: Date;
            minRepRequired: number;
            maxRevisions: number;
            reviewPeriodHours: number;
            escrowAmount: string; // ETH as string
        }) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            // Convert requirements to bytes32 hash
            const reqHash = params.requirementsHash.startsWith('0x')
                ? (params.requirementsHash as `0x${string}`)
                : keccak256(toBytes(params.requirementsHash));

            // Convert deadline to unix timestamp
            const deadlineTimestamp = BigInt(Math.floor(params.deadline.getTime() / 1000));

            // Convert review period from hours to seconds
            const reviewPeriodSeconds = BigInt(params.reviewPeriodHours * 3600);

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'createBounty',
                args: [
                    reqHash,
                    deadlineTimestamp,
                    BigInt(params.minRepRequired),
                    BigInt(params.maxRevisions),
                    reviewPeriodSeconds,
                ],
                value: parseEther(params.escrowAmount),
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    return {
        createBounty,
        ...txState,
        reset: () => {
            reset();
            setTxState({
                status: 'idle',
                hash: undefined,
                error: null,
                isLoading: false,
                isSuccess: false,
                isError: false,
            });
        },
    };
}

/**
 * Hook for claiming a bounty
 */
export function useClaimBounty() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const claimBounty = useCallback(
        async (bountyId: bigint | number) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'claimBounty',
                args: [BigInt(bountyId)],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        claimBounty,
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
 * Hook for requesting cancellation (moderated - 1 week review period)
 */
export function useRequestCancellation() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const requestCancellation = useCallback(
        async (bountyId: bigint | number, reasonHash: `0x${string}`) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'requestCancellation',
                args: [BigInt(bountyId), reasonHash],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        requestCancellation,
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
 * Hook for approving cancellation (moderator only)
 */
export function useApproveCancellation() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const approveCancellation = useCallback(
        async (bountyId: bigint | number) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'approveCancellation',
                args: [BigInt(bountyId)],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        approveCancellation,
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
 * Hook for rejecting cancellation (moderator only)
 */
export function useRejectCancellation() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const rejectCancellation = useCallback(
        async (bountyId: bigint | number, rejectReasonHash: `0x${string}`) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'rejectCancellation',
                args: [BigInt(bountyId), rejectReasonHash],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        rejectCancellation,
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
 * Hook for processing expired cancellation (auto-approval after 7 days)
 */
export function useProcessExpiredCancellation() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const processExpiredCancellation = useCallback(
        async (bountyId: bigint | number) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            writeContract({
                address: contracts.bountyRegistry,
                abi: bountyRegistryAbi,
                functionName: 'processExpiredCancellation',
                args: [BigInt(bountyId)],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        processExpiredCancellation,
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

