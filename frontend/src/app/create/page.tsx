'use client';

import { AppShell, CreateBountyForm, PrivyLoginButton } from '@/components';
import { usePrivyUser } from '@/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateBountyPage() {
    const { isAuthenticated: isConnected } = usePrivyUser();
    const router = useRouter();

    const handleSuccess = () => {
        // Redirect to home after success
        setTimeout(() => {
            router.push('/');
        }, 2000);
    };

    return (
        <AppShell>
            <div className="max-w-2xl mx-auto px-6 py-10">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm mb-6">
                    <Link href="/" className="text-bone-500 hover:text-bone-300 transition-colors">
                        Bounties
                    </Link>
                    <span className="text-bone-700">/</span>
                    <span className="text-bone-300">Create New</span>
                </div>

                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-2xl font-light text-bone-200 mb-2">Create a Bounty</h1>
                    <p className="text-bone-500">
                        Post a bounty and deposit ETH into secure escrow. Freelancers can claim and complete your task.
                    </p>
                </div>

                {/* Connect Prompt */}
                {!isConnected ? (
                    <div className="card text-center py-12">
                        <div className="text-4xl mb-4">🔒</div>
                        <h2 className="text-xl font-light text-bone-200 mb-2">Connect Your Wallet</h2>
                        <p className="text-bone-500 mb-6">
                            You need to connect your wallet to create a bounty on Base Sepolia.
                        </p>
                        <PrivyLoginButton />
                    </div>
                ) : (
                    <div className="card">
                        <CreateBountyForm
                            onSuccess={handleSuccess}
                            onCancel={() => router.push('/')}
                        />
                    </div>
                )}

                {/* Info Box */}
                <div className="mt-8 card">
                    <h3 className="text-sm font-medium text-bone-400 mb-3 tracking-wide uppercase">
                        How it works
                    </h3>
                    <ul className="text-sm text-bone-500 space-y-2">
                        <li className="flex items-start gap-2">
                            <span className="text-gold-400">•</span>
                            Your ETH is deposited into a secure escrow contract
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-gold-400">•</span>
                            Freelancers meeting your reputation requirements can claim
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-gold-400">•</span>
                            You review submissions and release payment on approval
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-gold-400">•</span>
                            10% platform fee is deducted from the escrow amount
                        </li>
                    </ul>
                </div>
            </div>
        </AppShell>
    );
}
