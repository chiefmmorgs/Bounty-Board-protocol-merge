'use client';

import { useState, useEffect } from 'react';
import { useCreateBounty, usePrivyUser, useEthosUser } from '@/hooks';
import { formatEther, parseEther, keccak256, toBytes } from 'viem';
import { saveBountyMetadata } from '@/services/bountyMetadata';

interface CreateBountyFormProps {
    onSuccess?: (bountyId?: bigint) => void;
    onCancel?: () => void;
}

export function CreateBountyForm({ onSuccess, onCancel }: CreateBountyFormProps) {
    const { isAuthenticated: isConnected, walletAddress } = usePrivyUser();
    const { score: userEthosScore, isLoading: scoreLoading } = useEthosUser(walletAddress);
    const { createBounty, isLoading, isSuccess, isError, error, hash, status, reset } = useCreateBounty();

    const [form, setForm] = useState({
        title: '',
        description: '',
        escrowAmount: '0.01',
        deadline: '',
        minRepRequired: 0,
        maxRevisions: 3,
        reviewPeriodHours: 72,
    });

    // Set default deadline to 7 days from now
    const getDefaultDeadline = () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().slice(0, 16);
    };

    // Max Ethos score user can set (cannot exceed their own score)
    const maxAllowedScore = Math.min(userEthosScore || 0, 2000);

    // Clamp minRepRequired if it exceeds user's score
    useEffect(() => {
        if (userEthosScore !== null && form.minRepRequired > maxAllowedScore) {
            setForm(prev => ({ ...prev, minRepRequired: maxAllowedScore }));
        }
    }, [userEthosScore, maxAllowedScore, form.minRepRequired]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate user cannot set requirement above their own score
        if (form.minRepRequired > maxAllowedScore) {
            alert(`You cannot set a requirement higher than your own Ethos score (${userEthosScore})`);
            return;
        }

        try {
            // Combine title and description for hashing
            const fullContent = `${form.title}\n\n${form.description}`;

            // Compute hash for metadata storage (same as what goes on-chain)
            const contentHash = keccak256(toBytes(fullContent));

            // Save metadata to localStorage BEFORE submitting
            saveBountyMetadata(contentHash, {
                title: form.title,
                description: form.description,
                createdAt: Math.floor(Date.now() / 1000),
                creator: walletAddress || '',
            });

            // Pass Ethos score directly (0-2000)
            await createBounty({
                requirementsHash: fullContent,
                deadline: new Date(form.deadline || getDefaultDeadline()),
                minRepRequired: form.minRepRequired,
                maxRevisions: form.maxRevisions,
                reviewPeriodHours: form.reviewPeriodHours,
                escrowAmount: form.escrowAmount,
            });
        } catch (err) {
            console.error('Create bounty error:', err);
        }
    };

    // Call onSuccess when transaction is confirmed
    if (isSuccess && onSuccess) {
        onSuccess();
    }

    // Calculate platform fee (10%)
    const escrowWei = form.escrowAmount ? parseEther(form.escrowAmount) : BigInt(0);
    const platformFee = escrowWei / BigInt(10);
    const netPayment = escrowWei - platformFee;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-bone-400 mb-2">
                    Bounty Title
                </label>
                <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Build a landing page, Create logo design, Write smart contract..."
                    className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                    maxLength={100}
                    required
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-bone-400 mb-2">
                    Bounty Description
                </label>
                <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what work needs to be done, deliverables, acceptance criteria, and how to submit completed work..."
                    className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none resize-none"
                    rows={6}
                    required
                />
                <p className="text-xs text-bone-600 mt-1">
                    Be specific about requirements, deliverables, and how freelancers should submit their work.
                </p>
            </div>

            {/* Escrow Amount */}
            <div>
                <label className="block text-sm font-medium text-bone-400 mb-2">
                    Bounty Amount (ETH)
                </label>
                <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={form.escrowAmount}
                    onChange={(e) => setForm({ ...form, escrowAmount: e.target.value })}
                    className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                    required
                />
                <div className="flex justify-between text-xs text-bone-600 mt-2">
                    <span>Platform fee (10%): {formatEther(platformFee)} ETH</span>
                    <span className="text-gold-400">Net to freelancer: {formatEther(netPayment)} ETH</span>
                </div>
            </div>

            {/* Deadline */}
            <div>
                <label className="block text-sm font-medium text-bone-400 mb-2">
                    Deadline
                </label>
                <input
                    type="datetime-local"
                    value={form.deadline || getDefaultDeadline()}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                    required
                />
            </div>

            {/* Min Reputation (Ethos Score) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-bone-400">
                        Minimum Ethos Score Required
                    </label>
                    {scoreLoading ? (
                        <span className="text-xs text-bone-600">Loading your score...</span>
                    ) : userEthosScore !== null ? (
                        <span className="text-xs text-bone-500">
                            Your score: <span className="text-gold-400 font-medium">{userEthosScore}</span>
                        </span>
                    ) : (
                        <span className="text-xs text-orange-400">No Ethos profile found</span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="0"
                        max={maxAllowedScore > 0 ? maxAllowedScore : 2000}
                        step="20"
                        value={form.minRepRequired}
                        onChange={(e) => setForm({ ...form, minRepRequired: parseInt(e.target.value) })}
                        className="flex-1 accent-gold-400"
                        disabled={maxAllowedScore === 0 && userEthosScore !== null}
                    />
                    <span className="text-gold-400 font-medium min-w-[80px] text-right">
                        {form.minRepRequired}/2000
                    </span>
                </div>

                <div className="flex justify-between text-xs text-bone-600 mt-1">
                    <span>Open to all (0)</span>
                    <span>Max: {maxAllowedScore > 0 ? maxAllowedScore : 'Your score'}</span>
                </div>

                {form.minRepRequired > 0 && (
                    <p className="text-xs text-gold-400/80 mt-2">
                        Only freelancers with Ethos score ≥ {form.minRepRequired} can claim this bounty.
                    </p>
                )}

                {maxAllowedScore === 0 && userEthosScore !== null && (
                    <p className="text-xs text-orange-400 mt-2">
                        You need an Ethos score to set minimum requirements. Visit ethos.network to build your reputation.
                    </p>
                )}
            </div>

            {/* Max Revisions & Review Period */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-bone-400 mb-2">
                        Max Revisions
                    </label>
                    <select
                        value={form.maxRevisions}
                        onChange={(e) => setForm({ ...form, maxRevisions: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                    >
                        {[1, 2, 3, 5, 10].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-bone-400 mb-2">
                        Review Period
                    </label>
                    <select
                        value={form.reviewPeriodHours}
                        onChange={(e) => setForm({ ...form, reviewPeriodHours: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                    >
                        <option value={24}>24 hours</option>
                        <option value={48}>48 hours</option>
                        <option value={72}>72 hours (3 days)</option>
                        <option value={168}>1 week</option>
                    </select>
                </div>
            </div>

            {/* Error Display */}
            {isError && error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                    <p className="text-red-400 text-sm">{error.message}</p>
                </div>
            )}

            {/* Transaction Status */}
            {status !== 'idle' && !isError && (
                <div className="p-4 bg-gold-400/10 border border-gold-400/30 rounded-lg">
                    <div className="flex items-center gap-3">
                        {isLoading && (
                            <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                        )}
                        {isSuccess && (
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                            </div>
                        )}
                        <div>
                            <p className="text-gold-400 text-sm font-medium">
                                {status === 'pending' && 'Confirm in your wallet...'}
                                {status === 'confirming' && 'Waiting for confirmation...'}
                                {status === 'confirmed' && 'Bounty created successfully!'}
                            </p>
                            {hash && (
                                <a
                                    href={`https://sepolia.basescan.org/tx/${hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gold-300 text-xs hover:underline"
                                >
                                    View on BaseScan
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 px-6 bg-charcoal-600 hover:bg-charcoal-500 text-bone-300 font-medium rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={!isConnected || isLoading || isSuccess}
                    className="flex-1 py-3 px-6 btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Creating...' : isSuccess ? 'Created!' : `Create Bounty (${form.escrowAmount} ETH)`}
                </button>
            </div>
        </form>
    );
}
