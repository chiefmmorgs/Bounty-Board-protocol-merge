'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell, ClaimBountyButton, SubmitWorkForm, ReviewSubmissionPanel, RequestCancellationModal, CancellationStatus } from '@/components';
import { useBounty, useBountyAssignment, useEscrowBalance, useFullReputation, useEthosUser } from '@/hooks';
import { BountyStatus, statusNames, statusColors, SubmissionStatus } from '@/config/abis';
import { formatEther } from 'viem';
import Link from 'next/link';
import { useReadContract } from 'wagmi';
import { usePrivyUser } from '@/hooks';
import { contracts } from '@/config/contracts';
import { submissionManagerAbi } from '@/config/abis';
import { getBountyMetadata } from '@/services/bountyMetadata';

// Convert platform score (0-100) to Ethos score (0-2000)
function platformToEthosScore(platformScore: number | bigint): number {
    return Number(platformScore) * 20;
}

export default function BountyDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const bountyId = id ? BigInt(id) : BigInt(0);

    const { walletAddress: address, isAuthenticated: isConnected } = usePrivyUser();
    const [showSubmitForm, setShowSubmitForm] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const { bounty, statusName, isLoading, isError, refetch } = useBounty(bountyId);
    const { freelancer, isAssigned } = useBountyAssignment(bountyId);
    const { balanceFormatted: escrowBalanceFormatted } = useEscrowBalance(bountyId);
    const { score: userEthosScore } = useEthosUser(address);
    const { score: clientEthosScore } = useEthosUser(bounty?.client);
    const { score: freelancerEthosScore } = useEthosUser(freelancer || undefined);

    // Fetch submission for this bounty
    const { data: submissionId } = useReadContract({
        address: contracts.submissionManager,
        abi: submissionManagerAbi,
        functionName: 'bountyToSubmission',
        args: [bountyId],
        query: { enabled: !!bountyId && bountyId > BigInt(0) },
    });

    const { data: submissionData } = useReadContract({
        address: contracts.submissionManager,
        abi: submissionManagerAbi,
        functionName: 'submissions',
        args: submissionId ? [submissionId] : undefined,
        query: { enabled: !!submissionId && submissionId > BigInt(0) },
    });

    // Parse submission data
    const submission = submissionData ? {
        submissionId: submissionData[0],
        bountyId: submissionData[1],
        freelancer: submissionData[2],
        status: submissionData[3] as SubmissionStatus,
        revisionCount: submissionData[4],
        submittedAt: submissionData[5],
        reviewStartedAt: submissionData[6],
        workHash: submissionData[7],
        clientFeedbackHash: submissionData[8],
    } : null;

    if (!id) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="card text-center py-12">
                        <h2 className="text-xl font-light text-bone-200 mb-4">Invalid Bounty ID</h2>
                        <Link href="/" className="text-gold-400 hover:text-gold-300">
                            Back to Bounties
                        </Link>
                    </div>
                </div>
            </AppShell>
        );
    }

    if (isLoading) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="animate-pulse-subtle space-y-6">
                        <div className="h-8 bg-charcoal-600 rounded w-1/4"></div>
                        <div className="h-48 bg-charcoal-700 rounded-xl"></div>
                        <div className="h-32 bg-charcoal-700 rounded-xl"></div>
                    </div>
                </div>
            </AppShell>
        );
    }

    if (isError || !bounty || bounty.bountyId === BigInt(0)) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="card text-center py-12">
                        <h2 className="text-xl font-light text-red-400 mb-4">Bounty Not Found</h2>
                        <p className="text-bone-500 mb-6">
                            This bounty does not exist or may have been deleted.
                        </p>
                        <Link
                            href="/"
                            className="text-gold-400 hover:text-gold-300"
                        >
                            Back to Bounties
                        </Link>
                    </div>
                </div>
            </AppShell>
        );
    }

    const status = bounty.status as BountyStatus;
    const statusColor = statusColors[status];
    const deadline = new Date(Number(bounty.deadline) * 1000);
    const createdAt = new Date(Number(bounty.createdAt) * 1000);
    const isExpired = deadline < new Date() && status === BountyStatus.Open;
    const isUserClient = isConnected && address?.toLowerCase() === bounty.client.toLowerCase();
    const isUserFreelancer = isConnected && freelancer && address?.toLowerCase() === freelancer.toLowerCase();

    // Convert platform minRepRequired to Ethos score
    const minEthosScore = platformToEthosScore(bounty.minRepRequired);

    // Calculate net payment
    const netPaymentWei = bounty.escrowAmount - bounty.platformFee;
    const netPaymentEth = parseFloat(formatEther(netPaymentWei)).toFixed(4);

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-6 py-10">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm mb-6">
                    <Link href="/" className="text-bone-500 hover:text-bone-300 transition-colors">
                        Bounties
                    </Link>
                    <span className="text-bone-700">/</span>
                    <span className="text-bone-300">#{bountyId.toString()}</span>
                </div>

                {/* Main Card */}
                <div className="card mb-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-6 border-b border-charcoal-500">
                        <div>
                            <p className="text-bone-500 text-sm mb-1">Bounty #{bountyId.toString()}</p>
                            {(() => {
                                const metadata = getBountyMetadata(bounty.requirementsHash);
                                return metadata ? (
                                    <>
                                        <h1 className="text-2xl font-light text-bone-200">
                                            {metadata.title}
                                        </h1>
                                        <p className="text-gold-400 mt-1">
                                            {parseFloat(formatEther(bounty.escrowAmount)).toFixed(4)} ETH (Net: {netPaymentEth} ETH)
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h1 className="text-2xl font-light text-bone-200">
                                            {parseFloat(formatEther(bounty.escrowAmount)).toFixed(4)} ETH
                                        </h1>
                                        <p className="text-gold-400 mt-1">
                                            Net: {netPaymentEth} ETH
                                        </p>
                                    </>
                                );
                            })()}
                        </div>
                        <div
                            className="self-start px-4 py-2 rounded-full text-sm font-medium"
                            style={{
                                backgroundColor: `${statusColor}20`,
                                color: statusColor,
                                border: `1px solid ${statusColor}60`,
                            }}
                        >
                            {isExpired ? 'Expired' : statusName}
                        </div>
                    </div>

                    {/* Description Section */}
                    {(() => {
                        const metadata = getBountyMetadata(bounty.requirementsHash);
                        return metadata?.description ? (
                            <div className="mb-6 pb-6 border-b border-charcoal-500">
                                <h2 className="text-sm font-medium text-bone-400 mb-3 tracking-wide uppercase">
                                    Description
                                </h2>
                                <div className="text-bone-300 whitespace-pre-wrap">
                                    {metadata.description}
                                </div>
                            </div>
                        ) : null;
                    })()}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <DetailCell label="Min Ethos Score" value={`${minEthosScore}/2000`} />
                        <DetailCell label="Max Revisions" value={Number(bounty.maxRevisions).toString()} />
                        <DetailCell
                            label="Deadline"
                            value={deadline.toLocaleDateString()}
                            highlight={isExpired}
                        />
                        <DetailCell
                            label="Review Period"
                            value={`${Number(bounty.reviewPeriod) / 3600}h`}
                        />
                    </div>

                    {/* Participants */}
                    <div className="space-y-4">
                        {/* Client */}
                        <div className="flex items-center justify-between p-4 bg-charcoal-700 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-charcoal-500 flex items-center justify-center">
                                    <span className="text-bone-300 font-bold text-sm">C</span>
                                </div>
                                <div>
                                    <p className="text-bone-500 text-xs">Client</p>
                                    <p className="text-bone-200 font-mono">
                                        {bounty.client.slice(0, 8)}...{bounty.client.slice(-6)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-bone-500 text-xs">Ethos Score</p>
                                <p className="text-gold-400">{clientEthosScore ?? '—'}</p>
                            </div>
                            {isUserClient && (
                                <span className="ml-3 text-xs text-gold-400 border border-gold-400/50 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}
                        </div>

                        {/* Freelancer (if assigned) */}
                        {isAssigned && freelancer && (
                            <div className="flex items-center justify-between p-4 bg-charcoal-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-600/30 flex items-center justify-center">
                                        <span className="text-green-400 font-bold text-sm">F</span>
                                    </div>
                                    <div>
                                        <p className="text-bone-500 text-xs">Freelancer</p>
                                        <p className="text-bone-200 font-mono">
                                            {freelancer.slice(0, 8)}...{freelancer.slice(-6)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-bone-500 text-xs">Ethos Score</p>
                                    <p className="text-gold-400">{freelancerEthosScore ?? '—'}</p>
                                </div>
                                {isUserFreelancer && (
                                    <span className="ml-3 text-xs text-green-400 border border-green-400/50 px-2 py-0.5 rounded">
                                        You
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Escrow Status */}
                        <div className="p-4 bg-gold-400/10 border border-gold-400/30 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                                    <span className="text-gold-400">Escrow Balance</span>
                                </div>
                                <span className="text-bone-200 font-medium">{escrowBalanceFormatted} ETH</span>
                            </div>
                        </div>

                        {/* Requirements Hash */}
                        <div>
                            <p className="text-bone-500 text-sm mb-2">Requirements Hash (IPFS)</p>
                            <p className="text-bone-600 text-xs font-mono p-3 bg-charcoal-700 rounded-lg break-all">
                                {bounty.requirementsHash}
                            </p>
                        </div>

                        {/* Timestamps */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-charcoal-500">
                            <div>
                                <p className="text-bone-600 text-xs">Created</p>
                                <p className="text-bone-300">{createdAt.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-bone-600 text-xs">Deadline</p>
                                <p className={isExpired ? 'text-red-400' : 'text-bone-300'}>
                                    {deadline.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="space-y-4">
                    {/* Claim Button - for freelancers on open bounties */}
                    {status === BountyStatus.Open && !isUserClient && (
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Claim This Bounty
                            </h3>
                            <ClaimBountyButton
                                bounty={bounty}
                                userReputation={userEthosScore || 0}
                                onSuccess={() => refetch()}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Submit Work - for assigned freelancer */}
                    {isUserFreelancer && (status === BountyStatus.InProgress || status === BountyStatus.UnderReview) && (
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Submit Your Work
                            </h3>
                            {showSubmitForm ? (
                                <SubmitWorkForm
                                    bountyId={bountyId}
                                    onSuccess={() => {
                                        setShowSubmitForm(false);
                                        refetch();
                                    }}
                                    onCancel={() => setShowSubmitForm(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowSubmitForm(true)}
                                    className="w-full btn-gold"
                                >
                                    Submit Work
                                </button>
                            )}
                        </div>
                    )}

                    {/* Pending Cancellation Status */}
                    {status === BountyStatus.PendingCancellation && (
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Cancellation Status
                            </h3>
                            <CancellationStatus
                                bountyId={bountyId}
                                isClient={isUserClient}
                                onProcessed={() => refetch()}
                            />
                        </div>
                    )}

                    {/* Cancel Bounty - for client on Open/InProgress bounties */}
                    {isUserClient && (status === BountyStatus.Open || status === BountyStatus.InProgress) && (
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Cancel Bounty
                            </h3>
                            <p className="text-bone-500 text-sm mb-4">
                                Request to cancel this bounty. A 7-day moderation review period will apply.
                            </p>
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="w-full px-4 py-3 bg-red-500/20 text-red-400 rounded-lg 
                                         hover:bg-red-500/30 transition-colors border border-red-500/30"
                            >
                                Request Cancellation
                            </button>
                        </div>
                    )}

                    {/* Review Panel - for client when there's a submission */}
                    {isUserClient && submission && submission.submissionId > BigInt(0) && (
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Review Submission
                            </h3>

                            {/* Show work hash */}
                            <div className="mb-4 p-3 bg-charcoal-700 rounded-lg">
                                <p className="text-bone-500 text-xs mb-1">Work Hash</p>
                                <p className="text-bone-400 text-sm font-mono break-all">{submission.workHash}</p>
                            </div>

                            <ReviewSubmissionPanel
                                submission={submission}
                                bountyEscrow={bounty.escrowAmount - bounty.platformFee}
                                isClient={isUserClient}
                                onSuccess={() => refetch()}
                            />
                        </div>
                    )}

                    {/* Refresh Button */}
                    <div className="text-center">
                        <button
                            onClick={() => refetch()}
                            className="text-gold-400 hover:text-gold-300 text-sm transition-colors"
                        >
                            Refresh Data
                        </button>
                    </div>
                </div>

                {/* Cancellation Modal */}
                <RequestCancellationModal
                    bountyId={bountyId}
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    onSuccess={() => refetch()}
                />
            </div>
        </AppShell>
    );
}

function DetailCell({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="bg-charcoal-700 p-4 rounded-lg text-center">
            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className={`font-medium ${highlight ? 'text-red-400' : 'text-bone-200'}`}>{value}</p>
        </div>
    );
}
