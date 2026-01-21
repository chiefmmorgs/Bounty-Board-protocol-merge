import { Signer } from 'ethers';
import { Config, Bounty, CreateBountyParams, TransactionOptions } from '../types';
/**
 * BountyService - Business logic for bounty operations
 * No UI logic, only contract interactions and validation
 */
export declare class BountyService {
    private config;
    private contract;
    private signer;
    constructor(config: Config, signer: Signer, contractABI: any[]);
    /**
     * Create a new bounty
     * Validates parameters and submits transaction
     */
    createBounty(params: CreateBountyParams, options?: TransactionOptions): Promise<{
        bountyId: bigint;
        txHash: string;
    }>;
    /**
     * Claim a bounty
     * Checks reputation requirements before submission
     */
    claimBounty(bountyId: bigint, options?: TransactionOptions): Promise<{
        txHash: string;
    }>;
    /**
     * Cancel a bounty
     * Only client can cancel if no submissions
     */
    cancelBounty(bountyId: bigint, options?: TransactionOptions): Promise<{
        txHash: string;
    }>;
    /**
     * Get bounty details
     * Read-only operation
     */
    getBounty(bountyId: bigint): Promise<Bounty>;
    /**
     * Get active bounty count for user
     * Read-only operation
     */
    getActiveBountyCount(address: string): Promise<number>;
    /**
     * Check if user can claim bounty
     * Business logic validation
     */
    canClaimBounty(bountyId: bigint, userAddress: string, userReputation: number, userTier: number, activeBountyCount: number): Promise<{
        canClaim: boolean;
        reason?: string;
    }>;
    /**
     * Estimate gas for creating bounty
     * Utility function
     */
    estimateCreateBountyGas(params: CreateBountyParams): Promise<bigint>;
    private validateCreateBountyParams;
    private getMaxConcurrentBounties;
    private getMaxBountyValue;
    private handleContractError;
}
