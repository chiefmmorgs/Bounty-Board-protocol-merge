'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { contracts } from '@/config/contracts';
import { paymentEscrowAbi, EscrowAccount } from '@/config/abis';
import { formatEther } from 'viem';

/**
 * Hook to fetch escrow balance for a specific bounty
 */
export function useEscrowBalance(bountyId: bigint | number | undefined) {
    const id = bountyId !== undefined ? BigInt(bountyId) : undefined;

    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.paymentEscrow,
        abi: paymentEscrowAbi,
        functionName: 'escrowBalance',
        args: id !== undefined ? [id] : undefined,
        query: {
            enabled: id !== undefined && id > 0n,
        },
    });

    return {
        balance: data ?? 0n,
        balanceFormatted: data ? formatEther(data) : '0',
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch a user's escrow account
 */
export function useEscrowAccount(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.paymentEscrow,
        abi: paymentEscrowAbi,
        functionName: 'escrowAccounts',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    const account: EscrowAccount | null = data
        ? {
            totalDeposited: data[0],
            availableBalance: data[1],
            lockedAmount: data[2],
        }
        : null;

    return {
        account,
        totalDeposited: account?.totalDeposited ?? 0n,
        availableBalance: account?.availableBalance ?? 0n,
        lockedAmount: account?.lockedAmount ?? 0n,
        totalDepositedFormatted: account ? formatEther(account.totalDeposited) : '0',
        availableBalanceFormatted: account ? formatEther(account.availableBalance) : '0',
        lockedAmountFormatted: account ? formatEther(account.lockedAmount) : '0',
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch a freelancer's available balance
 */
export function useFreelancerBalance(address: `0x${string}` | undefined) {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        address: contracts.paymentEscrow,
        abi: paymentEscrowAbi,
        functionName: 'freelancerBalances',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    return {
        balance: data ?? 0n,
        balanceFormatted: data ? formatEther(data) : '0',
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook to fetch platform fee information
 */
export function usePlatformFees() {
    const { data, isLoading, isError, error, refetch } = useReadContracts({
        contracts: [
            {
                address: contracts.paymentEscrow,
                abi: paymentEscrowAbi,
                functionName: 'platformFeePercentage',
            },
            {
                address: contracts.paymentEscrow,
                abi: paymentEscrowAbi,
                functionName: 'platformFeeBalance',
            },
        ],
    });

    const feePercentage = data?.[0]?.result ?? 0n;
    const feeBalance = data?.[1]?.result ?? 0n;

    return {
        feePercentage: Number(feePercentage) / 100, // Convert basis points to percentage
        feeBalance,
        feeBalanceFormatted: feeBalance ? formatEther(feeBalance) : '0',
        isLoading,
        isError,
        error,
        refetch,
    };
}
