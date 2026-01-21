'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia } from 'viem/chains';
import { http } from 'wagmi';
import { useState, ReactNode } from 'react';

// Wagmi config for Privy
const wagmiConfig = createConfig({
    chains: [baseSepolia],
    transports: {
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://base-sepolia.g.alchemy.com/v2/mWTlwA58Ueq8DU58coOAy_199ch-oisL'),
    },
});

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60, // 1 minute
                refetchOnWindowFocus: false,
            },
        },
    }));

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!appId) {
        console.warn('Missing NEXT_PUBLIC_PRIVY_APP_ID - Privy will not be available');
        // Fallback to just wagmi without Privy
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return (
        <PrivyProvider
            appId={appId}
            config={{
                // Login methods - email, wallet, and social linking
                loginMethods: ['email', 'wallet', 'twitter', 'google'],

                // Appearance
                appearance: {
                    theme: 'dark',
                    accentColor: '#d4a853', // Match gold accent
                    logo: undefined,
                    showWalletLoginFirst: false,
                },

                // Embedded wallet configuration
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                    noPromptOnSignature: false,
                },

                // External wallet linking
                externalWallets: {
                    coinbaseWallet: {
                        connectionOptions: 'smartWalletOnly',
                    },
                },

                // Default chain
                defaultChain: baseSepolia,
                supportedChains: [baseSepolia],

                // Wallet connect
                walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiConfig}>
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}
