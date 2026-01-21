/**
 * Ethos user data as returned by the API v2
 */
export interface EthosUser {
    id: number;
    profileId: number;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    description: string | null;
    score: number;
    status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
    userkeys: string[];
    xpTotal: number;
    xpStreakDays: number;
    xpRemovedDueToAbuse: boolean;
    influenceFactor: number;
    influenceFactorPercentile: number;
    links: {
        profile: string;
        scoreBreakdown: string;
    };
    stats: {
        review: {
            received: {
                negative: number;
                neutral: number;
                positive: number;
            };
        };
        vouch: {
            given: {
                amountWeiTotal: number;
                count: number;
            };
            received: {
                amountWeiTotal: number;
                count: number;
            };
        };
    };
}
/**
 * EthosService - Required integration with Ethos Network API v2
 * This is NOT optional - reputation system depends on Ethos
 */
export declare class EthosService {
    private client;
    private apiKey;
    constructor(config: {
        apiKey: string;
        baseUrl?: string;
    });
    /**
     * Get Ethos user by address (API v2)
     * Returns full user data including score
     */
    getUserByAddress(address: string): Promise<EthosUser | null>;
    /**
     * Get Ethos score for an address
     * REQUIRED for reputation calculation
     */
    getScore(address: string): Promise<{
        score: number;
        credibilityScore: number;
        positiveReviewCount: number;
        negativeReviewCount: number;
        neutralReviewCount: number;
        lastUpdated: Date;
    }>;
    /**
     * Get detailed profile from Ethos (API v2)
     * REQUIRED for comprehensive reputation assessment
     */
    getProfile(address: string): Promise<{
        address: string;
        score: number;
        user: EthosUser | null;
        reviews: Array<{
            author: string;
            score: number;
            comment: string;
            timestamp: Date;
        }>;
        vouches: Array<{
            voucher: string;
            timestamp: Date;
        }>;
        attestations: Array<{
            service: string;
            verified: boolean;
            timestamp: Date;
        }>;
    }>;
    /**
     * Calculate platform reputation from Ethos score
     * REQUIRED mapping from Ethos (0-2000) to platform scores (0-100)
     */
    calculatePlatformReputation(ethosData: {
        score: number;
        credibilityScore: number;
        positiveReviewCount: number;
        negativeReviewCount: number;
        neutralReviewCount: number;
    }): {
        qualityScore: number;
        reliabilityScore: number;
        professionalismScore: number;
        overallScore: number;
    };
    /**
     * Generate signature for on-chain reputation update
     * REQUIRED for secure reputation updates
     */
    generateReputationSignature(userAddress: string, qualityScore: number, reliabilityScore: number, professionalismScore: number, signerPrivateKey: string): Promise<string>;
    /**
     * Batch get users by addresses (API v2)
     * REQUIRED for efficient reputation updates
     */
    batchGetUsers(addresses: string[]): Promise<Map<string, EthosUser>>;
    /**
     * Batch update reputations for multiple users
     * REQUIRED for efficient reputation updates
     */
    batchGetScores(addresses: string[]): Promise<Map<string, {
        score: number;
        credibilityScore: number;
        positiveReviewCount: number;
        negativeReviewCount: number;
        neutralReviewCount: number;
    }>>;
    /**
     * Get user by Twitter/X username (API v2)
     */
    getUserByTwitter(usernameOrId: string): Promise<EthosUser | null>;
    /**
     * Get user by Discord ID (API v2)
     */
    getUserByDiscord(discordId: string): Promise<EthosUser | null>;
    /**
     * Search users (API v2)
     */
    searchUsers(query: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        users: EthosUser[];
        total: number;
    }>;
    /**
     * Verify Ethos attestation
     * REQUIRED for user verification
     */
    verifyAttestation(address: string, service: string): Promise<boolean>;
    /**
     * Get minimum required Ethos score for platform access
     * REQUIRED threshold enforcement (on 0-2000 scale)
     */
    getMinimumEthosScore(): number;
    /**
     * Check if user meets minimum Ethos requirements
     * REQUIRED validation before platform access
     */
    meetsMinimumRequirements(address: string): Promise<{
        meets: boolean;
        reason?: string;
        ethosScore: number;
    }>;
    /**
     * Health check for Ethos API
     * REQUIRED to ensure service availability
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
/**
 * Ethos webhook handler for real-time updates
 * REQUIRED for keeping reputation in sync
 */
export declare class EthosWebhookHandler {
    private webhookSecret;
    constructor(webhookSecret: string);
    /**
     * Verify webhook signature
     * REQUIRED for security
     */
    verifySignature(payload: string, signature: string): boolean;
    /**
     * Process webhook event
     * REQUIRED for handling Ethos updates
     */
    processEvent(event: {
        type: 'score_updated' | 'review_added' | 'vouch_added' | 'attestation_verified';
        address: string;
        data: any;
        timestamp: string;
    }): Promise<{
        shouldUpdateOnChain: boolean;
        newScores?: {
            qualityScore: number;
            reliabilityScore: number;
            professionalismScore: number;
        };
    }>;
}
