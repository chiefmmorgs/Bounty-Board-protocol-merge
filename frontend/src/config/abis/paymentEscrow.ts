// ABI for PaymentEscrow (read + write functions)
export const paymentEscrowAbi = [
    // ============ READ FUNCTIONS ============
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'escrowBalance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'escrowAccounts',
        outputs: [
            { name: 'totalDeposited', type: 'uint256' },
            { name: 'availableBalance', type: 'uint256' },
            { name: 'lockedAmount', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'platformFeeBalance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'platformFeePercentage',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'freelancerBalances',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ============ WRITE FUNCTIONS ============
    {
        inputs: [{ name: '_amount', type: 'uint256' }],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Escrow account type
export interface EscrowAccount {
    totalDeposited: bigint;
    availableBalance: bigint;
    lockedAmount: bigint;
}
