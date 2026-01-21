import { ethers } from 'ethers';
/**
 * Ethos Reputation Updater Service
 * REQUIRED background service for keeping on-chain reputation in sync with Ethos
 */
export declare class EthosReputationUpdater {
    private ethosService;
    private reputationOracleContract;
    private signerWallet;
    private updateInterval;
    private isRunning;
    constructor(config: {
        ethosApiKey: string;
        reputationOracleAddress: string;
        reputationOracleABI: any[];
        signerPrivateKey: string;
        provider: ethers.Provider;
        updateIntervalMs?: number;
    });
    /**
     * Start automatic reputation updates
     * REQUIRED to keep on-chain data in sync with Ethos
     */
    start(): Promise<void>;
    /**
     * Stop automatic updates
     */
    stop(): void;
    /**
     * Update reputation for a single user
     * REQUIRED for individual updates
     */
    updateUserReputation(userAddress: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Batch update reputations for multiple users
     * REQUIRED for efficient bulk updates
     */
    batchUpdateReputations(userAddresses: string[]): Promise<{
        successful: number;
        failed: number;
        results: Array<{
            address: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    /**
     * Get users who need reputation updates
     * REQUIRED for identifying stale data
     */
    getUsersNeedingUpdate(): Promise<string[]>;
    /**
     * Main update loop
     * REQUIRED background process
     */
    private runUpdateLoop;
    /**
     * Verify Ethos integration is working
     * REQUIRED health check
     */
    verifyIntegration(): Promise<{
        ethosApiHealthy: boolean;
        contractAccessible: boolean;
        signerAuthorized: boolean;
        errors: string[];
    }>;
    private sleep;
}
