'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo, useCallback } from 'react';

export interface LinkedAccount {
    type: 'twitter' | 'google' | 'discord' | 'github' | 'email' | 'wallet';
    identifier: string; // username, email, or address
    verified?: boolean;
}

export interface PrivyUser {
    privyUserId: string | undefined;
    email: string | undefined;
    walletAddress: `0x${string}` | undefined;
    isAuthenticated: boolean;
    isReady: boolean;
    hasEmbeddedWallet: boolean;
    // Social accounts
    linkedAccounts: LinkedAccount[];
    twitter: { username: string } | null;
    google: { email: string } | null;
    discord: { username: string } | null;
    github: { username: string } | null;
}

/**
 * Hook to access Privy user identity and wallet
 */
export function usePrivyUser(): PrivyUser {
    const { ready, authenticated, user } = usePrivy();
    const { wallets } = useWallets();

    return useMemo(() => {
        // Find the active wallet (embedded or external)
        const activeWallet = wallets.find(w => w.walletClientType === 'privy')
            || wallets[0];

        // Get email if logged in via email
        const email = user?.email?.address;

        // Get wallet address
        const walletAddress = activeWallet?.address as `0x${string}` | undefined;

        // Check if user has an embedded wallet
        const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');

        // Parse linked accounts from Privy user
        const linkedAccounts: LinkedAccount[] = [];
        let twitter: { username: string } | null = null;
        let google: { email: string } | null = null;
        let discord: { username: string } | null = null;
        let github: { username: string } | null = null;

        if (user?.linkedAccounts) {
            for (const account of user.linkedAccounts) {
                if (account.type === 'twitter_oauth') {
                    const twitterUser = account as any;
                    twitter = { username: twitterUser.username || twitterUser.name };
                    linkedAccounts.push({
                        type: 'twitter',
                        identifier: twitter.username,
                        verified: true,
                    });
                } else if (account.type === 'google_oauth') {
                    const googleUser = account as any;
                    google = { email: googleUser.email };
                    linkedAccounts.push({
                        type: 'google',
                        identifier: google.email,
                        verified: true,
                    });
                } else if (account.type === 'discord_oauth') {
                    const discordUser = account as any;
                    discord = { username: discordUser.username };
                    linkedAccounts.push({
                        type: 'discord',
                        identifier: discord.username,
                        verified: true,
                    });
                } else if (account.type === 'github_oauth') {
                    const githubUser = account as any;
                    github = { username: githubUser.username };
                    linkedAccounts.push({
                        type: 'github',
                        identifier: github.username,
                        verified: true,
                    });
                } else if (account.type === 'email') {
                    linkedAccounts.push({
                        type: 'email',
                        identifier: (account as any).address,
                        verified: (account as any).verified,
                    });
                } else if (account.type === 'wallet') {
                    linkedAccounts.push({
                        type: 'wallet',
                        identifier: (account as any).address,
                        verified: true,
                    });
                }
            }
        }

        return {
            privyUserId: user?.id,
            email,
            walletAddress,
            isAuthenticated: authenticated,
            isReady: ready,
            hasEmbeddedWallet,
            linkedAccounts,
            twitter,
            google,
            discord,
            github,
        };
    }, [ready, authenticated, user, wallets]);
}

/**
 * Hook for social account linking functions
 */
export function useSocialLinking() {
    const { linkTwitter, linkGoogle, linkDiscord, linkGithub, unlinkTwitter, unlinkGoogle, unlinkDiscord, unlinkGithub } = usePrivy();
    const { twitter, google, discord, github } = usePrivyUser();

    return {
        // Current state
        twitter,
        google,
        discord,
        github,
        // Link functions
        linkTwitter: useCallback(() => linkTwitter(), [linkTwitter]),
        linkGoogle: useCallback(() => linkGoogle(), [linkGoogle]),
        linkDiscord: useCallback(() => linkDiscord(), [linkDiscord]),
        linkGithub: useCallback(() => linkGithub(), [linkGithub]),
        // Unlink functions
        unlinkTwitter: useCallback((subject: string) => unlinkTwitter(subject), [unlinkTwitter]),
        unlinkGoogle: useCallback((email: string) => unlinkGoogle(email), [unlinkGoogle]),
        unlinkDiscord: useCallback((subject: string) => unlinkDiscord(subject), [unlinkDiscord]),
        unlinkGithub: useCallback((subject: string) => unlinkGithub(subject), [unlinkGithub]),
    };
}

/**
 * Hook to get the active wallet for transactions
 */
export function usePrivyWallet() {
    const { wallets } = useWallets();

    const activeWallet = useMemo(() => {
        // Prefer embedded wallet, then external
        return wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    }, [wallets]);

    return {
        wallet: activeWallet,
        address: activeWallet?.address as `0x${string}` | undefined,
        isConnected: !!activeWallet,
        walletType: activeWallet?.walletClientType,
    };
}
