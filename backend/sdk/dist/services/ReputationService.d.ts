import { Signer } from 'ethers';
import { Config, ReputationScore, ReputationTier } from '../types';
/**
 * ReputationService - Business logic for reputation operations
 * No UI logic, only contract interactions and calculations
 */
export declare class ReputationService {
    private config;
    private contract;
    private signer;
    constructor(config: Config, signer: Signer, contractABI: any[]);
    /**
     * Get reputation score for user
     * Read-only operation
     */
    getReputation(address: string): Promise<ReputationScore>;
    /**
     * Get reputation tier for user
     * Read-only operation
     */
    getTier(address: string): Promise<ReputationTier>;
    /**
     * Check if user meets reputation requirement
     * Read-only operation
     */
    meetsRepRequirement(address: string, minRep: number): Promise<boolean>;
    /**
     * Get dispute statistics for user
     * Read-only operation
     */
    getDisputeStats(address: string): Promise<{
        initiated: bigint;
        lost: bigint;
        winRate: bigint;
    }>;
    /**
     * Calculate tier from overall score
     * Pure business logic (client-side calculation)
     */
    calculateTier(overallScore: number): ReputationTier;
    /**
     * Calculate overall score from component scores
     * Pure business logic (matches contract calculation)
     */
    calculateOverallScore(quality: number, reliability: number, professionalism: number): number;
    /**
     * Get tier benefits
     * Pure business logic (informational)
     */
    getTierBenefits(tier: ReputationTier): {
        maxConcurrent: number;
        maxBountyValue: string;
        withdrawalInterval: string;
        tierName: string;
    };
    /**
     * Check if user can initiate dispute
     * Business logic validation
     */
    canInitiateDispute(address: string): Promise<{
        canInitiate: boolean;
        reason?: string;
    }>;
    /**
     * Estimate reputation decay
     * Pure business logic (client-side calculation)
     */
    estimateDecay(currentScore: number, lastActivityTimestamp: bigint): {
        decayedScore: number;
        decayAmount: number;
    };
    /**
     * Get next tier requirements
     * Pure business logic (informational)
     */
    getNextTierRequirements(currentTier: ReputationTier): {
        nextTier: ReputationTier | null;
        requiredScore: number;
        pointsNeeded: number;
    } | null;
    private handleContractError;
}
