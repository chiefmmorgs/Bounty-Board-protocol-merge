'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAuthGate, getMinimumEthosScore } from '@/hooks/useAuthGate';

/**
 * LoginGateway - Minimal, reputation-centric entry point
 * Matches the calm, authoritative Ethos aesthetic
 */
export function LoginGateway() {
    const { login } = usePrivy();
    const { status, ethosScore, blockReason } = useAuthGate();

    return (
        <div className="gateway-bg relative flex flex-col items-center justify-between min-h-screen px-4 py-8">
            {/* Noise overlay */}
            <div className="noise-overlay" />

            {/* Spacer for top */}
            <div className="flex-1" />

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-md animate-fadeIn">
                {/* Protocol Icon - 3 horizontal lines */}
                <div className="mb-8 flex flex-col gap-2">
                    <div className="w-10 h-1 bg-bone-300 rounded-full" />
                    <div className="w-8 h-1 bg-bone-300 rounded-full mx-auto" />
                    <div className="w-6 h-1 bg-bone-300 rounded-full mx-auto" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-light text-bone-200 tracking-protocol mb-4">
                    <span className="text-bone-400">BOUNTY</span>BOARD
                </h1>

                {/* Subtitle */}
                <p className="text-bone-500 text-lg mb-10">
                    Reputation-gated bounties
                </p>

                {/* Dynamic content based on state */}
                {status === 'unauthenticated' && (
                    <button
                        onClick={() => login()}
                        className="btn-primary"
                    >
                        Connect
                    </button>
                )}

                {status === 'connecting' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-6 h-6 border-2 border-bone-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-bone-500 text-sm">Connecting...</p>
                    </div>
                )}

                {status === 'checking' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-bone-500 text-sm">Verifying reputation...</p>
                    </div>
                )}

                {status === 'blocked' && (
                    <div className="flex flex-col items-center gap-6 max-w-sm">
                        {/* Blocked icon */}
                        <div className="w-12 h-12 rounded-full border-2 border-red-500/50 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>

                        <div className="space-y-2">
                            <p className="text-bone-300 font-medium">Insufficient Reputation</p>
                            <p className="text-bone-600 text-sm leading-relaxed">
                                {blockReason}
                            </p>
                        </div>

                        {ethosScore !== null && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-bone-600">Your score:</span>
                                <span className="text-bone-400 font-mono">{ethosScore}</span>
                                <span className="text-bone-700">/</span>
                                <span className="text-bone-600 font-mono">{getMinimumEthosScore()} required</span>
                            </div>
                        )}

                        <a
                            href="https://ethos.network"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold-400 text-sm hover:text-gold-300 transition-colors"
                        >
                            Build your reputation on Ethos →
                        </a>
                    </div>
                )}
            </div>

            {/* Spacer for bottom */}
            <div className="flex-1" />

            {/* Footer - now relative, not absolute */}
            <div className="relative z-10">
                <p className="text-bone-700 text-xs tracking-wide">
                    POWERED BY{' '}
                    <a
                        href="https://ethos.network"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bone-500 hover:text-bone-400 transition-colors"
                    >
                        ETHOS NETWORK
                    </a>
                </p>
            </div>
        </div>
    );
}

export default LoginGateway;
