import { Signer } from 'ethers';
import { Config } from './types';
import { BountyService } from './services/BountyService';
import { ReputationService } from './services/ReputationService';
import { QueryService } from './services/QueryService';
/**
 * BountyBoardSDK - Main SDK class
 * Provides access to all services with business logic
 * No UI components, only logic layer
 */
export declare class BountyBoardSDK {
    private config;
    private signer;
    bounty: BountyService;
    reputation: ReputationService;
    query: QueryService;
    private constructor();
    /**
     * Initialize SDK with configuration
     * Factory method with validation
     */
    static initialize(config: Config, signer: Signer): Promise<BountyBoardSDK>;
    /**
     * Get current user address
     * Utility method
     */
    getCurrentUser(): Promise<string>;
    /**
     * Get current network
     * Utility method
     */
    getNetwork(): Promise<{
        chainId: number;
        name: string;
    }>;
    /**
     * Get configuration
     * Read-only access
     */
    getConfig(): Readonly<Config>;
}
export * from './types';
export * from './services/BountyService';
export * from './services/ReputationService';
export * from './services/QueryService';
