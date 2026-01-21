'use client';

import { useState } from 'react';
import { useSubmitWork } from '@/hooks';
import { useAccount } from 'wagmi';

interface SubmitWorkFormProps {
    bountyId: bigint;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function SubmitWorkForm({ bountyId, onSuccess, onCancel }: SubmitWorkFormProps) {
    const { isConnected } = useAccount();
    const { submitWork, isLoading, isSuccess, isError, error, hash, reset } = useSubmitWork();
    const [workDescription, setWorkDescription] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await submitWork(bountyId, workDescription);
            if (onSuccess) {
                setTimeout(onSuccess, 1500);
            }
        } catch (err) {
            console.error('Submit work error:', err);
        }
    };

    if (isSuccess) {
        return (
            <div className="p-6 bg-green-900/30 border border-green-700/50 rounded-xl text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Work Submitted!</h3>
                <p className="text-gray-400 mb-3">Your submission is now pending review.</p>
                {hash && (
                    <a
                        href={`https://sepolia.basescan.org/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 text-sm hover:underline"
                    >
                        View transaction
                    </a>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Work Deliverables
                </label>
                <textarea
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    placeholder="Describe your work or paste IPFS hash/link to deliverables..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                    rows={4}
                    required
                />
                <p className="text-xs text-gray-500 mt-1">
                    For larger files, upload to IPFS and paste the hash here.
                </p>
            </div>

            {/* Error Display */}
            {isError && error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-red-400 text-sm mb-2">{error.message}</p>
                    <button
                        type="button"
                        onClick={reset}
                        className="text-xs text-gray-400 hover:text-white underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center gap-3 p-4 bg-blue-900/30 border border-blue-700/50 rounded-xl">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-blue-300">Submitting work...</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={!isConnected || isLoading || !workDescription.trim()}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                >
                    {isLoading ? 'Submitting...' : 'Submit Work'}
                </button>
            </div>
        </form>
    );
}
