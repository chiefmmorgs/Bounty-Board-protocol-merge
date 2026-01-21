import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Custom Base Sepolia with our RPC
const customBaseSepolia = {
    ...baseSepolia,
    rpcUrls: {
        default: {
            http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'],
        },
        public: {
            http: ['https://sepolia.base.org'],
        },
    },
};

export const config = getDefaultConfig({
    appName: 'Bounty Board',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
    chains: [customBaseSepolia],
    transports: {
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
    },
    ssr: true,
});
