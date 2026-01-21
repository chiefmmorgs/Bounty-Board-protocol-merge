'use client';

import { useState } from 'react';
import { AppShell, BountyCard } from '@/components';
import { useBountyCount, useBounties } from '@/hooks';
import { BountyStatus } from '@/config/abis';
import Link from 'next/link';

type FilterStatus = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled';

export default function BountiesPage() {
    const [filter, setFilter] = useState<FilterStatus>('all');
    const { count, isLoading: countLoading } = useBountyCount();

    // Generate IDs for all bounties
    const bountyIds = [];
    for (let i = 1; i <= Number(count); i++) {
        bountyIds.push(BigInt(i));
    }

    const { bounties, isLoading } = useBounties(bountyIds);

    // Filter bounties based on status
    const filteredBounties = bounties.filter(bounty => {
        if (filter === 'all') return true;
        if (filter === 'open') return bounty.status === BountyStatus.Open;
        if (filter === 'in_progress') return bounty.status === BountyStatus.InProgress;
        if (filter === 'completed') return bounty.status === BountyStatus.Completed;
        if (filter === 'cancelled') return bounty.status === BountyStatus.Cancelled;
        return true;
    });

    // Sort by ID descending (newest first)
    const sortedBounties = [...filteredBounties].sort((a, b) =>
        Number(b.bountyId) - Number(a.bountyId)
    );

    const statusFilters: { label: string; value: FilterStatus }[] = [
        { label: 'All', value: 'all' },
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
    ];

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-light text-bone-200">All Bounties</h1>
                        <p className="text-bone-500 text-sm mt-1">
                            {count.toString()} total bounties on the platform
                        </p>
                    </div>
                    <Link href="/create" className="btn-gold">
                        + Create Bounty
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {statusFilters.map((sf) => (
                        <button
                            key={sf.value}
                            onClick={() => setFilter(sf.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === sf.value
                                    ? 'bg-gold-400 text-charcoal-900'
                                    : 'bg-charcoal-700 text-bone-400 hover:bg-charcoal-600'
                                }`}
                        >
                            {sf.label}
                        </button>
                    ))}
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label="Open"
                        value={bounties.filter(b => b.status === BountyStatus.Open).length.toString()}
                        color="text-green-400"
                    />
                    <StatCard
                        label="In Progress"
                        value={bounties.filter(b => b.status === BountyStatus.InProgress).length.toString()}
                        color="text-blue-400"
                    />
                    <StatCard
                        label="Completed"
                        value={bounties.filter(b => b.status === BountyStatus.Completed).length.toString()}
                        color="text-gold-400"
                    />
                    <StatCard
                        label="Other"
                        value={bounties.filter(b =>
                            b.status !== BountyStatus.Open &&
                            b.status !== BountyStatus.InProgress &&
                            b.status !== BountyStatus.Completed
                        ).length.toString()}
                        color="text-bone-400"
                    />
                </div>

                {/* Bounty List */}
                {isLoading || countLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="h-6 bg-charcoal-600 rounded w-1/3 mb-4" />
                                <div className="h-4 bg-charcoal-600 rounded w-1/2 mb-2" />
                                <div className="h-4 bg-charcoal-600 rounded w-1/4" />
                            </div>
                        ))}
                    </div>
                ) : sortedBounties.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-bone-500 mb-4">
                            {filter === 'all'
                                ? 'No bounties found.'
                                : `No ${filter.replace('_', ' ')} bounties found.`}
                        </p>
                        <Link href="/create" className="text-gold-400 hover:text-gold-300">
                            Create the first bounty →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-bone-500 text-sm">
                            Showing {sortedBounties.length} of {count.toString()} bounties
                        </p>
                        {sortedBounties.map((bounty) => (
                            <BountyCard key={bounty.bountyId.toString()} bounty={bounty} />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="card text-center">
            <p className="text-bone-600 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-light ${color}`}>{value}</p>
        </div>
    );
}
