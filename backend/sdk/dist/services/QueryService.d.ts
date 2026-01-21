import { Bounty, Submission, ReputationScore, Dispute, BountyStatus } from '../types';
/**
 * QueryService - Read model queries via The Graph
 * No business logic, only data fetching and transformation
 */
export declare class QueryService {
    private subgraphUrl;
    constructor(subgraphUrl: string);
    /**
     * Get bounties with filters
     * Read-only query
     */
    getBounties(params: {
        status?: BountyStatus;
        minEscrow?: bigint;
        maxMinRep?: number;
        first?: number;
        skip?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    }): Promise<Bounty[]>;
    /**
     * Get user profile with stats
     * Read-only query
     */
    getUserProfile(address: string): Promise<{
        reputation: ReputationScore;
        stats: {
            totalBountiesCreated: bigint;
            totalBountiesClaimed: bigint;
            totalBountiesCompleted: bigint;
            totalEarnings: bigint;
            totalSpent: bigint;
            disputesInitiated: bigint;
            disputesLost: bigint;
            lateSubmissions: bigint;
        };
        recentActivity: Array<{
            type: string;
            timestamp: bigint;
            details: any;
        }>;
    }>;
    /**
     * Get platform statistics
     * Read-only query
     */
    getPlatformStats(): Promise<{
        totalBountiesCreated: bigint;
        totalBountiesCompleted: bigint;
        totalValueLocked: bigint;
        totalValuePaid: bigint;
        totalUsers: bigint;
        totalDisputes: bigint;
    }>;
    /**
     * Get bounty with full details
     * Read-only query
     */
    getBountyDetails(bountyId: string): Promise<{
        bounty: Bounty;
        submission?: Submission;
        dispute?: Dispute;
        statusHistory: Array<{
            oldStatus: BountyStatus;
            newStatus: BountyStatus;
            timestamp: bigint;
        }>;
    }>;
    /**
     * Search bounties by requirements
     * Read-only query with text search
     */
    searchBounties(params: {
        searchText?: string;
        minEscrow?: bigint;
        maxMinRep?: number;
        status?: BountyStatus;
        first?: number;
    }): Promise<Bounty[]>;
    private transformBounties;
    private transformBounty;
    private transformSubmission;
    private transformDispute;
    private parseStatus;
    private parseSubmissionStatus;
    private parseTier;
}
