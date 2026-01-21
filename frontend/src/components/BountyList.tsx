'use client';

import { useRecentBounties } from '@/hooks';
import { BountyCard } from './BountyCard';
import { BountyStatus } from '@/config/abis';

interface BountyListProps {
    limit?: number;
    filterStatus?: BountyStatus;
}

export function BountyList({ limit = 10, filterStatus }: BountyListProps) {
    const { bounties, totalCount, isLoading, isError, refetch } = useRecentBounties(limit);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50 animate-pulse"
                    >
                        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="h-10 bg-gray-700 rounded"></div>
                            <div className="h-10 bg-gray-700 rounded"></div>
                        </div>
                        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
                <p className="text-red-400 mb-3">Failed to load bounties</p>
                <button
                    onClick={() => refetch()}
                    className="text-sm text-red-300 hover:text-red-200 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    const filteredBounties = filterStatus !== undefined
        ? bounties.filter((b) => b.status === filterStatus)
        : bounties;

    if (filteredBounties.length === 0) {
        return (
            <div className="bg-gray-800/30 rounded-xl p-10 border border-gray-700/50 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-400">No bounties found</p>
                <p className="text-gray-500 text-sm mt-1">
                    {totalCount > BigInt(0)
                        ? 'Try adjusting your filters'
                        : 'Be the first to create one!'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">
                    Showing {filteredBounties.length} of {totalCount.toString()} bounties
                </p>
                <button
                    onClick={() => refetch()}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                    Refresh
                </button>
            </div>
            {filteredBounties.map((bounty) => (
                <BountyCard key={bounty.bountyId.toString()} bounty={bounty} />
            ))}
        </div>
    );
}
