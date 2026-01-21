"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const graphql_request_1 = require("graphql-request");
const types_1 = require("../types");
/**
 * QueryService - Read model queries via The Graph
 * No business logic, only data fetching and transformation
 */
class QueryService {
    constructor(subgraphUrl) {
        this.subgraphUrl = subgraphUrl;
    }
    /**
     * Get bounties with filters
     * Read-only query
     */
    async getBounties(params) {
        const query = (0, graphql_request_1.gql) `
      query GetBounties(
        $status: BountyStatus
        $minEscrow: BigInt
        $maxMinRep: Int
        $first: Int
        $skip: Int
        $orderBy: String
        $orderDirection: String
      ) {
        bounties(
          where: {
            status: $status
            escrowAmount_gte: $minEscrow
            minRepRequired_lte: $maxMinRep
          }
          first: $first
          skip: $skip
          orderBy: $orderBy
          orderDirection: $orderDirection
        ) {
          id
          bountyId
          client { id }
          escrowAmount
          platformFee
          deadline
          minRepRequired
          requirementsHash
          status
          maxRevisions
          reviewPeriod
          createdAt
          claimedBy { id }
          claimedAt
        }
      }
    `;
        const data = await (0, graphql_request_1.request)(this.subgraphUrl, query, params);
        return this.transformBounties(data.bounties);
    }
    /**
     * Get user profile with stats
     * Read-only query
     */
    async getUserProfile(address) {
        const query = (0, graphql_request_1.gql) `
      query GetUserProfile($address: ID!) {
        user(id: $address) {
          qualityScore
          reliabilityScore
          professionalismScore
          overallScore
          tier
          totalBountiesCreated
          totalBountiesClaimed
          totalBountiesCompleted
          totalEarnings
          totalSpent
          disputesInitiated
          disputesLost
          lateSubmissions
          lastReputationUpdate
          lastActivityAt
          reputationHistory(
            orderBy: timestamp
            orderDirection: desc
            first: 10
          ) {
            changeType
            timestamp
            reason
          }
        }
      }
    `;
        const data = await (0, graphql_request_1.request)(this.subgraphUrl, query, { address: address.toLowerCase() });
        const user = data.user;
        if (!user) {
            throw new Error('User not found');
        }
        return {
            reputation: {
                qualityScore: user.qualityScore,
                reliabilityScore: user.reliabilityScore,
                professionalismScore: user.professionalismScore,
                overallScore: user.overallScore,
                tier: this.parseTier(user.tier),
                totalBountiesCompleted: BigInt(user.totalBountiesCompleted),
                totalEarnings: BigInt(user.totalEarnings),
                disputesLost: BigInt(user.disputesLost),
                lastUpdated: BigInt(user.lastReputationUpdate),
            },
            stats: {
                totalBountiesCreated: BigInt(user.totalBountiesCreated),
                totalBountiesClaimed: BigInt(user.totalBountiesClaimed),
                totalBountiesCompleted: BigInt(user.totalBountiesCompleted),
                totalEarnings: BigInt(user.totalEarnings),
                totalSpent: BigInt(user.totalSpent),
                disputesInitiated: BigInt(user.disputesInitiated),
                disputesLost: BigInt(user.disputesLost),
                lateSubmissions: BigInt(user.lateSubmissions),
            },
            recentActivity: user.reputationHistory.map((h) => ({
                type: h.changeType,
                timestamp: BigInt(h.timestamp),
                details: { reason: h.reason },
            })),
        };
    }
    /**
     * Get platform statistics
     * Read-only query
     */
    async getPlatformStats() {
        const query = (0, graphql_request_1.gql) `
      query GetPlatformStats {
        platformStats(id: "platform-stats") {
          totalBountiesCreated
          totalBountiesCompleted
          totalValueLocked
          totalValuePaid
          totalUsers
          totalDisputes
        }
      }
    `;
        const data = await (0, graphql_request_1.request)(this.subgraphUrl, query);
        const stats = data.platformStats;
        return {
            totalBountiesCreated: BigInt(stats.totalBountiesCreated),
            totalBountiesCompleted: BigInt(stats.totalBountiesCompleted),
            totalValueLocked: BigInt(stats.totalValueLocked),
            totalValuePaid: BigInt(stats.totalValuePaid),
            totalUsers: BigInt(stats.totalUsers),
            totalDisputes: BigInt(stats.totalDisputes),
        };
    }
    /**
     * Get bounty with full details
     * Read-only query
     */
    async getBountyDetails(bountyId) {
        const query = (0, graphql_request_1.gql) `
      query GetBountyDetails($bountyId: ID!) {
        bounty(id: $bountyId) {
          id
          bountyId
          client { id }
          escrowAmount
          platformFee
          deadline
          minRepRequired
          requirementsHash
          status
          maxRevisions
          reviewPeriod
          createdAt
          claimedBy { id }
          claimedAt
          submission {
            id
            submissionId
            freelancer { id }
            workHash
            submittedAt
            onTime
            status
            revisionCount
            reviewStartedAt
            reviewDeadline
            acceptedAt
            rejectedAt
            feedbackHash
          }
          dispute {
            id
            disputeId
            initiator { id }
            reason
            status
            outcome
            createdAt
            resolvedAt
          }
          statusChanges(orderBy: timestamp) {
            oldStatus
            newStatus
            timestamp
          }
        }
      }
    `;
        const data = await (0, graphql_request_1.request)(this.subgraphUrl, query, { bountyId });
        const bounty = data.bounty;
        if (!bounty) {
            throw new Error('Bounty not found');
        }
        return {
            bounty: this.transformBounty(bounty),
            submission: bounty.submission ? this.transformSubmission(bounty.submission) : undefined,
            dispute: bounty.dispute ? this.transformDispute(bounty.dispute) : undefined,
            statusHistory: bounty.statusChanges.map((sc) => ({
                oldStatus: this.parseStatus(sc.oldStatus),
                newStatus: this.parseStatus(sc.newStatus),
                timestamp: BigInt(sc.timestamp),
            })),
        };
    }
    /**
     * Search bounties by requirements
     * Read-only query with text search
     */
    async searchBounties(params) {
        // Note: The Graph doesn't support full-text search natively
        // This would require an external search service (Algolia, Elasticsearch, etc.)
        // For now, we filter by other parameters
        return this.getBounties({
            status: params.status,
            minEscrow: params.minEscrow,
            maxMinRep: params.maxMinRep,
            first: params.first,
        });
    }
    // ============ TRANSFORMATION HELPERS ============
    transformBounties(bounties) {
        return bounties.map(b => this.transformBounty(b));
    }
    transformBounty(b) {
        return {
            bountyId: BigInt(b.bountyId),
            client: b.client.id,
            minRepRequired: b.minRepRequired,
            status: this.parseStatus(b.status),
            maxRevisions: b.maxRevisions,
            escrowAmount: BigInt(b.escrowAmount),
            platformFee: BigInt(b.platformFee),
            deadline: BigInt(b.deadline),
            createdAt: BigInt(b.createdAt),
            reviewPeriod: BigInt(b.reviewPeriod),
            requirementsHash: b.requirementsHash,
        };
    }
    transformSubmission(s) {
        return {
            submissionId: BigInt(s.submissionId),
            bountyId: BigInt(s.bountyId),
            freelancer: s.freelancer.id,
            status: this.parseSubmissionStatus(s.status),
            revisionCount: s.revisionCount,
            submittedAt: BigInt(s.submittedAt),
            reviewStartedAt: BigInt(s.reviewStartedAt || 0),
            workHash: s.workHash,
            clientFeedbackHash: s.feedbackHash || '',
        };
    }
    transformDispute(d) {
        return {
            disputeId: BigInt(d.disputeId),
            bountyId: BigInt(d.bountyId),
            submissionId: BigInt(d.submissionId),
            initiator: d.initiator.id,
            reason: parseInt(d.reason),
            status: parseInt(d.status),
            outcome: parseInt(d.outcome),
            aiConfidenceScore: 0,
            assignedArbitrator: '',
            createdAt: BigInt(d.createdAt),
            resolvedAt: BigInt(d.resolvedAt || 0),
            evidenceHash: '',
            aiRecommendationHash: '',
        };
    }
    parseStatus(status) {
        const statusMap = {
            'Open': types_1.BountyStatus.Open,
            'InProgress': types_1.BountyStatus.InProgress,
            'UnderReview': types_1.BountyStatus.UnderReview,
            'Completed': types_1.BountyStatus.Completed,
            'Disputed': types_1.BountyStatus.Disputed,
            'Cancelled': types_1.BountyStatus.Cancelled,
            'Expired': types_1.BountyStatus.Expired,
        };
        return statusMap[status] || types_1.BountyStatus.Open;
    }
    parseSubmissionStatus(status) {
        const statusMap = {
            'Pending': types_1.SubmissionStatus.Pending,
            'UnderReview': types_1.SubmissionStatus.UnderReview,
            'RevisionRequested': types_1.SubmissionStatus.RevisionRequested,
            'Accepted': types_1.SubmissionStatus.Accepted,
            'Rejected': types_1.SubmissionStatus.Rejected,
            'Disputed': types_1.SubmissionStatus.Disputed,
        };
        return statusMap[status] || types_1.SubmissionStatus.Pending;
    }
    parseTier(tier) {
        const tierMap = {
            'Bronze': types_1.ReputationTier.Bronze,
            'Silver': types_1.ReputationTier.Silver,
            'Gold': types_1.ReputationTier.Gold,
            'Platinum': types_1.ReputationTier.Platinum,
        };
        return tierMap[tier] || types_1.ReputationTier.Bronze;
    }
}
exports.QueryService = QueryService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXVlcnlTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NlcnZpY2VzL1F1ZXJ5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBK0M7QUFDL0Msb0NBUWtCO0FBRWxCOzs7R0FHRztBQUNILE1BQWEsWUFBWTtJQUN2QixZQUFvQixXQUFtQjtRQUFuQixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtJQUFJLENBQUM7SUFFNUM7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQVFqQjtRQUNDLE1BQU0sS0FBSyxHQUFHLElBQUEscUJBQUcsRUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXFDaEIsQ0FBQztRQUVGLE1BQU0sSUFBSSxHQUFRLE1BQU0sSUFBQSx5QkFBTyxFQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLGNBQWMsQ0FBQyxPQUFlO1FBa0JsQyxNQUFNLEtBQUssR0FBRyxJQUFBLHFCQUFHLEVBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0tBNkJoQixDQUFDO1FBRUYsTUFBTSxJQUFJLEdBQVEsTUFBTSxJQUFBLHlCQUFPLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3RixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBRXZCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBRUQsT0FBTztZQUNM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Z3FsIH0gZnJvbSAnZ3JhcGhxbC1yZXF1ZXN0JztcclxuaW1wb3J0IHtcclxuICBCb3VudHksXHJcbiAgU3VibWlzc2lvbixcclxuICBSZXB1dGF0aW9uU2NvcmUsXHJcbiAgRGlzcHV0ZSxcclxuICBCb3VudHlTdGF0dXMsXHJcbiAgU3VibWlzc2lvblN0YXR1cyxcclxuICBSZXB1dGF0aW9uVGllcixcclxufSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogUXVlcnlTZXJ2aWNlIC0gUmVhZCBtb2RlbCBxdWVyaWVzIHZpYSBUaGUgR3JhcGhcclxuICogTm8gYnVzaW5lc3MgbG9naWMsIG9ubHkgZGF0YSBmZXRjaGluZyBhbmQgdHJhbnNmb3JtYXRpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBRdWVyeVNlcnZpY2Uge1xyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3ViZ3JhcGhVcmw6IHN0cmluZykgeyB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBib3VudGllcyB3aXRoIGZpbHRlcnNcclxuICAgKiBSZWFkLW9ubHkgcXVlcnlcclxuICAgKi9cclxuICBhc3luYyBnZXRCb3VudGllcyhwYXJhbXM6IHtcclxuICAgIHN0YXR1cz86IEJvdW50eVN0YXR1cztcclxuICAgIG1pbkVzY3Jvdz86IGJpZ2ludDtcclxuICAgIG1heE1pblJlcD86IG51bWJlcjtcclxuICAgIGZpcnN0PzogbnVtYmVyO1xyXG4gICAgc2tpcD86IG51bWJlcjtcclxuICAgIG9yZGVyQnk/OiBzdHJpbmc7XHJcbiAgICBvcmRlckRpcmVjdGlvbj86ICdhc2MnIHwgJ2Rlc2MnO1xyXG4gIH0pOiBQcm9taXNlPEJvdW50eVtdPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IGdxbGBcclxuICAgICAgcXVlcnkgR2V0Qm91bnRpZXMoXHJcbiAgICAgICAgJHN0YXR1czogQm91bnR5U3RhdHVzXHJcbiAgICAgICAgJG1pbkVzY3JvdzogQmlnSW50XHJcbiAgICAgICAgJG1heE1pblJlcDogSW50XHJcbiAgICAgICAgJGZpcnN0OiBJbnRcclxuICAgICAgICAkc2tpcDogSW50XHJcbiAgICAgICAgJG9yZGVyQnk6IFN0cmluZ1xyXG4gICAgICAgICRvcmRlckRpcmVjdGlvbjogU3RyaW5nXHJcbiAgICAgICkge1xyXG4gICAgICAgIGJvdW50aWVzKFxyXG4gICAgICAgICAgd2hlcmU6IHtcclxuICAgICAgICAgICAgc3RhdHVzOiAkc3RhdHVzXHJcbiAgICAgICAgICAgIGVzY3Jvd0Ftb3VudF9ndGU6ICRtaW5Fc2Nyb3dcclxuICAgICAgICAgICAgbWluUmVwUmVxdWlyZWRfbHRlOiAkbWF4TWluUmVwXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBmaXJzdDogJGZpcnN0XHJcbiAgICAgICAgICBza2lwOiAkc2tpcFxyXG4gICAgICAgICAgb3JkZXJCeTogJG9yZGVyQnlcclxuICAgICAgICAgIG9yZGVyRGlyZWN0aW9uOiAkb3JkZXJEaXJlY3Rpb25cclxuICAgICAgICApIHtcclxuICAgICAgICAgIGlkXHJcbiAgICAgICAgICBib3VudHlJZFxyXG4gICAgICAgICAgY2xpZW50IHsgaWQgfVxyXG4gICAgICAgICAgZXNjcm93QW1vdW50XHJcbiAgICAgICAgICBwbGF0Zm9ybUZlZVxyXG4gICAgICAgICAgZGVhZGxpbmVcclxuICAgICAgICAgIG1pblJlcFJlcXVpcmVkXHJcbiAgICAgICAgICByZXF1aXJlbWVudHNIYXNoXHJcbiAgICAgICAgICBzdGF0dXNcclxuICAgICAgICAgIG1heFJldmlzaW9uc1xyXG4gICAgICAgICAgcmV2aWV3UGVyaW9kXHJcbiAgICAgICAgICBjcmVhdGVkQXRcclxuICAgICAgICAgIGNsYWltZWRCeSB7IGlkIH1cclxuICAgICAgICAgIGNsYWltZWRBdFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgYDtcclxuXHJcbiAgICBjb25zdCBkYXRhOiBhbnkgPSBhd2FpdCByZXF1ZXN0KHRoaXMuc3ViZ3JhcGhVcmwsIHF1ZXJ5LCBwYXJhbXMpO1xyXG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtQm91bnRpZXMoZGF0YS5ib3VudGllcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdXNlciBwcm9maWxlIHdpdGggc3RhdHNcclxuICAgKiBSZWFkLW9ubHkgcXVlcnlcclxuICAgKi9cclxuICBhc3luYyBnZXRVc2VyUHJvZmlsZShhZGRyZXNzOiBzdHJpbmcpOiBQcm9taXNlPHtcclxuICAgIHJlcHV0YXRpb246IFJlcHV0YXRpb25TY29yZTtcclxuICAgIHN0YXRzOiB7XHJcbiAgICAgIHRvdGFsQm91bnRpZXNDcmVhdGVkOiBiaWdpbnQ7XHJcbiAgICAgIHRvdGFsQm91bnRpZXNDbGFpbWVkOiBiaWdpbnQ7XHJcbiAgICAgIHRvdGFsQm91bnRpZXNDb21wbGV0ZWQ6IGJpZ2ludDtcclxuICAgICAgdG90YWxFYXJuaW5nczogYmlnaW50O1xyXG4gICAgICB0b3RhbFNwZW50OiBiaWdpbnQ7XHJcbiAgICAgIGRpc3B1dGVzSW5pdGlhdGVkOiBiaWdpbnQ7XHJcbiAgICAgIGRpc3B1dGVzTG9zdDogYmlnaW50O1xyXG4gICAgICBsYXRlU3VibWlzc2lvbnM6IGJpZ2ludDtcclxuICAgIH07XHJcbiAgICByZWNlbnRBY3Rpdml0eTogQXJyYXk8e1xyXG4gICAgICB0eXBlOiBzdHJpbmc7XHJcbiAgICAgIHRpbWVzdGFtcDogYmlnaW50O1xyXG4gICAgICBkZXRhaWxzOiBhbnk7XHJcbiAgICB9PjtcclxuICB9PiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IGdxbGBcclxuICAgICAgcXVlcnkgR2V0VXNlclByb2ZpbGUoJGFkZHJlc3M6IElEISkge1xyXG4gICAgICAgIHVzZXIoaWQ6ICRhZGRyZXNzKSB7XHJcbiAgICAgICAgICBxdWFsaXR5U2NvcmVcclxuICAgICAgICAgIHJlbGlhYmlsaXR5U2NvcmVcclxuICAgICAgICAgIHByb2Zlc3Npb25hbGlzbVNjb3JlXHJcbiAgICAgICAgICBvdmVyYWxsU2NvcmVcclxuICAgICAgICAgIHRpZXJcclxuICAgICAgICAgIHRvdGFsQm91bnRpZXNDcmVhdGVkXHJcbiAgICAgICAgICB0b3RhbEJvdW50aWVzQ2xhaW1lZFxyXG4gICAgICAgICAgdG90YWxCb3VudGllc0NvbXBsZXRlZFxyXG4gICAgICAgICAgdG90YWxFYXJuaW5nc1xyXG4gICAgICAgICAgdG90YWxTcGVudFxyXG4gICAgICAgICAgZGlzcHV0ZXNJbml0aWF0ZWRcclxuICAgICAgICAgIGRpc3B1dGVzTG9zdFxyXG4gICAgICAgICAgbGF0ZVN1Ym1pc3Npb25zXHJcbiAgICAgICAgICBsYXN0UmVwdXRhdGlvblVwZGF0ZVxyXG4gICAgICAgICAgbGFzdEFjdGl2aXR5QXRcclxuICAgICAgICAgIHJlcHV0YXRpb25IaXN0b3J5KFxyXG4gICAgICAgICAgICBvcmRlckJ5OiB0aW1lc3RhbXBcclxuICAgICAgICAgICAgb3JkZXJEaXJlY3Rpb246IGRlc2NcclxuICAgICAgICAgICAgZmlyc3Q6IDEwXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgY2hhbmdlVHlwZVxyXG4gICAgICAgICAgICB0aW1lc3RhbXBcclxuICAgICAgICAgICAgcmVhc29uXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBgO1xyXG5cclxuICAgIGNvbnN0IGRhdGE6IGFueSA9IGF3YWl0IHJlcXVlc3QodGhpcy5zdWJncmFwaFVybCwgcXVlcnksIHsgYWRkcmVzczogYWRkcmVzcy50b0xvd2VyQ2FzZSgpIH0pO1xyXG4gICAgY29uc3QgdXNlciA9IGRhdGEudXNlcjtcclxuXHJcbiAgICBpZiAoIXVzZXIpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVc2VyIG5vdCBmb3VuZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlcHV0YXRpb246IHtcclxuICAgICAgICBxdWFsaXR5U2NvcmU6IHVzZXIucXVhbGl0eVNjb3JlLFxyXG4gICAgICAgIHJlbGlhYmlsaXR5U2NvcmU6IHVzZXIucmVsaWFiaWxpdHlTY29yZSxcclxuICAgICAgICBwcm9mZXNzaW9uYWxpc21TY29yZTogdXNlci5wcm9mZXNzaW9uYWxpc21TY29yZSxcclxuICAgICAgICBvdmVyYWxsU2NvcmU6IHVzZXIub3ZlcmFsbFNjb3JlLFxyXG4gICAgICAgIHRpZXI6IHRoaXMucGFyc2VUaWVyKHVzZXIudGllciksXHJcbiAgICAgICAgdG90YWxCb3VudGllc0NvbXBsZXRlZDogQmlnSW50KHVzZXIudG90YWxCb3VudGllc0NvbXBsZXRlZCksXHJcbiAgICAgICAgdG90YWxFYXJuaW5nczogQmlnSW50KHVzZXIudG90YWxFYXJuaW5ncyksXHJcbiAgICAgICAgZGlzcHV0ZXNMb3N0OiBCaWdJbnQodXNlci5kaXNwdXRlc0xvc3QpLFxyXG4gICAgICAgIGxhc3RVcGRhdGVkOiBCaWdJbnQodXNlci5sYXN0UmVwdXRhdGlvblVwZGF0ZSksXHJcbiAgICAgIH0sXHJcbiAgICAgIHN0YXRzOiB7XHJcbiAgICAgICAgdG90YWxCb3VudGllc0NyZWF0ZWQ6IEJpZ0ludCh1c2VyLnRvdGFsQm91bnRpZXNDcmVhdGVkKSxcclxuICAgICAgICB0b3RhbEJvdW50aWVzQ2xhaW1lZDogQmlnSW50KHVzZXIudG90YWxCb3VudGllc0NsYWltZWQpLFxyXG4gICAgICAgIHRvdGFsQm91bnRpZXNDb21wbGV0ZWQ6IEJpZ0ludCh1c2VyLnRvdGFsQm91bnRpZXNDb21wbGV0ZWQpLFxyXG4gICAgICAgIHRvdGFsRWFybmluZ3M6IEJpZ0ludCh1c2VyLnRvdGFsRWFybmluZ3MpLFxyXG4gICAgICAgIHRvdGFsU3BlbnQ6IEJpZ0ludCh1c2VyLnRvdGFsU3BlbnQpLFxyXG4gICAgICAgIGRpc3B1dGVzSW5pdGlhdGVkOiBCaWdJbnQodXNlci5kaXNwdXRlc0luaXRpYXRlZCksXHJcbiAgICAgICAgZGlzcHV0ZXNMb3N0OiBCaWdJbnQodXNlci5kaXNwdXRlc0xvc3QpLFxyXG4gICAgICAgIGxhdGVTdWJtaXNzaW9uczogQmlnSW50KHVzZXIubGF0ZVN1Ym1pc3Npb25zKSxcclxuICAgICAgfSxcclxuICAgICAgcmVjZW50QWN0aXZpdHk6IHVzZXIucmVwdXRhdGlvbkhpc3RvcnkubWFwKChoOiBhbnkpID0+ICh7XHJcbiAgICAgICAgdHlwZTogaC5jaGFuZ2VUeXBlLFxyXG4gICAgICAgIHRpbWVzdGFtcDogQmlnSW50KGgudGltZXN0YW1wKSxcclxuICAgICAgICBkZXRhaWxzOiB7IHJlYXNvbjogaC5yZWFzb24gfSxcclxuICAgICAgfSkpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBwbGF0Zm9ybSBzdGF0aXN0aWNzXHJcbiAgICogUmVhZC1vbmx5IHF1ZXJ5XHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0UGxhdGZvcm1TdGF0cygpOiBQcm9taXNlPHtcclxuICAgIHRvdGFsQm91bnRpZXNDcmVhdGVkOiBiaWdpbnQ7XHJcbiAgICB0b3RhbEJvdW50aWVzQ29tcGxldGVkOiBiaWdpbnQ7XHJcbiAgICB0b3RhbFZhbHVlTG9ja2VkOiBiaWdpbnQ7XHJcbiAgICB0b3RhbFZhbHVlUGFpZDogYmlnaW50O1xyXG4gICAgdG90YWxVc2VyczogYmlnaW50O1xyXG4gICAgdG90YWxEaXNwdXRlczogYmlnaW50O1xyXG4gIH0+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gZ3FsYFxyXG4gICAgICBxdWVyeSBHZXRQbGF0Zm9ybVN0YXRzIHtcclxuICAgICAgICBwbGF0Zm9ybVN0YXRzKGlkOiBcInBsYXRmb3JtLXN0YXRzXCIpIHtcclxuICAgICAgICAgIHRvdGFsQm91bnRpZXNDcmVhdGVkXHJcbiAgICAgICAgICB0b3RhbEJvdW50aWVzQ29tcGxldGVkXHJcbiAgICAgICAgICB0b3RhbFZhbHVlTG9ja2VkXHJcbiAgICAgICAgICB0b3RhbFZhbHVlUGFpZFxyXG4gICAgICAgICAgdG90YWxVc2Vyc1xyXG4gICAgICAgICAgdG90YWxEaXNwdXRlc1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgYDtcclxuXHJcbiAgICBjb25zdCBkYXRhOiBhbnkgPSBhd2FpdCByZXF1ZXN0KHRoaXMuc3ViZ3JhcGhVcmwsIHF1ZXJ5KTtcclxuICAgIGNvbnN0IHN0YXRzID0gZGF0YS5wbGF0Zm9ybVN0YXRzO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRvdGFsQm91bnRpZXNDcmVhdGVkOiBCaWdJbnQoc3RhdHMudG90YWxCb3VudGllc0NyZWF0ZWQpLFxyXG4gICAgICB0b3RhbEJvdW50aWVzQ29tcGxldGVkOiBCaWdJbnQoc3RhdHMudG90YWxCb3VudGllc0NvbXBsZXRlZCksXHJcbiAgICAgIHRvdGFsVmFsdWVMb2NrZWQ6IEJpZ0ludChzdGF0cy50b3RhbFZhbHVlTG9ja2VkKSxcclxuICAgICAgdG90YWxWYWx1ZVBhaWQ6IEJpZ0ludChzdGF0cy50b3RhbFZhbHVlUGFpZCksXHJcbiAgICAgIHRvdGFsVXNlcnM6IEJpZ0ludChzdGF0cy50b3RhbFVzZXJzKSxcclxuICAgICAgdG90YWxEaXNwdXRlczogQmlnSW50KHN0YXRzLnRvdGFsRGlzcHV0ZXMpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBib3VudHkgd2l0aCBmdWxsIGRldGFpbHNcclxuICAgKiBSZWFkLW9ubHkgcXVlcnlcclxuICAgKi9cclxuICBhc3luYyBnZXRCb3VudHlEZXRhaWxzKGJvdW50eUlkOiBzdHJpbmcpOiBQcm9taXNlPHtcclxuICAgIGJvdW50eTogQm91bnR5O1xyXG4gICAgc3VibWlzc2lvbj86IFN1Ym1pc3Npb247XHJcbiAgICBkaXNwdXRlPzogRGlzcHV0ZTtcclxuICAgIHN0YXR1c0hpc3Rvcnk6IEFycmF5PHtcclxuICAgICAgb2xkU3RhdHVzOiBCb3VudHlTdGF0dXM7XHJcbiAgICAgIG5ld1N0YXR1czogQm91bnR5U3RhdHVzO1xyXG4gICAgICB0aW1lc3RhbXA6IGJpZ2ludDtcclxuICAgIH0+O1xyXG4gIH0+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gZ3FsYFxyXG4gICAgICBxdWVyeSBHZXRCb3VudHlEZXRhaWxzKCRib3VudHlJZDogSUQhKSB7XHJcbiAgICAgICAgYm91bnR5KGlkOiAkYm91bnR5SWQpIHtcclxuICAgICAgICAgIGlkXHJcbiAgICAgICAgICBib3VudHlJZFxyXG4gICAgICAgICAgY2xpZW50IHsgaWQgfVxyXG4gICAgICAgICAgZXNjcm93QW1vdW50XHJcbiAgICAgICAgICBwbGF0Zm9ybUZlZVxyXG4gICAgICAgICAgZGVhZGxpbmVcclxuICAgICAgICAgIG1pblJlcFJlcXVpcmVkXHJcbiAgICAgICAgICByZXF1aXJlbWVudHNIYXNoXHJcbiAgICAgICAgICBzdGF0dXNcclxuICAgICAgICAgIG1heFJldmlzaW9uc1xyXG4gICAgICAgICAgcmV2aWV3UGVyaW9kXHJcbiAgICAgICAgICBjcmVhdGVkQXRcclxuICAgICAgICAgIGNsYWltZWRCeSB7IGlkIH1cclxuICAgICAgICAgIGNsYWltZWRBdFxyXG4gICAgICAgICAgc3VibWlzc2lvbiB7XHJcbiAgICAgICAgICAgIGlkXHJcbiAgICAgICAgICAgIHN1Ym1pc3Npb25JZFxyXG4gICAgICAgICAgICBmcmVlbGFuY2VyIHsgaWQgfVxyXG4gICAgICAgICAgICB3b3JrSGFzaFxyXG4gICAgICAgICAgICBzdWJtaXR0ZWRBdFxyXG4gICAgICAgICAgICBvblRpbWVcclxuICAgICAgICAgICAgc3RhdHVzXHJcbiAgICAgICAgICAgIHJldmlzaW9uQ291bnRcclxuICAgICAgICAgICAgcmV2aWV3U3RhcnRlZEF0XHJcbiAgICAgICAgICAgIHJldmlld0RlYWRsaW5lXHJcbiAgICAgICAgICAgIGFjY2VwdGVkQXRcclxuICAgICAgICAgICAgcmVqZWN0ZWRBdFxyXG4gICAgICAgICAgICBmZWVkYmFja0hhc2hcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGRpc3B1dGUge1xyXG4gICAgICAgICAgICBpZFxyXG4gICAgICAgICAgICBkaXNwdXRlSWRcclxuICAgICAgICAgICAgaW5pdGlhdG9yIHsgaWQgfVxyXG4gICAgICAgICAgICByZWFzb25cclxuICAgICAgICAgICAgc3RhdHVzXHJcbiAgICAgICAgICAgIG91dGNvbWVcclxuICAgICAgICAgICAgY3JlYXRlZEF0XHJcbiAgICAgICAgICAgIHJlc29sdmVkQXRcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHN0YXR1c0NoYW5nZXMob3JkZXJCeTogdGltZXN0YW1wKSB7XHJcbiAgICAgICAgICAgIG9sZFN0YXR1c1xyXG4gICAgICAgICAgICBuZXdTdGF0dXNcclxuICAgICAgICAgICAgdGltZXN0YW1wXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBgO1xyXG5cclxuICAgIGNvbnN0IGRhdGE6IGFueSA9IGF3YWl0IHJlcXVlc3QodGhpcy5zdWJncmFwaFVybCwgcXVlcnksIHsgYm91bnR5SWQgfSk7XHJcbiAgICBjb25zdCBib3VudHkgPSBkYXRhLmJvdW50eTtcclxuXHJcbiAgICBpZiAoIWJvdW50eSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JvdW50eSBub3QgZm91bmQnKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBib3VudHk6IHRoaXMudHJhbnNmb3JtQm91bnR5KGJvdW50eSksXHJcbiAgICAgIHN1Ym1pc3Npb246IGJvdW50eS5zdWJtaXNzaW9uID8gdGhpcy50cmFuc2Zvcm1TdWJtaXNzaW9uKGJvdW50eS5zdWJtaXNzaW9uKSA6IHVuZGVmaW5lZCxcclxuICAgICAgZGlzcHV0ZTogYm91bnR5LmRpc3B1dGUgPyB0aGlzLnRyYW5zZm9ybURpc3B1dGUoYm91bnR5LmRpc3B1dGUpIDogdW5kZWZpbmVkLFxyXG4gICAgICBzdGF0dXNIaXN0b3J5OiBib3VudHkuc3RhdHVzQ2hhbmdlcy5tYXAoKHNjOiBhbnkpID0+ICh7XHJcbiAgICAgICAgb2xkU3RhdHVzOiB0aGlzLnBhcnNlU3RhdHVzKHNjLm9sZFN0YXR1cyksXHJcbiAgICAgICAgbmV3U3RhdHVzOiB0aGlzLnBhcnNlU3RhdHVzKHNjLm5ld1N0YXR1cyksXHJcbiAgICAgICAgdGltZXN0YW1wOiBCaWdJbnQoc2MudGltZXN0YW1wKSxcclxuICAgICAgfSkpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlYXJjaCBib3VudGllcyBieSByZXF1aXJlbWVudHNcclxuICAgKiBSZWFkLW9ubHkgcXVlcnkgd2l0aCB0ZXh0IHNlYXJjaFxyXG4gICAqL1xyXG4gIGFzeW5jIHNlYXJjaEJvdW50aWVzKHBhcmFtczoge1xyXG4gICAgc2VhcmNoVGV4dD86IHN0cmluZztcclxuICAgIG1pbkVzY3Jvdz86IGJpZ2ludDtcclxuICAgIG1heE1pblJlcD86IG51bWJlcjtcclxuICAgIHN0YXR1cz86IEJvdW50eVN0YXR1cztcclxuICAgIGZpcnN0PzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPEJvdW50eVtdPiB7XHJcbiAgICAvLyBOb3RlOiBUaGUgR3JhcGggZG9lc24ndCBzdXBwb3J0IGZ1bGwtdGV4dCBzZWFyY2ggbmF0aXZlbHlcclxuICAgIC8vIFRoaXMgd291bGQgcmVxdWlyZSBhbiBleHRlcm5hbCBzZWFyY2ggc2VydmljZSAoQWxnb2xpYSwgRWxhc3RpY3NlYXJjaCwgZXRjLilcclxuICAgIC8vIEZvciBub3csIHdlIGZpbHRlciBieSBvdGhlciBwYXJhbWV0ZXJzXHJcbiAgICByZXR1cm4gdGhpcy5nZXRCb3VudGllcyh7XHJcbiAgICAgIHN0YXR1czogcGFyYW1zLnN0YXR1cyxcclxuICAgICAgbWluRXNjcm93OiBwYXJhbXMubWluRXNjcm93LFxyXG4gICAgICBtYXhNaW5SZXA6IHBhcmFtcy5tYXhNaW5SZXAsXHJcbiAgICAgIGZpcnN0OiBwYXJhbXMuZmlyc3QsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PSBUUkFOU0ZPUk1BVElPTiBIRUxQRVJTID09PT09PT09PT09PVxyXG5cclxuICBwcml2YXRlIHRyYW5zZm9ybUJvdW50aWVzKGJvdW50aWVzOiBhbnlbXSk6IEJvdW50eVtdIHtcclxuICAgIHJldHVybiBib3VudGllcy5tYXAoYiA9PiB0aGlzLnRyYW5zZm9ybUJvdW50eShiKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyYW5zZm9ybUJvdW50eShiOiBhbnkpOiBCb3VudHkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgYm91bnR5SWQ6IEJpZ0ludChiLmJvdW50eUlkKSxcclxuICAgICAgY2xpZW50OiBiLmNsaWVudC5pZCxcclxuICAgICAgbWluUmVwUmVxdWlyZWQ6IGIubWluUmVwUmVxdWlyZWQsXHJcbiAgICAgIHN0YXR1czogdGhpcy5wYXJzZVN0YXR1cyhiLnN0YXR1cyksXHJcbiAgICAgIG1heFJldmlzaW9uczogYi5tYXhSZXZpc2lvbnMsXHJcbiAgICAgIGVzY3Jvd0Ftb3VudDogQmlnSW50KGIuZXNjcm93QW1vdW50KSxcclxuICAgICAgcGxhdGZvcm1GZWU6IEJpZ0ludChiLnBsYXRmb3JtRmVlKSxcclxuICAgICAgZGVhZGxpbmU6IEJpZ0ludChiLmRlYWRsaW5lKSxcclxuICAgICAgY3JlYXRlZEF0OiBCaWdJbnQoYi5jcmVhdGVkQXQpLFxyXG4gICAgICByZXZpZXdQZXJpb2Q6IEJpZ0ludChiLnJldmlld1BlcmlvZCksXHJcbiAgICAgIHJlcXVpcmVtZW50c0hhc2g6IGIucmVxdWlyZW1lbnRzSGFzaCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyYW5zZm9ybVN1Ym1pc3Npb24oczogYW55KTogU3VibWlzc2lvbiB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdWJtaXNzaW9uSWQ6IEJpZ0ludChzLnN1Ym1pc3Npb25JZCksXHJcbiAgICAgIGJvdW50eUlkOiBCaWdJbnQocy5ib3VudHlJZCksXHJcbiAgICAgIGZyZWVsYW5jZXI6IHMuZnJlZWxhbmNlci5pZCxcclxuICAgICAgc3RhdHVzOiB0aGlzLnBhcnNlU3VibWlzc2lvblN0YXR1cyhzLnN0YXR1cyksXHJcbiAgICAgIHJldmlzaW9uQ291bnQ6IHMucmV2aXNpb25Db3VudCxcclxuICAgICAgc3VibWl0dGVkQXQ6IEJpZ0ludChzLnN1Ym1pdHRlZEF0KSxcclxuICAgICAgcmV2aWV3U3RhcnRlZEF0OiBCaWdJbnQocy5yZXZpZXdTdGFydGVkQXQgfHwgMCksXHJcbiAgICAgIHdvcmtIYXNoOiBzLndvcmtIYXNoLFxyXG4gICAgICBjbGllbnRGZWVkYmFja0hhc2g6IHMuZmVlZGJhY2tIYXNoIHx8ICcnLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJhbnNmb3JtRGlzcHV0ZShkOiBhbnkpOiBEaXNwdXRlIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGRpc3B1dGVJZDogQmlnSW50KGQuZGlzcHV0ZUlkKSxcclxuICAgICAgYm91bnR5SWQ6IEJpZ0ludChkLmJvdW50eUlkKSxcclxuICAgICAgc3VibWlzc2lvbklkOiBCaWdJbnQoZC5zdWJtaXNzaW9uSWQpLFxyXG4gICAgICBpbml0aWF0b3I6IGQuaW5pdGlhdG9yLmlkLFxyXG4gICAgICByZWFzb246IHBhcnNlSW50KGQucmVhc29uKSxcclxuICAgICAgc3RhdHVzOiBwYXJzZUludChkLnN0YXR1cyksXHJcbiAgICAgIG91dGNvbWU6IHBhcnNlSW50KGQub3V0Y29tZSksXHJcbiAgICAgIGFpQ29uZmlkZW5jZVNjb3JlOiAwLFxyXG4gICAgICBhc3NpZ25lZEFyYml0cmF0b3I6ICcnLFxyXG4gICAgICBjcmVhdGVkQXQ6IEJpZ0ludChkLmNyZWF0ZWRBdCksXHJcbiAgICAgIHJlc29sdmVkQXQ6IEJpZ0ludChkLnJlc29sdmVkQXQgfHwgMCksXHJcbiAgICAgIGV2aWRlbmNlSGFzaDogJycsXHJcbiAgICAgIGFpUmVjb21tZW5kYXRpb25IYXNoOiAnJyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBhcnNlU3RhdHVzKHN0YXR1czogc3RyaW5nKTogQm91bnR5U3RhdHVzIHtcclxuICAgIGNvbnN0IHN0YXR1c01hcDogUmVjb3JkPHN0cmluZywgQm91bnR5U3RhdHVzPiA9IHtcclxuICAgICAgJ09wZW4nOiBCb3VudHlTdGF0dXMuT3BlbixcclxuICAgICAgJ0luUHJvZ3Jlc3MnOiBCb3VudHlTdGF0dXMuSW5Qcm9ncmVzcyxcclxuICAgICAgJ1VuZGVyUmV2aWV3JzogQm91bnR5U3RhdHVzLlVuZGVyUmV2aWV3LFxyXG4gICAgICAnQ29tcGxldGVkJzogQm91bnR5U3RhdHVzLkNvbXBsZXRlZCxcclxuICAgICAgJ0Rpc3B1dGVkJzogQm91bnR5U3RhdHVzLkRpc3B1dGVkLFxyXG4gICAgICAnQ2FuY2VsbGVkJzogQm91bnR5U3RhdHVzLkNhbmNlbGxlZCxcclxuICAgICAgJ0V4cGlyZWQnOiBCb3VudHlTdGF0dXMuRXhwaXJlZCxcclxuICAgIH07XHJcbiAgICByZXR1cm4gc3RhdHVzTWFwW3N0YXR1c10gfHwgQm91bnR5U3RhdHVzLk9wZW47XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBhcnNlU3VibWlzc2lvblN0YXR1cyhzdGF0dXM6IHN0cmluZyk6IFN1Ym1pc3Npb25TdGF0dXMge1xyXG4gICAgY29uc3Qgc3RhdHVzTWFwOiBSZWNvcmQ8c3RyaW5nLCBTdWJtaXNzaW9uU3RhdHVzPiA9IHtcclxuICAgICAgJ1BlbmRpbmcnOiBTdWJtaXNzaW9uU3RhdHVzLlBlbmRpbmcsXHJcbiAgICAgICdVbmRlclJldmlldyc6IFN1Ym1pc3Npb25TdGF0dXMuVW5kZXJSZXZpZXcsXHJcbiAgICAgICdSZXZpc2lvblJlcXVlc3RlZCc6IFN1Ym1pc3Npb25TdGF0dXMuUmV2aXNpb25SZXF1ZXN0ZWQsXHJcbiAgICAgICdBY2NlcHRlZCc6IFN1Ym1pc3Npb25TdGF0dXMuQWNjZXB0ZWQsXHJcbiAgICAgICdSZWplY3RlZCc6IFN1Ym1pc3Npb25TdGF0dXMuUmVqZWN0ZWQsXHJcbiAgICAgICdEaXNwdXRlZCc6IFN1Ym1pc3Npb25TdGF0dXMuRGlzcHV0ZWQsXHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIHN0YXR1c01hcFtzdGF0dXNdIHx8IFN1Ym1pc3Npb25TdGF0dXMuUGVuZGluZztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFyc2VUaWVyKHRpZXI6IHN0cmluZyk6IFJlcHV0YXRpb25UaWVyIHtcclxuICAgIGNvbnN0IHRpZXJNYXA6IFJlY29yZDxzdHJpbmcsIFJlcHV0YXRpb25UaWVyPiA9IHtcclxuICAgICAgJ0Jyb256ZSc6IFJlcHV0YXRpb25UaWVyLkJyb256ZSxcclxuICAgICAgJ1NpbHZlcic6IFJlcHV0YXRpb25UaWVyLlNpbHZlcixcclxuICAgICAgJ0dvbGQnOiBSZXB1dGF0aW9uVGllci5Hb2xkLFxyXG4gICAgICAnUGxhdGludW0nOiBSZXB1dGF0aW9uVGllci5QbGF0aW51bSxcclxuICAgIH07XHJcbiAgICByZXR1cm4gdGllck1hcFt0aWVyXSB8fCBSZXB1dGF0aW9uVGllci5Ccm9uemU7XHJcbiAgfVxyXG59XHJcbiJdfQ==