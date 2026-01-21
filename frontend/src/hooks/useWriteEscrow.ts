'use client';

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { contracts } from '@/config/contracts';
import { paymentEscrowAbi } from '@/config/abis';
import { parseEther } from 'viem';
import { useCallback } from 'react';

/**
 * Hook for withdrawing freelancer balance
 */
export function useWithdraw() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
        hash,
    });

    const withdraw = useCallback(
        async (amount: string | bigint) => {
            if (!isConnected || !address) {
                throw new Error('Wallet not connected');
            }

            if (chainId !== 84532) {
                throw new Error('Please switch to Base Sepolia');
            }

            const amountWei = typeof amount === 'string' ? parseEther(amount) : amount;

            writeContract({
                address: contracts.paymentEscrow,
                abi: paymentEscrowAbi,
                functionName: 'withdraw',
                args: [amountWei],
            });
        },
        [writeContract, isConnected, address, chainId]
    );

    const error = writeError || confirmError;

    return {
        withdraw,
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
