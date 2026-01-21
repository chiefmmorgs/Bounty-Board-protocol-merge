// ABI for BountyRegistry (read + write functions)
export const bountyRegistryAbi = [
    // ============ READ FUNCTIONS ============
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'getBounty',
        outputs: [
            {
                components: [
                    { name: 'bountyId', type: 'uint256' },
                    { name: 'client', type: 'address' },
                    { name: 'minRepRequired', type: 'uint16' },
                    { name: 'status', type: 'uint8' },
                    { name: 'maxRevisions', type: 'uint8' },
                    { name: 'escrowAmount', type: 'uint256' },
                    { name: 'platformFee', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'createdAt', type: 'uint256' },
                    { name: 'reviewPeriod', type: 'uint256' },
                    { name: 'requirementsHash', type: 'bytes32' },
                ],
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'bountyCounter',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'bountyAssignments',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getActiveBountyCount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'userActiveBounties',
        outputs: [{ name: '', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ============ CANCELLATION READ FUNCTIONS ============
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'getCancellationRequest',
        outputs: [
            {
                components: [
                    { name: 'bountyId', type: 'uint256' },
                    { name: 'requester', type: 'address' },
                    { name: 'requestedAt', type: 'uint256' },
                    { name: 'reviewDeadline', type: 'uint256' },
                    { name: 'reasonHash', type: 'bytes32' },
                    { name: 'processed', type: 'bool' },
                    { name: 'approved', type: 'bool' },
                ],
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'CANCELLATION_REVIEW_PERIOD',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'cancellationCounter',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ============ ROLE CHECK FUNCTIONS ============
    {
        inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }],
        name: 'hasRole',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'MODERATOR_ROLE',
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ============ WRITE FUNCTIONS ============
    {
        inputs: [
            { name: '_requirementsHash', type: 'bytes32' },
            { name: '_deadline', type: 'uint256' },
            { name: '_minRepRequired', type: 'uint16' },
            { name: '_maxRevisions', type: 'uint256' },
            { name: '_reviewPeriod', type: 'uint256' },
        ],
        name: 'createBounty',
        outputs: [{ name: 'bountyId', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'claimBounty',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // ============ MODERATION WRITE FUNCTIONS ============
    {
        inputs: [
            { name: '_bountyId', type: 'uint256' },
            { name: '_reasonHash', type: 'bytes32' },
        ],
        name: 'requestCancellation',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'approveCancellation',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_bountyId', type: 'uint256' },
            { name: '_rejectReasonHash', type: 'bytes32' },
        ],
        name: 'rejectCancellation',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'processExpiredCancellation',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Bounty status enum matching contract
export enum BountyStatus {
    Open = 0,
    InProgress = 1,
    UnderReview = 2,
    Completed = 3,
    Disputed = 4,
    Cancelled = 5,
    Expired = 6,
    PendingCancellation = 7,
}

export const statusNames = [
    'Open',
    'In Progress',
    'Under Review',
    'Completed',
    'Disputed',
    'Cancelled',
    'Expired',
    'Pending Cancellation',
] as const;

export const statusColors = {
    [BountyStatus.Open]: '#22c55e',              // green
    [BountyStatus.InProgress]: '#3b82f6',        // blue
    [BountyStatus.UnderReview]: '#f59e0b',       // amber
    [BountyStatus.Completed]: '#10b981',         // emerald
    [BountyStatus.Disputed]: '#ef4444',          // red
    [BountyStatus.Cancelled]: '#6b7280',         // gray
    [BountyStatus.Expired]: '#9ca3af',           // gray-400
    [BountyStatus.PendingCancellation]: '#f97316', // orange
} as const;

// CancellationRequest type for frontend use
export interface CancellationRequest {
    bountyId: bigint;
    requester: `0x${string}`;
    requestedAt: bigint;
    reviewDeadline: bigint;
    reasonHash: `0x${string}`;
    processed: boolean;
    approved: boolean;
}

// Bounty type for frontend use
export interface Bounty {
    bountyId: bigint;
    client: `0x${string}`;
    minRepRequired: number;      // uint16 (0-2000 Ethos score)
    status: BountyStatus;        // uint8
    maxRevisions: number;        // uint8 - NOT bigint!
    escrowAmount: bigint;
    platformFee: bigint;
    deadline: bigint;
    createdAt: bigint;
    reviewPeriod: bigint;
    requirementsHash: `0x${string}`;
}
