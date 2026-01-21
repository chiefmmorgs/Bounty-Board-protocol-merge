'use client';

import { useClaimBounty } from '@/hooks';
import { useAccount } from 'wagmi';
import { Bounty, BountyStatus } from '@/config/abis';

interface ClaimBountyButtonProps {
    bounty: Bounty;
    userReputation?: number; // This is now Ethos score (0-2000)
    onSuccess?: () => void;
    className?: string;
}

export function ClaimBountyButton({ bounty, userReputation = 0, onSuccess, className = '' }: ClaimBountyButtonProps) {
    const { isConnected, address } = useAccount();
    const { claimBounty, isLoading, isSuccess, isError, error, hash, reset } = useClaimBounty();

    // minRepRequired is already in Ethos score (0-2000)
    const minEthosScore = Number(bounty.minRepRequired);

    const canClaim =
        isConnected &&
        bounty.status === BountyStatus.Open &&
        address?.toLowerCase() !== bounty.client.toLowerCase() &&
        userReputation >= minEthosScore;

    const handleClaim = async () => {
        try {
            await claimBounty(bounty.bountyId);
            if (onSuccess) {
                setTimeout(onSuccess, 1000); // Wait a bit for UI update
            }
        } catch (err) {
            console.error('Claim error:', err);
        }
    };

    // Already claimed or in progress
    if (bounty.status !== BountyStatus.Open) {
        return null;
    }

    // User is the client
    if (address?.toLowerCase() === bounty.client.toLowerCase()) {
        return (
            <span className="text-bone-500 text-sm">You created this bounty</span>
        );
    }

    // Reputation too low
    if (userReputation < minEthosScore) {
        return (
            <div className="text-center">
                <span className="text-gold-400 text-sm block">
                    Requires {minEthosScore} Ethos Score
                </span>
                <span className="text-bone-500 text-xs">
                    Your score: {userReputation}
                </span>
            </div>
        );
    }

    // Success state
    if (isSuccess) {
        return (
            <div className="flex items-center gap-2 text-green-400">
                <span className="text-lg">✓</span>
                <div>
                    <span className="font-medium">Claimed!</span>
                    {hash && (
                        <a
                            href={`https://sepolia.basescan.org/tx/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-green-300 hover:underline"
                        >
                            View transaction
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // Error state
    if (isError && error) {
        return (
            <div className="space-y-2">
                <p className="text-red-400 text-sm">{error.message}</p>
                <button
                    onClick={reset}
                    className="text-xs text-bone-500 hover:text-bone-300 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleClaim}
            disabled={!canClaim || isLoading}
            className={`py-3 px-6 btn-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
        >
            {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                    <span>Claiming...</span>
                </>
            ) : (
                <span>Claim Bounty</span>
            )}
        </button>
    );
}
