'use client';

import { useCancellationRequest, useFormattedCountdown, useProcessExpiredCancellation } from '@/hooks';
import { useState, useEffect } from 'react';

interface CancellationStatusProps {
    bountyId: bigint;
    isClient: boolean;
    onProcessed?: () => void;
}

export function CancellationStatus({ bountyId, isClient, onProcessed }: CancellationStatusProps) {
    const { cancellationRequest, isExpired, timeRemaining, isLoading, refetch } = useCancellationRequest(bountyId);
    const { processExpiredCancellation, isLoading: isProcessing, isSuccess } = useProcessExpiredCancellation();
    const [countdown, setCountdown] = useState(timeRemaining);

    // Update countdown every second
    useEffect(() => {
        setCountdown(timeRemaining);

        if (timeRemaining <= 0) return;

        const interval = setInterval(() => {
            setCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [timeRemaining]);

    // Handle success
    useEffect(() => {
        if (isSuccess) {
            refetch();
            onProcessed?.();
        }
    }, [isSuccess, refetch, onProcessed]);

    const formattedTime = useFormattedCountdown(countdown);

    if (isLoading || !cancellationRequest) return null;

    // Already processed
    if (cancellationRequest.processed) {
        return (
            <div className={`p-4 rounded-lg border ${cancellationRequest.approved
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${cancellationRequest.approved ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                    <span className={cancellationRequest.approved ? 'text-green-400' : 'text-red-400'}>
                        Cancellation {cancellationRequest.approved ? 'Approved' : 'Rejected'}
                    </span>
                </div>
            </div>
        );
    }

    // Pending cancellation
    return (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-orange-400 font-medium">Cancellation Pending</span>
                </div>
                <span className="text-bone-400 text-sm">
                    {isExpired ? 'Ready for auto-approval' : formattedTime}
                </span>
            </div>

            <p className="text-bone-500 text-sm">
                This bounty has a pending cancellation request that is awaiting moderator review.
                {isExpired && ' The review period has expired and can now be auto-approved.'}
            </p>

            {/* Reason hash */}
            <div className="pt-2 border-t border-orange-500/20">
                <p className="text-bone-600 text-xs mb-1">Reason Hash</p>
                <p className="text-bone-500 text-xs font-mono truncate">{cancellationRequest.reasonHash}</p>
            </div>

            {/* Auto-approve button when expired */}
            {isExpired && (
                <button
                    onClick={() => processExpiredCancellation(bountyId)}
                    disabled={isProcessing}
                    className="w-full mt-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg 
                             hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                >
                    {isProcessing ? 'Processing...' : 'Process Auto-Approval'}
                </button>
            )}
        </div>
    );
}
