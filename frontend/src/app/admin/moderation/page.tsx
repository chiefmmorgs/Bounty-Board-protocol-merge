'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components';
import { usePrivyUser, useIsModerator, useBounty, useCancellationRequest, useApproveCancellation, useRejectCancellation, useFormattedCountdown } from '@/hooks';
import { useBountyCount, useBounties } from '@/hooks';
import { BountyStatus, statusNames } from '@/config/abis';
import { formatEther, keccak256, toBytes } from 'viem';
import Link from 'next/link';

export default function ModerationPage() {
    const { walletAddress: address, isAuthenticated } = usePrivyUser();
    const { isModerator, isLoading: isCheckingRole } = useIsModerator(address);
    const { count: totalBounties, isLoading: isCountLoading } = useBountyCount();

    // Fetch all bounties to filter pending cancellations
    const bountyIds = [];
    for (let i = 1; i <= Number(totalBounties); i++) {
        bountyIds.push(BigInt(i));
    }
    const { bounties, isLoading: isLoadingBounties } = useBounties(bountyIds);

    // Filter to PendingCancellation status (7)
    const pendingCancellations = bounties.filter(b => b.status === BountyStatus.PendingCancellation);

    const isLoading = isCountLoading || isLoadingBounties || isCheckingRole;

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="card text-center py-12">
                        <h2 className="text-xl font-light text-bone-200 mb-4">Authentication Required</h2>
                        <p className="text-bone-500">Please connect your wallet to access moderation.</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    // Not a moderator
    if (!isCheckingRole && !isModerator) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="card text-center py-12">
                        <h2 className="text-xl font-light text-red-400 mb-4">Access Denied</h2>
                        <p className="text-bone-500 mb-6">
                            You do not have the MODERATOR_ROLE required to access this page.
                        </p>
                        <Link href="/" className="text-gold-400 hover:text-gold-300">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-light text-bone-200 mb-2">Moderation Dashboard</h1>
                    <p className="text-bone-500">
                        Review and process pending cancellation requests.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="card text-center">
                        <p className="text-bone-500 text-sm mb-1">Pending Requests</p>
                        <p className="text-2xl font-light text-orange-400">{pendingCancellations.length}</p>
                    </div>
                    <div className="card text-center">
                        <p className="text-bone-500 text-sm mb-1">Total Bounties</p>
                        <p className="text-2xl font-light text-bone-200">{totalBounties.toString()}</p>
                    </div>
                    <div className="card text-center">
                        <p className="text-bone-500 text-sm mb-1">Your Role</p>
                        <p className="text-2xl font-light text-green-400">Moderator</p>
                    </div>
                </div>

                {/* Pending Cancellations List */}
                <div className="card">
                    <h2 className="text-lg font-light text-bone-200 mb-6">Pending Cancellation Requests</h2>

                    {isLoading ? (
                        <div className="animate-pulse space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-24 bg-charcoal-600 rounded-lg" />
                            ))}
                        </div>
                    ) : pendingCancellations.length === 0 ? (
                        <div className="text-center py-12 text-bone-500">
                            <p>No pending cancellation requests.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingCancellations.map((bounty) => (
                                <CancellationRequestCard key={bounty.bountyId.toString()} bounty={bounty} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

interface CancellationCardProps {
    bounty: {
        bountyId: bigint;
        client: `0x${string}`;
        escrowAmount: bigint;
        deadline: bigint;
    };
}

function CancellationRequestCard({ bounty }: CancellationCardProps) {
    const { cancellationRequest, isExpired, timeRemaining } = useCancellationRequest(bounty.bountyId);
    const { approveCancellation, isLoading: isApproving, isSuccess: approveSuccess } = useApproveCancellation();
    const { rejectCancellation, isLoading: isRejecting, isSuccess: rejectSuccess } = useRejectCancellation();
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);

    const formattedCountdown = useFormattedCountdown(timeRemaining);

    const handleApprove = async () => {
        await approveCancellation(bounty.bountyId);
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        const reasonHash = keccak256(toBytes(rejectReason));
        await rejectCancellation(bounty.bountyId, reasonHash);
    };

    // If processed, remove from view
    if (approveSuccess || rejectSuccess) {
        return null;
    }

    return (
        <div className="p-4 bg-charcoal-700 rounded-lg border border-charcoal-500">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <Link
                        href={`/bounty/${bounty.bountyId.toString()}`}
                        className="text-gold-400 hover:text-gold-300 font-medium"
                    >
                        Bounty #{bounty.bountyId.toString()}
                    </Link>
                    <p className="text-bone-500 text-sm mt-1">
                        {parseFloat(formatEther(bounty.escrowAmount)).toFixed(4)} ETH
                    </p>
                </div>
                <div className="text-right">
                    <span className={`text-sm ${isExpired ? 'text-red-400' : 'text-orange-400'}`}>
                        {isExpired ? 'Review period expired' : formattedCountdown}
                    </span>
                </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                    <p className="text-bone-600">Requester</p>
                    <p className="text-bone-400 font-mono truncate">{cancellationRequest?.requester}</p>
                </div>
                <div>
                    <p className="text-bone-600">Requested At</p>
                    <p className="text-bone-400">
                        {cancellationRequest ? new Date(Number(cancellationRequest.requestedAt) * 1000).toLocaleString() : '—'}
                    </p>
                </div>
            </div>

            {/* Reason Hash */}
            <div className="mb-4 p-3 bg-charcoal-800 rounded">
                <p className="text-bone-600 text-xs mb-1">Reason Hash</p>
                <p className="text-bone-500 text-xs font-mono truncate">{cancellationRequest?.reasonHash}</p>
            </div>

            {/* Actions */}
            {showRejectForm ? (
                <div className="space-y-3">
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="w-full h-20 px-3 py-2 bg-charcoal-800 border border-charcoal-500 rounded-lg 
                                 text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:outline-none text-sm resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowRejectForm(false)}
                            className="flex-1 px-4 py-2 bg-charcoal-600 text-bone-300 rounded-lg 
                                     hover:bg-charcoal-500 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={isRejecting || !rejectReason.trim()}
                            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg 
                                     hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                        >
                            {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-3">
                    <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg 
                                 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                        {isApproving ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg 
                                 hover:bg-red-500/30 transition-colors"
                    >
                        Reject
                    </button>
                </div>
            )}
        </div>
    );
}
