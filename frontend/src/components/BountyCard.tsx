'use client';

import { Bounty, BountyStatus, statusNames, statusColors } from '@/config/abis';
import { useBountyAssignment } from '@/hooks';
import { formatEther } from 'viem';
import Link from 'next/link';
import { getBountyMetadata } from '@/services/bountyMetadata';

// Convert platform score (0-100) to Ethos score (0-2000)
function platformToEthosScore(platformScore: number | bigint): number {
    return Number(platformScore) * 20;
}

interface BountyCardProps {
    bounty: Bounty;
    showDetails?: boolean;
}

export function BountyCard({ bounty, showDetails = false }: BountyCardProps) {
    const { freelancer, isAssigned } = useBountyAssignment(bounty.bountyId);

    // Look up stored metadata
    const metadata = getBountyMetadata(bounty.requirementsHash);

    const status = bounty.status as BountyStatus;
    const statusName = statusNames[status];
    const statusColor = statusColors[status];

    const deadline = new Date(Number(bounty.deadline) * 1000);
    const createdAt = new Date(Number(bounty.createdAt) * 1000);
    const isExpired = deadline < new Date() && status === BountyStatus.Open;

    const escrowEth = formatEther(bounty.escrowAmount);
    const netPaymentWei = bounty.escrowAmount - bounty.platformFee;
    const netPayment = formatEther(netPaymentWei);

    // Convert platform minRepRequired to Ethos score
    const minEthosScore = platformToEthosScore(bounty.minRepRequired);

    // Truncate title if too long
    const displayTitle = metadata?.title
        ? (metadata.title.length > 50 ? metadata.title.slice(0, 47) + '...' : metadata.title)
        : `${parseFloat(escrowEth).toFixed(4)} ETH Bounty`;

    return (
        <Link href={`/bounty/${bounty.bountyId}`}>
            <div className="group card hover:border-charcoal-400 transition-all duration-200 cursor-pointer">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-bone-600 text-xs mb-1">Bounty #{bounty.bountyId.toString()}</p>
                        <h3 className="text-lg font-light text-bone-200 group-hover:text-gold-400 transition-colors">
                            {displayTitle}
                        </h3>
                        {metadata && (
                            <p className="text-gold-400 text-sm mt-1">
                                {parseFloat(escrowEth).toFixed(4)} ETH
                            </p>
                        )}
                    </div>
                    <div
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                            backgroundColor: `${statusColor}20`,
                            color: statusColor,
                            border: `1px solid ${statusColor}40`,
                        }}
                    >
                        {isExpired ? 'Expired' : statusName}
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <InfoItem
                        label="Net Payment"
                        value={`${parseFloat(netPayment).toFixed(4)} ETH`}
                    />
                    <InfoItem
                        label="Min Ethos"
                        value={`${minEthosScore}/2000`}
                    />
                    <InfoItem
                        label="Deadline"
                        value={deadline.toLocaleDateString()}
                        highlight={isExpired}
                    />
                    <InfoItem
                        label="Max Revisions"
                        value={Number(bounty.maxRevisions).toString()}
                    />
                </div>

                {/* Client & Assignment */}
                <div className="flex items-center justify-between pt-3 border-t border-charcoal-500">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-charcoal-500" />
                        <span className="text-bone-500 text-sm">
                            {bounty.client.slice(0, 6)}...{bounty.client.slice(-4)}
                        </span>
                    </div>

                    {isAssigned && freelancer && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-green-400 text-xs">Claimed</span>
                        </div>
                    )}
                </div>

                {/* Additional Details (if expanded) */}
                {showDetails && (
                    <div className="mt-4 pt-4 border-t border-charcoal-500 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-bone-600">Platform Fee</span>
                            <span className="text-bone-400">{formatEther(bounty.platformFee)} ETH</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-bone-600">Review Period</span>
                            <span className="text-bone-400">{Number(bounty.reviewPeriod) / 3600} hours</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-bone-600">Created</span>
                            <span className="text-bone-400">{createdAt.toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-bone-600">Requirements Hash</span>
                            <p className="text-bone-600 text-xs font-mono mt-1 break-all">
                                {bounty.requirementsHash}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
}

function InfoItem({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div>
            <p className="text-bone-600 text-xs uppercase tracking-wider">{label}</p>
            <p className={`font-medium ${highlight ? 'text-red-400' : 'text-bone-300'}`}>
                {value}
            </p>
        </div>
    );
}
