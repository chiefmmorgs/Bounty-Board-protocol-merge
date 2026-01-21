'use client';

import { useSocialLinking } from '@/hooks';

const socialConfig = [
    {
        key: 'twitter',
        name: 'X (Twitter)',
        icon: '𝕏',
        color: 'bg-charcoal-500 hover:bg-charcoal-400',
        linkedColor: 'bg-charcoal-600',
    },
    {
        key: 'google',
        name: 'Google',
        icon: 'G',
        color: 'bg-red-600 hover:bg-red-700',
        linkedColor: 'bg-red-600/80',
    },
] as const;

export function SocialConnections() {
    const {
        twitter,
        google,
        linkTwitter,
        linkGoogle,
    } = useSocialLinking();

    const linkedStatus = {
        twitter,
        google,
    };

    const linkFunctions = {
        twitter: linkTwitter,
        google: linkGoogle,
    };

    return (
        <div className="card">
            <h3 className="text-sm font-medium text-bone-400 mb-4 tracking-wide uppercase">
                Connected Accounts
            </h3>
            <p className="text-sm text-bone-500 mb-6">
                Link your social accounts to build credibility and improve your reputation score.
            </p>

            <div className="space-y-3">
                {socialConfig.map((social) => {
                    const isLinked = !!linkedStatus[social.key];
                    const linkedInfo = linkedStatus[social.key];

                    return (
                        <div
                            key={social.key}
                            className="flex items-center justify-between p-3 rounded-lg bg-charcoal-700 border border-charcoal-500"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-bone-200 font-bold ${isLinked ? social.linkedColor : 'bg-charcoal-600'}`}>
                                    {social.icon}
                                </div>
                                <div>
                                    <p className="text-bone-200 font-medium">{social.name}</p>
                                    {isLinked && linkedInfo && (
                                        <p className="text-sm text-bone-500">
                                            {'username' in linkedInfo ? `@${linkedInfo.username}` : linkedInfo.email}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {isLinked ? (
                                <span className="flex items-center gap-2 text-green-400 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-green-400" />
                                    Connected
                                </span>
                            ) : (
                                <button
                                    onClick={() => linkFunctions[social.key]()}
                                    className={`px-4 py-2 rounded-lg text-bone-100 text-sm font-medium transition-colors ${social.color}`}
                                >
                                    Connect
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="text-xs text-bone-600 mt-4">
                Your social connections are verified via Privy and contribute to your Ethos reputation.
            </p>
        </div>
    );
}
