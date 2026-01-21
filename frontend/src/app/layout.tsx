import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Bounty Board | Decentralized Bounty Platform',
    description: 'Create, claim, and complete bounties on Base. Powered by AI-assisted reputation and dispute resolution.',
    keywords: ['bounty', 'freelance', 'web3', 'base', 'ethereum', 'decentralized'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-gray-950 text-white min-h-screen antialiased`}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
