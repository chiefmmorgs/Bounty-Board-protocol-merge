'use client';

import { useFullReputation, useEthosUser, type ReputationScore } from '@/hooks';
import { tierColors, ReputationTier } from '@/config/abis';
import { formatEther } from 'viem';
import { getEthosScoreTier, formatVouchAmount } from '@/services/EthosApiService';

interface ReputationDisplayProps {
    address: `0x${string}` | undefined;
    compact?: boolean;
}

export function ReputationDisplay({ address, compact = false }: ReputationDisplayProps) {
    const { reputation, tier, tierName, disputeStats, isLoading: isLoadingOnChain, isError } = useFullReputation(address);
    const {
        user: ethosUser,
        score: ethosScore,
        isLoading: isLoadingEthos,
        profileLink,
        scoreBreakdownLink,
        reviewsReceived,
        vouchesReceived,
        xpTotal,
        xpStreakDays,
    } = useEthosUser(address);

    const isLoading = isLoadingOnChain || isLoadingEthos;

    if (!address) {
        return (
            <div className="card">
                <p className="text-bone-500 text-sm">Connect wallet to view reputation</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="card animate-pulse-subtle">
                <div className="h-6 bg-charcoal-600 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-charcoal-600 rounded w-1/2"></div>
            </div>
        );
    }

    const ethosTier = ethosScore !== null ? getEthosScoreTier(ethosScore) : null;

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                {ethosUser ? (
                    <>
                        <div className={`w-3 h-3 rounded-full ${ethosTier?.bgColor ?? 'bg-charcoal-500'}`} />
                        <span className={`font-medium ${ethosTier?.color ?? 'text-bone-500'}`}>
                            {ethosTier?.tier ?? 'Unknown'}
                        </span>
                        <span className="text-bone-600">•</span>
                        <span className="text-bone-400">{ethosScore}/2000</span>
                    </>
                ) : (
                    <>
                        <div className="w-3 h-3 rounded-full bg-charcoal-500" />
                        <span className="text-bone-300 font-medium">{tierName ?? 'Unrated'}</span>
                        <span className="text-bone-600">•</span>
                        <span className="text-bone-400">{reputation?.overallScore ?? 0}/100</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="card">
            {/* Ethos Score Section - Primary */}
            {ethosUser ? (
                <>
                    {/* Ethos Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            {ethosUser.avatarUrl && (
                                <img
                                    src={ethosUser.avatarUrl}
                                    alt={ethosUser.displayName}
                                    className="w-10 h-10 rounded-full"
                                />
                            )}
                            <div>
                                <h3 className="text-lg font-light text-bone-200">
                                    {ethosUser.displayName || ethosUser.username || 'Ethos User'}
                                </h3>
                                {ethosUser.username && (
                                    <p className="text-sm text-bone-500">@{ethosUser.username}</p>
                                )}
                            </div>
                        </div>
                        <a
                            href={profileLink ?? `https://ethos.network/profile/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
                        >
                            View on Ethos →
                        </a>
                    </div>

                    {/* Ethos Score */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${ethosTier?.bgColor} ${ethosTier?.color}`}
                            >
                                {ethosTier?.tier}
                            </span>
                            {xpStreakDays > 0 && (
                                <span className="text-sm text-orange-400">
                                    🔥 {xpStreakDays} day streak
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-4xl font-light text-bone-100">{ethosScore}</span>
                            <span className="text-bone-500">/2000</span>
                        </div>
                        <div className="w-full bg-charcoal-600 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 bg-gold-400`}
                                style={{
                                    width: `${Math.min(100, (ethosScore / 2000) * 100)}%`,
                                }}
                            />
                        </div>
                        {scoreBreakdownLink && (
                            <a
                                href={scoreBreakdownLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-bone-500 hover:text-bone-400 mt-1 inline-block"
                            >
                                View score breakdown →
                            </a>
                        )}
                    </div>

                    {/* Ethos Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">Reviews</p>
                            <div className="flex items-center justify-center gap-1">
                                <span className="text-green-400">+{reviewsReceived.positive}</span>
                                <span className="text-bone-700">/</span>
                                <span className="text-bone-500">{reviewsReceived.neutral}</span>
                                <span className="text-bone-700">/</span>
                                <span className="text-red-400">-{reviewsReceived.negative}</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">Vouches</p>
                            <p className="text-lg font-light text-bone-200">{vouchesReceived.count}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">XP</p>
                            <p className="text-lg font-light text-gold-400">{xpTotal.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Vouch Amount */}
                    {vouchesReceived.amountWeiTotal > 0 && (
                        <div className="bg-charcoal-700 rounded-lg p-3 mb-6">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">Total Vouched</p>
                            <p className="text-xl font-light text-green-400">
                                {formatVouchAmount(vouchesReceived.amountWeiTotal)}
                            </p>
                        </div>
                    )}

                    {/* Divider before on-chain stats */}
                    <div className="border-t border-charcoal-500 pt-4 mt-4">
                        <p className="text-xs text-bone-600 uppercase tracking-wider mb-3">On-Chain Stats</p>
                    </div>
                </>
            ) : (
                <>
                    {/* Fallback: No Ethos Profile */}
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-light text-bone-200">Reputation</h3>
                        <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-charcoal-600 text-bone-300 border border-charcoal-500">
                            {tierName ?? 'Unrated'}
                        </div>
                    </div>

                    <div className="bg-gold-400/10 border border-gold-400/30 rounded-lg p-3 mb-6">
                        <p className="text-gold-400 text-sm">
                            ⚠️ No Ethos profile found.{' '}
                            <a
                                href="https://ethos.network"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-gold-300"
                            >
                                Create one
                            </a>{' '}
                            to build your reputation.
                        </p>
                    </div>
                </>
            )}

            {/* On-Chain Reputation (shown for all users) */}
            {reputation && (
                <>
                    {/* On-Chain Score Breakdown */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <ScoreCard label="Quality" score={reputation.qualityScore} />
                        <ScoreCard label="Reliability" score={reputation.reliabilityScore} />
                        <ScoreCard label="Professionalism" score={reputation.professionalismScore} />
                    </div>

                    {/* On-Chain Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-charcoal-500">
                        <div className="min-w-0">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1 truncate">Bounties Completed</p>
                            <p className="text-xl font-light text-bone-200 truncate">{reputation?.totalBountiesCompleted?.toString() ?? '0'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1 truncate">Total Earnings</p>
                            <p className="text-xl font-light text-bone-200 truncate">
                                {parseFloat(formatEther(reputation?.totalEarnings ?? BigInt(0))).toFixed(4)} ETH
                            </p>
                        </div>
                    </div>

                    {/* Dispute Stats */}
                    {disputeStats && (disputeStats.initiated > BigInt(0) || disputeStats.lost > BigInt(0)) && (
                        <div className="mt-4 pt-4 border-t border-charcoal-500">
                            <p className="text-bone-600 text-xs uppercase tracking-wider mb-2">Dispute History</p>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-bone-400">
                                    Win Rate: <span className="text-green-400 font-medium">{disputeStats.winRate.toString()}%</span>
                                </span>
                                <span className="text-charcoal-500">|</span>
                                <span className="text-sm text-bone-400">
                                    Disputes: {disputeStats.initiated.toString()}
                                </span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* No on-chain reputation yet */}
            {!reputation && ethosUser && (
                <div className="text-center py-4">
                    <p className="text-bone-500 text-sm">
                        Complete bounties to build your on-chain reputation!
                    </p>
                </div>
            )}
        </div>
    );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
    return (
        <div className="text-center min-w-0">
            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1 truncate">{label}</p>
            <p className="text-2xl font-light text-bone-200 truncate">{score}</p>
        </div>
    );
}
