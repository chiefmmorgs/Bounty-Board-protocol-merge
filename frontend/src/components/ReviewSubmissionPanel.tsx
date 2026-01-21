'use client';

import { useState } from 'react';
import { useStartReview, useAcceptSubmission, useRejectSubmission } from '@/hooks';
import { useAccount } from 'wagmi';
import { Submission, SubmissionStatus, submissionStatusNames } from '@/config/abis';
import { formatEther } from 'viem';

interface ReviewSubmissionPanelProps {
    submission: Submission;
    bountyEscrow: bigint;
    isClient: boolean;
    onSuccess?: () => void;
}

export function ReviewSubmissionPanel({ submission, bountyEscrow, isClient, onSuccess }: ReviewSubmissionPanelProps) {
    const { isConnected } = useAccount();
    const [feedback, setFeedback] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);

    const { startReview, isLoading: isStartingReview, isSuccess: reviewStarted, hash: reviewHash } = useStartReview();
    const { acceptSubmission, isLoading: isAccepting, isSuccess: isAccepted, hash: acceptHash, error: acceptError } = useAcceptSubmission();
    const { rejectSubmission, isLoading: isRejecting, isSuccess: isRejected, hash: rejectHash, error: rejectError } = useRejectSubmission();

    const status = submission.status as SubmissionStatus;
    const statusName = submissionStatusNames[status];

    // Handle start review
    const handleStartReview = async () => {
        try {
            await startReview(submission.submissionId);
            if (onSuccess) setTimeout(onSuccess, 1500);
        } catch (err) {
            console.error('Start review error:', err);
        }
    };

    // Handle accept
    const handleAccept = async () => {
        try {
            await acceptSubmission(submission.submissionId, feedback);
            if (onSuccess) setTimeout(onSuccess, 1500);
        } catch (err) {
            console.error('Accept error:', err);
        }
    };

    // Handle reject
    const handleReject = async () => {
        if (!feedback.trim()) {
            alert('Please provide feedback for the rejection');
            return;
        }
        try {
            await rejectSubmission(submission.submissionId, feedback);
            if (onSuccess) setTimeout(onSuccess, 1500);
        } catch (err) {
            console.error('Reject error:', err);
        }
    };

    // Not the client
    if (!isClient) {
        return (
            <div className="p-4 bg-gray-800/50 rounded-xl">
                <p className="text-gray-400 text-sm">
                    Waiting for client to review submission...
                </p>
                <p className="text-gray-500 text-xs mt-1">
                    Status: {statusName}
                </p>
            </div>
        );
    }

    // Already accepted
    if (isAccepted || status === SubmissionStatus.Accepted) {
        return (
            <div className="p-6 bg-green-900/30 border border-green-700/50 rounded-xl text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Submission Accepted!</h3>
                <p className="text-gray-400">
                    Payment of {formatEther(bountyEscrow)} ETH has been released to the freelancer.
                </p>
                {acceptHash && (
                    <a
                        href={`https://sepolia.basescan.org/tx/${acceptHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 text-sm hover:underline mt-2 block"
                    >
                        View transaction
                    </a>
                )}
            </div>
        );
    }

    // Already rejected
    if (isRejected || status === SubmissionStatus.Rejected) {
        return (
            <div className="p-6 bg-red-900/30 border border-red-700/50 rounded-xl text-center">
                <div className="text-4xl mb-3">❌</div>
                <h3 className="text-xl font-bold text-red-400 mb-2">Submission Rejected</h3>
                <p className="text-gray-400">Freelancer can resubmit their work.</p>
                {rejectHash && (
                    <a
                        href={`https://sepolia.basescan.org/tx/${rejectHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-300 text-sm hover:underline mt-2 block"
                    >
                        View transaction
                    </a>
                )}
            </div>
        );
    }

    // Pending - need to start review
    if (status === SubmissionStatus.Pending) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                    <p className="text-yellow-400 font-medium">New submission received!</p>
                    <p className="text-gray-400 text-sm mt-1">
                        Start your review to begin the review period timer.
                    </p>
                </div>
                <button
                    onClick={handleStartReview}
                    disabled={!isConnected || isStartingReview}
                    className="w-full py-3 px-6 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    {isStartingReview ? (
                        <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Starting Review...</span>
                        </>
                    ) : (
                        <span>Start Review</span>
                    )}
                </button>
            </div>
        );
    }

    // Under review - can accept or reject
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-xl">
                <p className="text-blue-400 font-medium">Review in progress</p>
                {submission.reviewStartedAt > BigInt(0) && (
                    <p className="text-gray-400 text-sm mt-1">
                        Started: {new Date(Number(submission.reviewStartedAt) * 1000).toLocaleString()}
                    </p>
                )}
            </div>

            {/* Feedback Input */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Feedback (optional for accept, required for reject)
                </label>
                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide feedback on the submission..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                />
            </div>

            {/* Error Display */}
            {(acceptError || rejectError) && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-red-400 text-sm">{(acceptError || rejectError)?.message}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleReject}
                    disabled={!isConnected || isRejecting || isAccepting}
                    className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                    {isRejecting ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                    onClick={handleAccept}
                    disabled={!isConnected || isAccepting || isRejecting}
                    className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                    {isAccepting ? 'Accepting...' : 'Accept & Pay'}
                </button>
            </div>
        </div>
    );
}
