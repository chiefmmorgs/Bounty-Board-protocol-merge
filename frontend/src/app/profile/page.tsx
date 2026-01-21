'use client';

import { PrivyLoginButton, ReputationDisplay, SocialConnections, WithdrawButton } from '@/components';
import { useFullReputation, useActiveBountyCount, useEscrowAccount, useFreelancerBalance, usePrivyUser, useEthosUser } from '@/hooks';
import { AppShell } from '@/components';
import Link from 'next/link';
import { formatEther } from 'viem';

export default function ProfilePage() {
    const { walletAddress: address, isAuthenticated: isConnected, privyUserId, email } = usePrivyUser();
    const { reputation, tier, tierName, disputeStats, isLoading } = useFullReputation(address);
    const { count: activeBountyCount } = useActiveBountyCount(address);
    const { account: escrowAccount } = useEscrowAccount(address);
    const { balance: freelancerBalance, balanceFormatted } = useFreelancerBalance(address);
    const { user: ethosUser, score: ethosScore, profileLink, xpStreakDays } = useEthosUser(address);

    // Show connect prompt if not authenticated
    if (!isConnected) {
        return (
            <AppShell>
                <div className="max-w-4xl mx-auto px-6 py-20 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-charcoal-700 flex items-center justify-center">
                        <span className="text-2xl">👤</span>
                    </div>
                    <h1 className="text-2xl font-light text-bone-200 mb-4">Connect Your Wallet</h1>
                    <p className="text-bone-500 mb-8">
                        Connect your wallet to view your profile, reputation, and bounty activity.
                    </p>
                    <PrivyLoginButton />
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-6 py-10">
                {/* Profile Header */}
                <section className="card mb-8">
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                        <div className="w-16 h-16 rounded-xl bg-charcoal-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {ethosUser?.avatarUrl ? (
                                <img
                                    src={ethosUser.avatarUrl}
                                    alt={ethosUser.displayName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-bone-200 font-bold text-xl">
                                    {address?.slice(2, 4).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-light text-bone-200 mb-1 truncate">
                                {ethosUser?.displayName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <p className="text-bone-600 font-mono text-sm truncate max-w-[300px]">
                                    {address}
                                </p>
                                {ethosUser?.username && (
                                    <span className="text-bone-500 text-sm">
                                        (@{ethosUser.username})
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {ethosScore !== null ? (
                                    <a
                                        href={profileLink ?? `https://ethos.network/profile/${address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm px-3 py-1 rounded-full bg-gold-400/10 text-gold-400 border border-gold-400/30 hover:bg-gold-400/20 transition-colors"
                                    >
                                        Ethos Score: {ethosScore}
                                    </a>
                                ) : tierName ? (
                                    <span className="text-sm px-3 py-1 rounded-full bg-charcoal-600 text-bone-300 border border-charcoal-500">
                                        {tierName} Tier
                                    </span>
                                ) : null}

                                <span className="text-sm text-bone-500">
                                    {reputation?.totalBountiesCompleted?.toString() ?? '0'} bounties completed
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {xpStreakDays > 0 ? (
                        <StatCard
                            label="XP Streak"
                            value={`${xpStreakDays} Days`}
                            icon="🔥"
                            accent
                        />
                    ) : (
                        <StatCard
                            label="Active Bounties"
                            value={activeBountyCount.toString()}
                            icon="🎯"
                        />
                    )}
                    <StatCard
                        label="Completed"
                        value={reputation?.totalBountiesCompleted?.toString() ?? '0'}
                        icon="✅"
                    />
                    <StatCard
                        label="Total Earnings"
                        value={`${reputation?.totalEarnings ? parseFloat(formatEther(reputation.totalEarnings)).toFixed(3) : '0'} ETH`}
                        icon="💰"
                    />
                    <StatCard
                        label="Available"
                        value={`${balanceFormatted} ETH`}
                        icon="🏦"
                    />
                </section>

                {/* Main Content Grid */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Reputation Card */}
                    <div>
                        <h2 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                            Reputation Scores
                        </h2>
                        <ReputationDisplay address={address} />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Freelancer Balance */}
                        <div className="card">
                            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                Withdrawable Balance
                            </h3>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-3xl font-light text-gold-400">{balanceFormatted}</span>
                                <span className="text-bone-500">ETH</span>
                            </div>
                            <p className="text-sm text-bone-600 mb-4">
                                Funds available for withdrawal from completed bounties.
                            </p>
                            <WithdrawButton />
                        </div>

                        {/* Social Connections */}
                        <SocialConnections />

                        {/* Client Escrow */}
                        {escrowAccount && (
                            <div className="card">
                                <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                    Client Escrow
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Total Deposited</span>
                                        <span className="text-bone-200 font-medium">
                                            {formatEther(escrowAccount.totalDeposited)} ETH
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Locked in Bounties</span>
                                        <span className="text-gold-400 font-medium">
                                            {formatEther(escrowAccount.lockedAmount)} ETH
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Available</span>
                                        <span className="text-green-400 font-medium">
                                            {formatEther(escrowAccount.availableBalance)} ETH
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Dispute Stats */}
                        {disputeStats && (disputeStats.initiated > BigInt(0) || disputeStats.lost > BigInt(0)) && (
                            <div className="card">
                                <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                                    Dispute History
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Disputes Initiated</span>
                                        <span className="text-bone-200 font-medium">
                                            {disputeStats.initiated.toString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Disputes Lost</span>
                                        <span className="text-red-400 font-medium">
                                            {disputeStats.lost.toString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-bone-500">Win Rate</span>
                                        <span className="text-green-400 font-medium">
                                            {disputeStats.winRate.toString()}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

function StatCard({
    label,
    value,
    icon,
    accent = false,
}: {
    label: string;
    value: string;
    icon: string;
    accent?: boolean;
}) {
    return (
        <div className="card min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <span className="text-bone-600 text-xs uppercase tracking-wider truncate">{label}</span>
            </div>
            <p className={`text-xl font-light truncate ${accent ? 'text-gold-400' : 'text-bone-200'}`}>
                {value}
            </p>
        </div>
    );
}
