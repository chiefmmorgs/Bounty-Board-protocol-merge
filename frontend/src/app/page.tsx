'use client';

import { LoginGateway, AppShell, BountyList, ReputationDisplay } from '@/components';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useBountyCount } from '@/hooks';
import { usePrivyUser } from '@/hooks';
import Link from 'next/link';

export default function HomePage() {
    const { status, walletAddress, ethosScore } = useAuthGate();

    // Show login gateway if not fully authenticated
    if (status !== 'authenticated') {
        return <LoginGateway />;
    }

    // Show full app for authenticated users
    return (
        <AppShell>
            <DashboardContent
                walletAddress={walletAddress!}
                ethosScore={ethosScore}
            />
        </AppShell>
    );
}

interface DashboardContentProps {
    walletAddress: `0x${string}`;
    ethosScore: number | null;
}

function DashboardContent({ walletAddress, ethosScore }: DashboardContentProps) {
    const { count } = useBountyCount();

    return (
        <div className="max-w-6xl mx-auto px-6 py-10">
            {/* Welcome Section */}
            <section className="mb-12">
                <h1 className="text-3xl font-light text-bone-200 mb-2">
                    Welcome back
                </h1>
                <p className="text-bone-500">
                    Find and complete bounties on Base.
                </p>
            </section>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <StatCard
                    label="Your Ethos Score"
                    value={ethosScore?.toString() || '—'}
                    accent
                />
                <StatCard
                    label="Total Bounties"
                    value={count.toString()}
                />
                <StatCard
                    label="Network"
                    value="Base Sepolia"
                />
                <StatCard
                    label="Chain ID"
                    value="84532"
                />
            </section>

            {/* Main Content Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Bounty List - Takes up 2 columns */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-light text-bone-200">
                            Open Bounties
                        </h2>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/bounties"
                                className="text-bone-400 hover:text-bone-200 text-sm transition-colors"
                            >
                                View All →
                            </Link>
                            <Link
                                href="/create"
                                className="btn-gold text-sm"
                            >
                                + Create Bounty
                            </Link>
                        </div>
                    </div>
                    <BountyList limit={5} />
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Your Reputation */}
                    <div className="card">
                        <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                            Your Reputation
                        </h3>
                        <ReputationDisplay address={walletAddress} />
                    </div>

                    {/* Quick Links */}
                    <div className="card">
                        <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                            Resources
                        </h3>
                        <div className="space-y-3">
                            <ResourceLink
                                label="Ethos Profile"
                                href={`https://ethos.network/profile/${walletAddress}`}
                            />
                            <ResourceLink
                                label="View on BaseScan"
                                href={`https://sepolia.basescan.org/address/${walletAddress}`}
                            />
                            <ResourceLink
                                label="Documentation"
                                href="/docs"
                                internal
                            />
                        </div>
                    </div>

                    {/* Contract Info */}
                    <div className="card">
                        <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                            Contracts
                        </h3>
                        <div className="space-y-3 text-sm">
                            <ContractLink
                                name="BountyRegistry"
                                address={process.env.NEXT_PUBLIC_BOUNTY_REGISTRY_ADDRESS || ''}
                            />
                            <ContractLink
                                name="PaymentEscrow"
                                address={process.env.NEXT_PUBLIC_PAYMENT_ESCROW_ADDRESS || ''}
                            />
                            <ContractLink
                                name="ReputationOracle"
                                address={process.env.NEXT_PUBLIC_REPUTATION_ORACLE_ADDRESS || ''}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// Stat Card Component
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="card">
            <p className="text-bone-600 text-sm mb-1">{label}</p>
            <p className={`text-2xl font-light ${accent ? 'text-gold-400' : 'text-bone-200'}`}>
                {value}
            </p>
        </div>
    );
}

// Resource Link Component
function ResourceLink({ label, href, internal }: { label: string; href: string; internal?: boolean }) {
    const className = "flex items-center justify-between text-bone-500 hover:text-bone-300 transition-colors";

    if (internal) {
        return (
            <Link href={href} className={className}>
                <span>{label}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </Link>
        );
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            <span>{label}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
        </a>
    );
}

// Contract Link Component
function ContractLink({ name, address }: { name: string; address: string }) {
    if (!address) return null;

    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const explorerUrl = `https://sepolia.basescan.org/address/${address}`;

    return (
        <div className="flex items-center justify-between">
            <span className="text-bone-600">{name}</span>
            <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bone-400 hover:text-gold-400 font-mono text-xs transition-colors"
            >
                {shortAddress}
            </a>
        </div>
    );
}
