// Minimal ABI for ReputationOracle read functions
export const reputationOracleAbi = [
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getReputation',
        outputs: [
            {
                components: [
                    { name: 'qualityScore', type: 'uint16' },
                    { name: 'reliabilityScore', type: 'uint16' },
                    { name: 'professionalismScore', type: 'uint16' },
                    { name: 'overallScore', type: 'uint16' },
                    { name: 'tier', type: 'uint8' },
                    { name: 'totalBountiesCompleted', type: 'uint256' },
                    { name: 'totalEarnings', type: 'uint256' },
                    { name: 'disputesLost', type: 'uint256' },
                    { name: 'lastUpdated', type: 'uint256' },
                ],
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getTier',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getDisputeStats',
        outputs: [
            { name: 'initiated', type: 'uint256' },
            { name: 'lost', type: 'uint256' },
            { name: 'winRate', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Reputation tiers enum
export enum ReputationTier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3,
}

export const tierNames = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
export const tierColors = {
    [ReputationTier.Bronze]: '#CD7F32',
    [ReputationTier.Silver]: '#C0C0C0',
    [ReputationTier.Gold]: '#FFD700',
    [ReputationTier.Platinum]: '#E5E4E2',
} as const;
