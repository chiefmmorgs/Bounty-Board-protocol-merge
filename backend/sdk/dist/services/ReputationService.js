"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReputationService = void 0;
const ethers_1 = require("ethers");
const types_1 = require("../types");
/**
 * ReputationService - Business logic for reputation operations
 * No UI logic, only contract interactions and calculations
 */
class ReputationService {
    constructor(config, signer, contractABI) {
        this.config = config;
        this.signer = signer;
        this.contract = new ethers_1.Contract(config.contracts.reputationOracle, contractABI, signer);
    }
    /**
     * Get reputation score for user
     * Read-only operation
     */
    async getReputation(address) {
        try {
            const rep = await this.contract.getReputation(address);
            return {
                qualityScore: rep.qualityScore,
                reliabilityScore: rep.reliabilityScore,
                professionalismScore: rep.professionalismScore,
                overallScore: rep.overallScore,
                tier: rep.tier,
                totalBountiesCompleted: rep.totalBountiesCompleted,
                totalEarnings: rep.totalEarnings,
                disputesLost: rep.disputesLost,
                lastUpdated: rep.lastUpdated,
            };
        }
        catch (error) {
            throw this.handleContractError(error);
        }
    }
    /**
     * Get reputation tier for user
     * Read-only operation
     */
    async getTier(address) {
        try {
            const tier = await this.contract.getTier(address);
            return tier;
        }
        catch (error) {
            throw this.handleContractError(error);
        }
    }
    /**
     * Check if user meets reputation requirement
     * Read-only operation
     */
    async meetsRepRequirement(address, minRep) {
        try {
            return await this.contract.meetsRepRequirement(address, minRep);
        }
        catch (error) {
            throw this.handleContractError(error);
        }
    }
    /**
     * Get dispute statistics for user
     * Read-only operation
     */
    async getDisputeStats(address) {
        try {
            const stats = await this.contract.getDisputeStats(address);
            return {
                initiated: stats.initiated,
                lost: stats.lost,
                winRate: stats.winRate,
            };
        }
        catch (error) {
            throw this.handleContractError(error);
        }
    }
    /**
     * Calculate tier from overall score
     * Pure business logic (client-side calculation)
     */
    calculateTier(overallScore) {
        if (overallScore >= 90)
            return types_1.ReputationTier.Platinum;
        if (overallScore >= 70)
            return types_1.ReputationTier.Gold;
        if (overallScore >= 40)
            return types_1.ReputationTier.Silver;
        return types_1.ReputationTier.Bronze;
    }
    /**
     * Calculate overall score from component scores
     * Pure business logic (matches contract calculation)
     */
    calculateOverallScore(quality, reliability, professionalism) {
        // Quality: 40%, Reliability: 35%, Professionalism: 25%
        return Math.floor((quality * 40 + reliability * 35 + professionalism * 25) / 100);
    }
    /**
     * Get tier benefits
     * Pure business logic (informational)
     */
    getTierBenefits(tier) {
        switch (tier) {
            case types_1.ReputationTier.Bronze:
                return {
                    maxConcurrent: 2,
                    maxBountyValue: '500 ETH',
                    withdrawalInterval: '7 days',
                    tierName: 'Bronze',
                };
            case types_1.ReputationTier.Silver:
                return {
                    maxConcurrent: 5,
                    maxBountyValue: '2,500 ETH',
                    withdrawalInterval: '3 days',
                    tierName: 'Silver',
                };
            case types_1.ReputationTier.Gold:
                return {
                    maxConcurrent: 10,
                    maxBountyValue: '10,000 ETH',
                    withdrawalInterval: '1 day',
                    tierName: 'Gold',
                };
            case types_1.ReputationTier.Platinum:
                return {
                    maxConcurrent: 20,
                    maxBountyValue: 'Unlimited',
                    withdrawalInterval: 'Instant',
                    tierName: 'Platinum',
                };
        }
    }
    /**
     * Check if user can initiate dispute
     * Business logic validation
     */
    async canInitiateDispute(address) {
        try {
            const stats = await this.getDisputeStats(address);
            const rep = await this.getReputation(address);
            // Check dispute abuse prevention
            if (stats.initiated >= 3n && stats.winRate < 30n) {
                return {
                    canInitiate: false,
                    reason: `Low dispute win rate: ${stats.winRate}%`,
                };
            }
            // Check professionalism score for frequent disputers
            if (stats.initiated > 5n && rep.professionalismScore < 50) {
                return {
                    canInitiate: false,
                    reason: `Professionalism score too low: ${rep.professionalismScore}`,
                };
            }
            return { canInitiate: true };
        }
        catch (error) {
            throw this.handleContractError(error);
        }
    }
    /**
     * Estimate reputation decay
     * Pure business logic (client-side calculation)
     */
    estimateDecay(currentScore, lastActivityTimestamp) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const inactiveDays = Number((now - lastActivityTimestamp) / 86400n);
        if (inactiveDays <= 90) {
            return { decayedScore: currentScore, decayAmount: 0 };
        }
        // -1 point per 30 days beyond 90 days
        const decayAmount = Math.floor((inactiveDays - 90) / 30);
        const decayedScore = Math.max(0, currentScore - decayAmount);
        return { decayedScore, decayAmount };
    }
    /**
     * Get next tier requirements
     * Pure business logic (informational)
     */
    getNextTierRequirements(currentTier) {
        switch (currentTier) {
            case types_1.ReputationTier.Bronze:
                return {
                    nextTier: types_1.ReputationTier.Silver,
                    requiredScore: 40,
                    pointsNeeded: 40,
                };
            case types_1.ReputationTier.Silver:
                return {
                    nextTier: types_1.ReputationTier.Gold,
                    requiredScore: 70,
                    pointsNeeded: 30,
                };
            case types_1.ReputationTier.Gold:
                return {
                    nextTier: types_1.ReputationTier.Platinum,
                    requiredScore: 90,
                    pointsNeeded: 20,
                };
            case types_1.ReputationTier.Platinum:
                return null; // Already at max tier
        }
    }
    // ============ ERROR HANDLING ============
    handleContractError(error) {
        if (error.code === 'CALL_EXCEPTION') {
            const errorName = error.errorName || 'Unknown';
            return new types_1.ContractError(`Contract error: ${errorName}`, error);
        }
        return error instanceof Error ? error : new types_1.ContractError('Unknown error', error);
    }
}
exports.ReputationService = ReputationService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVwdXRhdGlvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2VydmljZXMvUmVwdXRhdGlvblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQWtEO0FBQ2xELG9DQUtrQjtBQUVsQjs7O0dBR0c7QUFDSCxNQUFhLGlCQUFpQjtJQUkxQixZQUNZLE1BQWMsRUFDdEIsTUFBYyxFQUNkLFdBQWtCO1FBRlYsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUl0QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksaUJBQVEsQ0FDeEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFDakMsV0FBVyxFQUNYLE1BQU0sQ0FDVCxDQUFDO0lBQ04sQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZTtRQUMvQixJQUFJLENBQUM7WUFDRCxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRXZELE9BQU87Z0JBQ0gsWUFBWSxFQUFFLEdBQUcsQ0FBQyxZQUFZO2dCQUM5QixnQkFBZ0IsRUFBRSxHQUFHLENBQUMsZ0JBQWdCO2dCQUN0QyxvQkFBb0IsRUFBRSxHQUFHLENBQUMsb0JBQW9CO2dCQUM5QyxZQUFZLEVBQUUsR0FBRyxDQUFDLFlBQVk7Z0JBQzlCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBc0I7Z0JBQ2hDLHNCQUFzQixFQUFFLEdBQUcsQ0FBQyxzQkFBc0I7Z0JBQ2xELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYTtnQkFDaEMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxZQUFZO2dCQUM5QixXQUFXLEVBQUUsR0FBRyxDQUFDLFdBQVc7YUFDL0IsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsTUFBTSxJ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LFFBQVEsRUFBRSxzQkFBYyxDQUFDLFFBQVE7b0JBQ2pDLGFBQWEsRUFBRSxFQUFFO29CQUNqQixZQUFZLEVBQUUsRUFBRTtpQkFDbkIsQ0FBQztZQUNOLEtBQUssc0JBQWMsQ0FBQyxRQUFRO2dCQUN4QixPQUFPLElBQUksQ0FBQyxDQUFDLHNCQUFzQjtRQUMzQyxDQUFDO0lBQ0wsQ0FBQztJQUVELDJDQUEyQztJQUVuQyxtQkFBbUIsQ0FBQyxLQUFVO1FBQ2xDLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDO1lBQy9DLE9BQU8sSUFBSSxxQkFBYSxDQUFDLG1CQUFtQixTQUFTLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBRUQsT0FBTyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUkscUJBQWEsQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDdEYsQ0FBQztDQUNKO0FBL1BELDhDQStQQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV0aGVycywgQ29udHJhY3QsIFNpZ25lciB9IGZyb20gJ2V0aGVycyc7XHJcbmltcG9ydCB7XHJcbiAgICBDb25maWcsXHJcbiAgICBSZXB1dGF0aW9uU2NvcmUsXHJcbiAgICBSZXB1dGF0aW9uVGllcixcclxuICAgIENvbnRyYWN0RXJyb3IsXHJcbn0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuLyoqXHJcbiAqIFJlcHV0YXRpb25TZXJ2aWNlIC0gQnVzaW5lc3MgbG9naWMgZm9yIHJlcHV0YXRpb24gb3BlcmF0aW9uc1xyXG4gKiBObyBVSSBsb2dpYywgb25seSBjb250cmFjdCBpbnRlcmFjdGlvbnMgYW5kIGNhbGN1bGF0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFJlcHV0YXRpb25TZXJ2aWNlIHtcclxuICAgIHByaXZhdGUgY29udHJhY3Q6IENvbnRyYWN0O1xyXG4gICAgcHJpdmF0ZSBzaWduZXI6IFNpZ25lcjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihcclxuICAgICAgICBwcml2YXRlIGNvbmZpZzogQ29uZmlnLFxyXG4gICAgICAgIHNpZ25lcjogU2lnbmVyLFxyXG4gICAgICAgIGNvbnRyYWN0QUJJOiBhbnlbXVxyXG4gICAgKSB7XHJcbiAgICAgICAgdGhpcy5zaWduZXIgPSBzaWduZXI7XHJcbiAgICAgICAgdGhpcy5jb250cmFjdCA9IG5ldyBDb250cmFjdChcclxuICAgICAgICAgICAgY29uZmlnLmNvbnRyYWN0cy5yZXB1dGF0aW9uT3JhY2xlLFxyXG4gICAgICAgICAgICBjb250cmFjdEFCSSxcclxuICAgICAgICAgICAgc2lnbmVyXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCByZXB1dGF0aW9uIHNjb3JlIGZvciB1c2VyXHJcbiAgICAgKiBSZWFkLW9ubHkgb3BlcmF0aW9uXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldFJlcHV0YXRpb24oYWRkcmVzczogc3RyaW5nKTogUHJvbWlzZTxSZXB1dGF0aW9uU2NvcmU+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXAgPSBhd2FpdCB0aGlzLmNvbnRyYWN0LmdldFJlcHV0YXRpb24oYWRkcmVzcyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgcXVhbGl0eVNjb3JlOiByZXAucXVhbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgcmVsaWFiaWxpdHlTY29yZTogcmVwLnJlbGlhYmlsaXR5U2NvcmUsXHJcbiAgICAgICAgICAgICAgICBwcm9mZXNzaW9uYWxpc21TY29yZTogcmVwLnByb2Zlc3Npb25hbGlzbVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgb3ZlcmFsbFNjb3JlOiByZXAub3ZlcmFsbFNjb3JlLFxyXG4gICAgICAgICAgICAgICAgdGllcjogcmVwLnRpZXIgYXMgUmVwdXRhdGlvblRpZXIsXHJcbiAgICAgICAgICAgICAgICB0b3RhbEJvdW50aWVzQ29tcGxldGVkOiByZXAudG90YWxCb3VudGllc0NvbXBsZXRlZCxcclxuICAgICAgICAgICAgICAgIHRvdGFsRWFybmluZ3M6IHJlcC50b3RhbEVhcm5pbmdzLFxyXG4gICAgICAgICAgICAgICAgZGlzcHV0ZXNMb3N0OiByZXAuZGlzcHV0ZXNMb3N0LFxyXG4gICAgICAgICAgICAgICAgbGFzdFVwZGF0ZWQ6IHJlcC5sYXN0VXBkYXRlZCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLmhhbmRsZUNvbnRyYWN0RXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCByZXB1dGF0aW9uIHRpZXIgZm9yIHVzZXJcclxuICAgICAqIFJlYWQtb25seSBvcGVyYXRpb25cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0VGllcihhZGRyZXNzOiBzdHJpbmcpOiBQcm9taXNlPFJlcHV0YXRpb25UaWVyPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdGllciA9IGF3YWl0IHRoaXMuY29udHJhY3QuZ2V0VGllcihhZGRyZXNzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRpZXIgYXMgUmVwdXRhdGlvblRpZXI7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgdGhyb3cgdGhpcy5oYW5kbGVDb250cmFjdEVycm9yKGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVjayBpZiB1c2VyIG1lZXRzIHJlcHV0YXRpb24gcmVxdWlyZW1lbnRcclxuICAgICAqIFJlYWQtb25seSBvcGVyYXRpb25cclxuICAgICAqL1xyXG4gICAgYXN5bmMgbWVldHNSZXBSZXF1aXJlbWVudChcclxuICAgICAgICBhZGRyZXNzOiBzdHJpbmcsXHJcbiAgICAgICAgbWluUmVwOiBudW1iZXJcclxuICAgICk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbnRyYWN0Lm1lZXRzUmVwUmVxdWlyZW1lbnQoYWRkcmVzcywgbWluUmVwKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLmhhbmRsZUNvbnRyYWN0RXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBkaXNwdXRlIHN0YXRpc3RpY3MgZm9yIHVzZXJcclxuICAgICAqIFJlYWQtb25seSBvcGVyYXRpb25cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0RGlzcHV0ZVN0YXRzKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8e1xyXG4gICAgICAgIGluaXRpYXRlZDogYmlnaW50O1xyXG4gICAgICAgIGxvc3Q6IGJpZ2ludDtcclxuICAgICAgICB3aW5SYXRlOiBiaWdpbnQ7XHJcbiAgICB9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmNvbnRyYWN0LmdldERpc3B1dGVTdGF0cyhhZGRyZXNzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGluaXRpYXRlZDogc3RhdHMuaW5pdGlhdGVkLFxyXG4gICAgICAgICAgICAgICAgbG9zdDogc3RhdHMubG9zdCxcclxuICAgICAgICAgICAgICAgIHdpblJhdGU6IHN0YXRzLndpblJhdGUsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgdGhyb3cgdGhpcy5oYW5kbGVDb250cmFjdEVycm9yKGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGllciBmcm9tIG92ZXJhbGwgc2NvcmVcclxuICAgICAqIFB1cmUgYnVzaW5lc3MgbG9naWMgKGNsaWVudC1zaWRlIGNhbGN1bGF0aW9uKVxyXG4gICAgICovXHJcbiAgICBjYWxjdWxhdGVUaWVyKG92ZXJhbGxTY29yZTogbnVtYmVyKTogUmVwdXRhdGlvblRpZXIge1xyXG4gICAgICAgIGlmIChvdmVyYWxsU2NvcmUgPj0gOTApIHJldHVybiBSZXB1dGF0aW9uVGllci5QbGF0aW51bTtcclxuICAgICAgICBpZiAob3ZlcmFsbFNjb3JlID49IDcwKSByZXR1cm4gUmVwdXRhdGlvblRpZXIuR29sZDtcclxuICAgICAgICBpZiAob3ZlcmFsbFNjb3JlID49IDQwKSByZXR1cm4gUmVwdXRhdGlvblRpZXIuU2lsdmVyO1xyXG4gICAgICAgIHJldHVybiBSZXB1dGF0aW9uVGllci5Ccm9uemU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgb3ZlcmFsbCBzY29yZSBmcm9tIGNvbXBvbmVudCBzY29yZXNcclxuICAgICAqIFB1cmUgYnVzaW5lc3MgbG9naWMgKG1hdGNoZXMgY29udHJhY3QgY2FsY3VsYXRpb24pXHJcbiAgICAgKi9cclxuICAgIGNhbGN1bGF0ZU92ZXJhbGxTY29yZShcclxuICAgICAgICBxdWFsaXR5OiBudW1iZXIsXHJcbiAgICAgICAgcmVsaWFiaWxpdHk6IG51bWJlcixcclxuICAgICAgICBwcm9mZXNzaW9uYWxpc206IG51bWJlclxyXG4gICAgKTogbnVtYmVyIHtcclxuICAgICAgICAvLyBRdWFsaXR5OiA0MCUsIFJlbGlhYmlsaXR5OiAzNSUsIFByb2Zlc3Npb25hbGlzbTogMjUlXHJcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKHF1YWxpdHkgKiA0MCArIHJlbGlhYmlsaXR5ICogMzUgKyBwcm9mZXNzaW9uYWxpc20gKiAyNSkgLyAxMDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHRpZXIgYmVuZWZpdHNcclxuICAgICAqIFB1cmUgYnVzaW5lc3MgbG9naWMgKGluZm9ybWF0aW9uYWwpXHJcbiAgICAgKi9cclxuICAgIGdldFRpZXJCZW5lZml0cyh0aWVyOiBSZXB1dGF0aW9uVGllcik6IHtcclxuICAgICAgICBtYXhDb25jdXJyZW50OiBudW1iZXI7XHJcbiAgICAgICAgbWF4Qm91bnR5VmFsdWU6IHN0cmluZztcclxuICAgICAgICB3aXRoZHJhd2FsSW50ZXJ2YWw6IHN0cmluZztcclxuICAgICAgICB0aWVyTmFtZTogc3RyaW5nO1xyXG4gICAgfSB7XHJcbiAgICAgICAgc3dpdGNoICh0aWVyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgUmVwdXRhdGlvblRpZXIuQnJvbnplOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXhDb25jdXJyZW50OiAyLFxyXG4gICAgICAgICAgICAgICAgICAgIG1heEJvdW50eVZhbHVlOiAnNTAwIEVUSCcsXHJcbiAgICAgICAgICAgICAgICAgICAgd2l0aGRyYXdhbEludGVydmFsOiAnNyBkYXlzJyxcclxuICAgICAgICAgICAgICAgICAgICB0aWVyTmFtZTogJ0Jyb256ZScsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFJlcHV0YXRpb25UaWVyLlNpbHZlcjpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWF4Q29uY3VycmVudDogNSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhCb3VudHlWYWx1ZTogJzIsNTAwIEVUSCcsXHJcbiAgICAgICAgICAgICAgICAgICAgd2l0aGRyYXdhbEludGVydmFsOiAnMyBkYXlzJyxcclxuICAgICAgICAgICAgICAgICAgICB0aWVyTmFtZTogJ1NpbHZlcicsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFJlcHV0YXRpb25UaWVyLkdvbGQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG1heENvbmN1cnJlbnQ6IDEwLFxyXG4gICAgICAgICAgICAgICAgICAgIG1heEJvdW50eVZhbHVlOiAnMTAsMDAwIEVUSCcsXHJcbiAgICAgICAgICAgICAgICAgICAgd2l0aGRyYXdhbEludGVydmFsOiAnMSBkYXknLFxyXG4gICAgICAgICAgICAgICAgICAgIHRpZXJOYW1lOiAnR29sZCcsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFJlcHV0YXRpb25UaWVyLlBsYXRpbnVtOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXhDb25jdXJyZW50OiAyMCxcclxuICAgICAgICAgICAgICAgICAgICBtYXhCb3VudHlWYWx1ZTogJ1VubGltaXRlZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgd2l0aGRyYXdhbEludGVydmFsOiAnSW5zdGFudCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdGllck5hbWU6ICdQbGF0aW51bScsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrIGlmIHVzZXIgY2FuIGluaXRpYXRlIGRpc3B1dGVcclxuICAgICAqIEJ1c2luZXNzIGxvZ2ljIHZhbGlkYXRpb25cclxuICAgICAqL1xyXG4gICAgYXN5bmMgY2FuSW5pdGlhdGVEaXNwdXRlKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8e1xyXG4gICAgICAgIGNhbkluaXRpYXRlOiBib29sZWFuO1xyXG4gICAgICAgIHJlYXNvbj86IHN0cmluZztcclxuICAgIH0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IHRoaXMuZ2V0RGlzcHV0ZVN0YXRzKGFkZHJlc3MpO1xyXG4gICAgICAgICAgICBjb25zdCByZXAgPSBhd2FpdCB0aGlzLmdldFJlcHV0YXRpb24oYWRkcmVzcyk7XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVjayBkaXNwdXRlIGFidXNlIHByZXZlbnRpb25cclxuICAgICAgICAgICAgaWYgKHN0YXRzLmluaXRpYXRlZCA+PSAzbiAmJiBzdGF0cy53aW5SYXRlIDwgMzBuKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbkluaXRpYXRlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICByZWFzb246IGBMb3cgZGlzcHV0ZSB3aW4gcmF0ZTogJHtzdGF0cy53aW5SYXRlfSVgLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgcHJvZmVzc2lvbmFsaXNtIHNjb3JlIGZvciBmcmVxdWVudCBkaXNwdXRlcnNcclxuICAgICAgICAgICAgaWYgKHN0YXRzLmluaXRpYXRlZCA+IDVuICYmIHJlcC5wcm9mZXNzaW9uYWxpc21TY29yZSA8IDUwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbkluaXRpYXRlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICByZWFzb246IGBQcm9mZXNzaW9uYWxpc20gc2NvcmUgdG9vIGxvdzogJHtyZXAucHJvZmVzc2lvbmFsaXNtU2NvcmV9YCxcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7IGNhbkluaXRpYXRlOiB0cnVlIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgdGhyb3cgdGhpcy5oYW5kbGVDb250cmFjdEVycm9yKGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFc3RpbWF0ZSByZXB1dGF0aW9uIGRlY2F5XHJcbiAgICAgKiBQdXJlIGJ1c2luZXNzIGxvZ2ljIChjbGllbnQtc2lkZSBjYWxjdWxhdGlvbilcclxuICAgICAqL1xyXG4gICAgZXN0aW1hdGVEZWNheShcclxuICAgICAgICBjdXJyZW50U2NvcmU6IG51bWJlcixcclxuICAgICAgICBsYXN0QWN0aXZpdHlUaW1lc3RhbXA6IGJpZ2ludFxyXG4gICAgKTogeyBkZWNheWVkU2NvcmU6IG51bWJlcjsgZGVjYXlBbW91bnQ6IG51bWJlciB9IHtcclxuICAgICAgICBjb25zdCBub3cgPSBCaWdJbnQoTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkpO1xyXG4gICAgICAgIGNvbnN0IGluYWN0aXZlRGF5cyA9IE51bWJlcigobm93IC0gbGFzdEFjdGl2aXR5VGltZXN0YW1wKSAvIDg2NDAwbik7XHJcblxyXG4gICAgICAgIGlmIChpbmFjdGl2ZURheXMgPD0gOTApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgZGVjYXllZFNjb3JlOiBjdXJyZW50U2NvcmUsIGRlY2F5QW1vdW50OiAwIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyAtMSBwb2ludCBwZXIgMzAgZGF5cyBiZXlvbmQgOTAgZGF5c1xyXG4gICAgICAgIGNvbnN0IGRlY2F5QW1vdW50ID0gTWF0aC5mbG9vcigoaW5hY3RpdmVEYXlzIC0gOTApIC8gMzApO1xyXG4gICAgICAgIGNvbnN0IGRlY2F5ZWRTY29yZSA9IE1hdGgubWF4KDAsIGN1cnJlbnRTY29yZSAtIGRlY2F5QW1vdW50KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHsgZGVjYXllZFNjb3JlLCBkZWNheUFtb3VudCB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IG5leHQgdGllciByZXF1aXJlbWVudHNcclxuICAgICAqIFB1cmUgYnVzaW5lc3MgbG9naWMgKGluZm9ybWF0aW9uYWwpXHJcbiAgICAgKi9cclxuICAgIGdldE5leHRUaWVyUmVxdWlyZW1lbnRzKGN1cnJlbnRUaWVyOiBSZXB1dGF0aW9uVGllcik6IHtcclxuICAgICAgICBuZXh0VGllcjogUmVwdXRhdGlvblRpZXIgfCBudWxsO1xyXG4gICAgICAgIHJlcXVpcmVkU2NvcmU6IG51bWJlcjtcclxuICAgICAgICBwb2ludHNOZWVkZWQ6IG51bWJlcjtcclxuICAgIH0gfCBudWxsIHtcclxuICAgICAgICBzd2l0Y2ggKGN1cnJlbnRUaWVyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgUmVwdXRhdGlvblRpZXIuQnJvbnplOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXh0VGllcjogUmVwdXRhdGlvblRpZXIuU2lsdmVyLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkU2NvcmU6IDQwLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50c05lZWRlZDogNDAsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFJlcHV0YXRpb25UaWVyLlNpbHZlcjpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dFRpZXI6IFJlcHV0YXRpb25UaWVyLkdvbGQsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRTY29yZTogNzAsXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzTmVlZGVkOiAzMCxcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNhc2UgUmVwdXRhdGlvblRpZXIuR29sZDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dFRpZXI6IFJlcHV0YXRpb25UaWVyLlBsYXRpbnVtLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkU2NvcmU6IDkwLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50c05lZWRlZDogMjAsXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFJlcHV0YXRpb25UaWVyLlBsYXRpbnVtOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7IC8vIEFscmVhZHkgYXQgbWF4IHRpZXJcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09IEVSUk9SIEhBTkRMSU5HID09PT09PT09PT09PVxyXG5cclxuICAgIHByaXZhdGUgaGFuZGxlQ29udHJhY3RFcnJvcihlcnJvcjogYW55KTogRXJyb3Ige1xyXG4gICAgICAgIGlmIChlcnJvci5jb2RlID09PSAnQ0FMTF9FWENFUFRJT04nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVycm9yTmFtZSA9IGVycm9yLmVycm9yTmFtZSB8fCAnVW5rbm93bic7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgQ29udHJhY3RFcnJvcihgQ29udHJhY3QgZXJyb3I6ICR7ZXJyb3JOYW1lfWAsIGVycm9yKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgQ29udHJhY3RFcnJvcignVW5rbm93biBlcnJvcicsIGVycm9yKTtcclxuICAgIH1cclxufVxyXG4iXX0=