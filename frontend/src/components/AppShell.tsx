'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivyUser } from '@/hooks/usePrivyUser';
import { useEthosUser } from '@/hooks/useEthosScore';

interface AppShellProps {
    children: ReactNode;
}

/**
 * AppShell - Authenticated app wrapper with Ethos-style aesthetic
 * Clean header, calm navigation, dark theme throughout
 */
export function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const { logout } = usePrivy();
    const { walletAddress } = usePrivyUser();
    const { score, displayName, profileLink } = useEthosUser(walletAddress);

    const navItems = [
        { href: '/', label: 'Home' },
        { href: '/bounties', label: 'Bounties' },
        { href: '/create', label: 'Create' },
        { href: '/profile', label: 'Profile' },
    ];

    const shortAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : '';

    return (
        <div className="app-bg min-h-screen">
            {/* Noise overlay */}
            <div className="noise-overlay" />

            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-charcoal-500/50 bg-charcoal-900/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Left - Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        {/* Protocol mark */}
                        <div className="flex flex-col gap-1">
                            <div className="w-5 h-0.5 bg-bone-400 group-hover:bg-gold-400 transition-colors" />
                            <div className="w-4 h-0.5 bg-bone-400 group-hover:bg-gold-400 transition-colors" />
                            <div className="w-3 h-0.5 bg-bone-400 group-hover:bg-gold-400 transition-colors" />
                        </div>
                        <span className="text-sm font-light tracking-wide text-bone-300">
                            <span className="text-bone-500">Bounty</span>Board
                        </span>
                    </Link>

                    {/* Center - Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navItems.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`text-sm transition-colors ${pathname === item.href
                                    ? 'text-bone-200'
                                    : 'text-bone-500 hover:text-bone-300'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right - Wallet & Score */}
                    <div className="flex items-center gap-4">
                        {/* Ethos Score Badge */}
                        {score > 0 && (
                            <a
                                href={profileLink || 'https://ethos.network'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-charcoal-700 border border-charcoal-500 hover:border-gold-400/50 transition-colors"
                            >
                                <span className="text-gold-400 text-xs font-medium">{score}</span>
                                <span className="text-bone-600 text-xs">Ethos</span>
                            </a>
                        )}

                        {/* Wallet Address */}
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 rounded-md bg-charcoal-700 border border-charcoal-500">
                                <span className="text-bone-400 text-sm font-mono">
                                    {displayName || shortAddress}
                                </span>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={() => logout()}
                                className="p-2 text-bone-600 hover:text-bone-400 transition-colors"
                                title="Disconnect"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <nav className="md:hidden border-t border-charcoal-500/50 px-6 py-2 flex items-center gap-6">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-sm transition-colors ${pathname === item.href
                                ? 'text-bone-200'
                                : 'text-bone-500'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </header>

            {/* Main Content */}
            <main className="relative z-10 animate-fadeIn">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-charcoal-500/30 mt-20">
                <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-bone-700 text-xs">
                        © 2024 BountyBoard. Built on Base.
                    </p>
                    <div className="flex items-center gap-6 text-xs">
                        <a
                            href="https://ethos.network"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-bone-600 hover:text-bone-400 transition-colors"
                        >
                            Ethos Network
                        </a>
                        <a
                            href="https://basescan.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-bone-600 hover:text-bone-400 transition-colors"
                        >
                            BaseScan
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default AppShell;
