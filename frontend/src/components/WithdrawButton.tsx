'use client';

import { useState } from 'react';
import { useWithdraw, useFreelancerBalance } from '@/hooks';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';

interface WithdrawButtonProps {
    onSuccess?: () => void;
}

export function WithdrawButton({ onSuccess }: WithdrawButtonProps) {
    const { address, isConnected } = useAccount();
    const { balance, balanceFormatted, refetch } = useFreelancerBalance(address);
    const { withdraw, isLoading, isSuccess, isError, error, hash, reset } = useWithdraw();
    const [showModal, setShowModal] = useState(false);
    const [amount, setAmount] = useState('');

    const handleWithdraw = async () => {
        try {
            const withdrawAmount = amount || balanceFormatted;
            await withdraw(withdrawAmount);
            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                    refetch();
                }, 1500);
            }
        } catch (err) {
            console.error('Withdraw error:', err);
        }
    };

    const handleClose = () => {
        setShowModal(false);
        setAmount('');
        reset();
    };

    // No balance to withdraw
    if (balance === BigInt(0)) {
        return (
            <button
                disabled
                className="py-2.5 px-6 bg-charcoal-600 text-bone-500 font-medium rounded-lg cursor-not-allowed"
            >
                No Balance to Withdraw
            </button>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                disabled={!isConnected}
                className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Withdraw {balanceFormatted} ETH
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-charcoal-900 border border-charcoal-500 rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-light text-bone-200 mb-4">Withdraw Funds</h3>

                        {isSuccess ? (
                            <div className="text-center py-6">
                                <div className="text-4xl mb-3">✅</div>
                                <p className="text-green-400 font-medium mb-2">Withdrawal Successful!</p>
                                {hash && (
                                    <a
                                        href={`https://sepolia.basescan.org/tx/${hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gold-400 text-sm hover:underline"
                                    >
                                        View transaction
                                    </a>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="mt-4 w-full py-2 bg-charcoal-600 hover:bg-charcoal-500 text-bone-200 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <p className="text-bone-500 text-sm mb-2">Available balance:</p>
                                    <p className="text-2xl font-light text-bone-200">{balanceFormatted} ETH</p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-bone-400 mb-2">
                                        Amount to withdraw (ETH)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        max={balanceFormatted}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder={balanceFormatted}
                                        className="w-full px-4 py-3 bg-charcoal-700 border border-charcoal-500 rounded-lg text-bone-200 placeholder-bone-600 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAmount(balanceFormatted)}
                                        className="text-xs text-gold-400 hover:text-gold-300 mt-1"
                                    >
                                        Withdraw all
                                    </button>
                                </div>

                                {isError && error && (
                                    <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg mb-4">
                                        <p className="text-red-400 text-sm">{error.message}</p>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 py-3 bg-charcoal-600 hover:bg-charcoal-500 text-bone-300 font-medium rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isLoading}
                                        className="flex-1 py-3 btn-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                                                <span>Withdrawing...</span>
                                            </>
                                        ) : (
                                            <span>Withdraw</span>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
