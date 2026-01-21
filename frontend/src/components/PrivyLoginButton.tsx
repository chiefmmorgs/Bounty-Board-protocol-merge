'use client';

import { usePrivy } from '@privy-io/react-auth';
import { usePrivyUser } from '@/hooks/usePrivyUser';

interface PrivyLoginButtonProps {
    className?: string;
}

export function PrivyLoginButton({ className = '' }: PrivyLoginButtonProps) {
    const { ready, authenticated, login, logout } = usePrivy();
    const { email, walletAddress, privyUserId } = usePrivyUser();

    // Not ready yet
    if (!ready) {
        return (
            <button
                disabled
                className={`py-2 px-4 bg-gray-700 text-gray-400 rounded-xl cursor-wait ${className}`}
            >
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                </div>
            </button>
        );
    }

    // Not authenticated - show login button
    if (!authenticated) {
        return (
            <button
                onClick={login}
                className={`py-2.5 px-5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all ${className}`}
            >
                Login
            </button>
        );
    }

    // Authenticated - show user info with dropdown
    return (
        <div className="relative group">
            <button
                className={`py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-xl transition-colors flex items-center gap-2 ${className}`}
            >
                {/* User avatar */}
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                        {email ? email[0].toUpperCase() : walletAddress?.slice(2, 4).toUpperCase() || '?'}
                    </span>
                </div>

                {/* Display email or truncated address */}
                <span className="max-w-[120px] truncate">
                    {email || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connected')}
                </span>

                {/* Dropdown arrow */}
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-4 border-b border-gray-700">
                    {email && (
                        <p className="text-white font-medium truncate">{email}</p>
                    )}
                    {walletAddress && (
                        <p className="text-gray-400 text-sm font-mono mt-1">
                            {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                        </p>
                    )}
                    {privyUserId && (
                        <p className="text-gray-500 text-xs mt-2">
                            ID: {privyUserId.slice(0, 16)}...
                        </p>
                    )}
                </div>
                <div className="p-2">
                    <button
                        onClick={logout}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
