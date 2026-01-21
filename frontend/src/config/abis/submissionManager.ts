// ABI for SubmissionManager (read + write functions)
export const submissionManagerAbi = [
    // ============ READ FUNCTIONS ============
    {
        inputs: [{ name: '_submissionId', type: 'uint256' }],
        name: 'submissions',
        outputs: [
            { name: 'submissionId', type: 'uint256' },
            { name: 'bountyId', type: 'uint256' },
            { name: 'freelancer', type: 'address' },
            { name: 'status', type: 'uint8' },
            { name: 'revisionCount', type: 'uint256' },
            { name: 'submittedAt', type: 'uint256' },
            { name: 'reviewStartedAt', type: 'uint256' },
            { name: 'workHash', type: 'bytes32' },
            { name: 'clientFeedbackHash', type: 'bytes32' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: '_bountyId', type: 'uint256' }],
        name: 'bountyToSubmission',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'submissionCounter',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ============ WRITE FUNCTIONS ============
    {
        inputs: [
            { name: '_bountyId', type: 'uint256' },
            { name: '_workHash', type: 'bytes32' },
        ],
        name: 'submitWork',
        outputs: [{ name: 'submissionId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: '_submissionId', type: 'uint256' }],
        name: 'startReview',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_submissionId', type: 'uint256' },
            { name: '_feedbackHash', type: 'bytes32' },
        ],
        name: 'acceptSubmission',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: '_submissionId', type: 'uint256' },
            { name: '_feedbackHash', type: 'bytes32' },
        ],
        name: 'rejectSubmission',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

// Submission status enum
export enum SubmissionStatus {
    Pending = 0,
    UnderReview = 1,
    Accepted = 2,
    Rejected = 3,
    Disputed = 4,
}

export const submissionStatusNames = [
    'Pending',
    'Under Review',
    'Accepted',
    'Rejected',
    'Disputed',
] as const;

// Submission type
export interface Submission {
    submissionId: bigint;
    bountyId: bigint;
    freelancer: `0x${string}`;
    status: SubmissionStatus;
    revisionCount: bigint;
    submittedAt: bigint;
    reviewStartedAt: bigint;
    workHash: `0x${string}`;
    clientFeedbackHash: `0x${string}`;
}
