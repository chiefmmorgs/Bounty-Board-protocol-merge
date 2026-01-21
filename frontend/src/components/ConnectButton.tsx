'use client';

import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectButton() {
    return (
        <RainbowConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === 'authenticated');

                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors"
                                    >
                                        Wrong Network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={openChainModal}
                                        className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 text-white py-2 px-4 rounded-xl transition-colors border border-gray-700"
                                    >
                                        {chain.hasIcon && chain.iconUrl && (
                                            <img
                                                alt={chain.name ?? 'Chain icon'}
                                                src={chain.iconUrl}
                                                className="w-5 h-5 rounded-full"
                                            />
                                        )}
                                        <span className="text-sm font-medium">{chain.name}</span>
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        className="bg-gray-800/50 hover:bg-gray-700/50 text-white py-2 px-4 rounded-xl transition-colors border border-gray-700"
                                    >
                                        <span className="text-sm font-medium">
                                            {account.displayName}
                                        </span>
                                        {account.displayBalance && (
                                            <span className="ml-2 text-gray-400 text-sm">
                                                {account.displayBalance}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </RainbowConnectButton.Custom>
    );
}
