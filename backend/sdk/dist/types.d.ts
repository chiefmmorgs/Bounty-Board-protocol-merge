import { z } from 'zod';
/**
 * Configuration schema validation
 */
export declare const ConfigSchema: z.ZodObject<{
    rpcUrl: z.ZodString;
    chainId: z.ZodNumber;
    contracts: z.ZodObject<{
        bountyRegistry: z.ZodString;
        submissionManager: z.ZodString;
        reputationOracle: z.ZodString;
        paymentEscrow: z.ZodString;
        disputeResolver: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        bountyRegistry: string;
        submissionManager: string;
        reputationOracle: string;
        paymentEscrow: string;
        disputeResolver: string;
    }, {
        bountyRegistry: string;
        submissionManager: string;
        reputationOracle: string;
        paymentEscrow: string;
        disputeResolver: string;
    }>;
    subgraphUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rpcUrl: string;
    chainId: number;
    contracts: {
        bountyRegistry: string;
        submissionManager: string;
        reputationOracle: string;
        paymentEscrow: string;
        disputeResolver: string;
    };
    subgraphUrl?: string | undefined;
}, {
    rpcUrl: string;
    chainId: number;
    contracts: {
        bountyRegistry: string;
        submissionManager: string;
        reputationOracle: string;
        paymentEscrow: string;
        disputeResolver: string;
    };
    subgraphUrl?: string | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
/**
 * Bounty status enum
 */
export declare enum BountyStatus {
    Open = 0,
    InProgress = 1,
    UnderReview = 2,
    Completed = 3,
    Disputed = 4,
    Cancelled = 5,
    Expired = 6
}
/**
 * Submission status enum
 */
export declare enum SubmissionStatus {
    Pending = 0,
    UnderReview = 1,
    RevisionRequested = 2,
    Accepted = 3,
    Rejected = 4,
    Disputed = 5
}
/**
 * Reputation tier enum
 */
export declare enum ReputationTier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3
}
/**
 * Dispute reason enum
 */
export declare enum DisputeReason {
    QualityIssue = 0,
    ScopeCreep = 1,
    PaymentDispute = 2,
    CommunicationIssue = 3,
    Other = 4
}
/**
 * Bounty data structure
 */
export interface Bounty {
    bountyId: bigint;
    client: string;
    minRepRequired: number;
    status: BountyStatus;
    maxRevisions: number;
    escrowAmount: bigint;
    platformFee: bigint;
    deadline: bigint;
    createdAt: bigint;
    reviewPeriod: bigint;
    requirementsHash: string;
}
/**
 * Submission data structure
 */
export interface Submission {
    submissionId: bigint;
    bountyId: bigint;
    freelancer: string;
    status: SubmissionStatus;
    revisionCount: number;
    submittedAt: bigint;
    reviewStartedAt: bigint;
    workHash: string;
    clientFeedbackHash: string;
}
/**
 * Reputation score structure
 */
export interface ReputationScore {
    qualityScore: number;
    reliabilityScore: number;
    professionalismScore: number;
    overallScore: number;
    tier: ReputationTier;
    totalBountiesCompleted: bigint;
    totalEarnings: bigint;
    disputesLost: bigint;
    lastUpdated: bigint;
}
/**
 * Dispute data structure
 */
export interface Dispute {
    disputeId: bigint;
    bountyId: bigint;
    submissionId: bigint;
    initiator: string;
    reason: DisputeReason;
    status: number;
    outcome: number;
    aiConfidenceScore: number;
    assignedArbitrator: string;
    createdAt: bigint;
    resolvedAt: bigint;
    evidenceHash: string;
    aiRecommendationHash: string;
}
/**
 * Transaction options
 */
export interface TransactionOptions {
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    nonce?: number;
}
/**
 * Create bounty parameters
 */
export interface CreateBountyParams {
    requirementsHash: string;
    deadline: bigint;
    minRepRequired: number;
    maxRevisions: number;
    reviewPeriod: bigint;
    escrowAmount: bigint;
}
/**
 * Submit work parameters
 */
export interface SubmitWorkParams {
    bountyId: bigint;
    workHash: string;
}
/**
 * Accept submission parameters
 */
export interface AcceptSubmissionParams {
    submissionId: bigint;
    feedbackHash: string;
}
/**
 * Request revision parameters
 */
export interface RequestRevisionParams {
    submissionId: bigint;
    feedbackHash: string;
}
/**
 * Initiate dispute parameters
 */
export interface InitiateDisputeParams {
    bountyId: bigint;
    submissionId: bigint;
    reason: DisputeReason;
    evidenceHash: string;
}
/**
 * Error types
 */
export declare class BountyBoardError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
export declare class ValidationError extends BountyBoardError {
    constructor(message: string, details?: unknown);
}
export declare class ContractError extends BountyBoardError {
    constructor(message: string, details?: unknown);
}
export declare class InsufficientReputationError extends BountyBoardError {
    constructor(required: number, actual: number);
}
export declare class CapacityLimitError extends BountyBoardError {
    constructor(current: number, max: number);
}
/**
 * Event types
 */
export interface BountyCreatedEvent {
    bountyId: bigint;
    client: string;
    escrowAmount: bigint;
    platformFee: bigint;
    deadline: bigint;
    minRepRequired: number;
    requirementsHash: string;
    timestamp: bigint;
}
export interface BountyClaimedEvent {
    bountyId: bigint;
    freelancer: string;
    freelancerReputation: number;
    timestamp: bigint;
}
export interface WorkSubmittedEvent {
    submissionId: bigint;
    bountyId: bigint;
    freelancer: string;
    workHash: string;
    onTime: boolean;
    timestamp: bigint;
}
export interface SubmissionAcceptedEvent {
    submissionId: bigint;
    bountyId: bigint;
    freelancer: string;
    paymentAmount: bigint;
    platformFee: bigint;
    feedbackHash: string;
    timestamp: bigint;
}
/**
 * Tier limits
 */
export declare const TIER_LIMITS: {
    readonly 0: {
        readonly maxConcurrent: 2;
        readonly maxBountyValue: bigint;
        readonly withdrawalInterval: number;
    };
    readonly 1: {
        readonly maxConcurrent: 5;
        readonly maxBountyValue: bigint;
        readonly withdrawalInterval: number;
    };
    readonly 2: {
        readonly maxConcurrent: 10;
        readonly maxBountyValue: bigint;
        readonly withdrawalInterval: number;
    };
    readonly 3: {
        readonly maxConcurrent: 20;
        readonly maxBountyValue: bigint;
        readonly withdrawalInterval: 0;
    };
};
/**
 * Constants
 */
export declare const MIN_ESCROW_AMOUNT: bigint;
export declare const MAX_REVIEW_PERIOD: number;
export declare const DEFAULT_REVIEW_PERIOD: number;
export declare const DEFAULT_MAX_REVISIONS = 2;
export declare const MIN_QUALITY_SCORE_FOR_RESUBMISSION = 30;
export declare const AI_CONFIDENCE_THRESHOLD = 70;
export declare const MIN_DISPUTE_WIN_RATE = 30;
