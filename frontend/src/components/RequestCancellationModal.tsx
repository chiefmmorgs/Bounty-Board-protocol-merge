'use client';

import { useState } from 'react';
import { keccak256, toBytes } from 'viem';
import { useRequestCancellation } from '@/hooks';

interface RequestCancellationModalProps {
    bountyId: bigint;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function RequestCancellationModal({
    bountyId,
    isOpen,
    onClose,
    onSuccess,
}: RequestCancellationModalProps) {
    const [reason, setReason] = useState('');
    const { requestCancellation, isLoading, isSuccess, isError, error, reset } = useRequestCancellation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;

        try {
            // Hash the reason to bytes32
            const reasonHash = keccak256(toBytes(reason));
            await requestCancellation(bountyId, reasonHash);
        } catch (err) {
            console.error('Failed to request cancellation:', err);
        }
    };

    const handleClose = () => {
        setReason('');
        reset();
        onClose();
    };

    // Handle success
    if (isSuccess) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose}>
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-bone-200 mb-2">Cancellation Requested</h3>
                    <p className="text-bone-500 mb-6">
                        Your request is now pending moderator review.<br />
                        Auto-approval in 7 days if no action is taken.
                    </p>
                    <button
                        onClick={() => {
                            handleClose();
                            onSuccess();
                        }}
                        className="btn-gold"
                    >
                        Done
                    </button>
                </div>
            </Modal>
        );
    }

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={handleClose}>
            <div className="max-w-md mx-auto">
                <h2 className="text-xl font-light text-bone-200 mb-2">Request Cancellation</h2>
                <p className="text-bone-500 text-sm mb-6">
                    Cancellation requests require a 7-day moderator review period.
                    If no moderator acts, the cancellation will be auto-approved.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-bone-400 text-sm mb-2">
                            Reason for Cancellation
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Please explain why you need to cancel this bounty..."
                            className="w-full h-32 px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg 
                                     text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:outline-none resize-none"
                            required
                        />
                    </div>

                    {/* Warning */}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-sm text-amber-200">
                                <p className="font-medium mb-1">7-Day Review Period</p>
                                <p className="text-amber-300/80">
                                    Moderators may reject the cancellation if they determine it's unfair to the freelancer.
                                </p>
                            </div>
                        </div>
                    </div>

                    {isError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error?.message || 'Failed to request cancellation'}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-3 bg-charcoal-600 text-bone-300 rounded-lg 
                                     hover:bg-charcoal-500 transition-colors"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !reason.trim()}
                            className="flex-1 btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Submitting...' : 'Request Cancellation'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

// Simple Modal component
function Modal({
    isOpen,
    onClose,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Content */}
            <div className="relative bg-charcoal-800 border border-charcoal-600 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-bone-500 hover:text-bone-300 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {children}
            </div>
        </div>
    );
}
