"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthosWebhookHandler = exports.EthosService = void 0;
const axios_1 = __importDefault(require("axios"));
const ethers_1 = require("ethers");
/**
 * EthosService - Required integration with Ethos Network API v2
 * This is NOT optional - reputation system depends on Ethos
 */
class EthosService {
    constructor(config) {
        if (!config.apiKey) {
            throw new Error('Ethos API key is required - reputation system cannot function without it');
        }
        this.apiKey = config.apiKey;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl || 'https://api.ethos.network/api/v2',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }
    /**
     * Get Ethos user by address (API v2)
     * Returns full user data including score
     */
    async getUserByAddress(address) {
        try {
            const response = await this.client.get(`/user/by/address/${address}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null; // User not found on Ethos
            }
            throw error;
        }
    }
    /**
     * Get Ethos score for an address
     * REQUIRED for reputation calculation
     */
    async getScore(address) {
        try {
            const user = await this.getUserByAddress(address);
            if (!user) {
                // Return default scores for users not on Ethos
                return {
                    score: 0,
                    credibilityScore: 0,
                    positiveReviewCount: 0,
                    negativeReviewCount: 0,
                    neutralReviewCount: 0,
                    lastUpdated: new Date(),
                };
            }
            return {
                score: user.score,
                credibilityScore: Math.floor(user.score * 0.5), // Derive from main score
                positiveReviewCount: user.stats.review.received.positive,
                negativeReviewCount: user.stats.review.received.negative,
                neutralReviewCount: user.stats.review.received.neutral,
                lastUpdated: new Date(),
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Ethos API error: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Get detailed profile from Ethos (API v2)
     * REQUIRED for comprehensive reputation assessment
     */
    async getProfile(address) {
        try {
            const user = await this.getUserByAddress(address);
            if (!user) {
                return {
                    address,
                    score: 0,
                    user: null,
                    reviews: [],
                    vouches: [],
                    attestations: [],
                };
            }
            return {
                address,
                score: user.score,
                user,
                // Note: v2 API doesn't return individual reviews/vouches in user endpoint
                // Would need additional endpoints to fetch these
                reviews: [],
                vouches: [],
                attestations: [],
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Ethos API error: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Calculate platform reputation from Ethos score
     * REQUIRED mapping from Ethos (0-2000) to platform scores (0-100)
     */
    calculatePlatformReputation(ethosData) {
        // Map Ethos score (0-2000) to quality score (0-100)
        const qualityScore = Math.min(100, Math.floor((ethosData.score / 2000) * 100));
        // Calculate reliability from review ratio
        const totalReviews = ethosData.positiveReviewCount +
            ethosData.negativeReviewCount +
            ethosData.neutralReviewCount;
        let reliabilityScore = 50; // Default
        if (totalReviews > 0) {
            const positiveRatio = ethosData.positiveReviewCount / totalReviews;
            reliabilityScore = Math.floor(positiveRatio * 100);
        }
        // Map credibility score to professionalism
        const professionalismScore = Math.min(100, Math.floor((ethosData.credibilityScore / 1000) * 100));
        // Calculate weighted overall (Quality: 40%, Reliability: 35%, Professionalism: 25%)
        const overallScore = Math.floor((qualityScore * 0.4) +
            (reliabilityScore * 0.35) +
            (professionalismScore * 0.25));
        return {
            qualityScore,
            reliabilityScore,
            professionalismScore,
            overallScore,
        };
    }
    /**
     * Generate signature for on-chain reputation update
     * REQUIRED for secure reputation updates
     */
    async generateReputationSignature(userAddress, qualityScore, reliabilityScore, professionalismScore, signerPrivateKey) {
        const wallet = new ethers_1.ethers.Wallet(signerPrivateKey);
        // Create message hash (matches contract verification)
        const timestamp = Math.floor(Date.now() / 1000 / 3600); // Hour-based
        const messageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'uint8', 'uint8', 'uint8', 'uint256'], [userAddress, qualityScore, reliabilityScore, professionalismScore, timestamp]);
        // Sign message
        const signature = await wallet.signMessage(ethers_1.ethers.getBytes(messageHash));
        return signature;
    }
    /**
     * Batch get users by addresses (API v2)
     * REQUIRED for efficient reputation updates
     */
    async batchGetUsers(addresses) {
        try {
            const response = await this.client.post('/users/by/address', {
                addresses,
            });
            const users = response.data;
            const results = new Map();
            for (const user of users) {
                // Match users to addresses via userkeys
                for (const key of user.userkeys) {
                    if (key.toLowerCase().startsWith('0x')) {
                        results.set(key.toLowerCase(), user);
                    }
                }
            }
            return results;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Ethos API batch error: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Batch update reputations for multiple users
     * REQUIRED for efficient reputation updates
     */
    async batchGetScores(addresses) {
        try {
            const users = await this.batchGetUsers(addresses);
            const results = new Map();
            for (const [address, user] of users) {
                results.set(address, {
                    score: user.score,
                    credibilityScore: Math.floor(user.score * 0.5),
                    positiveReviewCount: user.stats.review.received.positive,
                    negativeReviewCount: user.stats.review.received.negative,
                    neutralReviewCount: user.stats.review.received.neutral,
                });
            }
            return results;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Ethos API batch error: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Get user by Twitter/X username (API v2)
     */
    async getUserByTwitter(usernameOrId) {
        try {
            const response = await this.client.get(`/user/by/x/${usernameOrId}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Get user by Discord ID (API v2)
     */
    async getUserByDiscord(discordId) {
        try {
            const response = await this.client.get(`/user/by/discord/${discordId}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Search users (API v2)
     */
    async searchUsers(query, options) {
        try {
            const params = new URLSearchParams({ query });
            if (options?.limit)
                params.set('limit', options.limit.toString());
            if (options?.offset)
                params.set('offset', options.offset.toString());
            const response = await this.client.get(`/users/search?${params}`);
            return {
                users: response.data.values || [],
                total: response.data.total || 0,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Ethos API search error: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Verify Ethos attestation
     * REQUIRED for user verification
     */
    async verifyAttestation(address, service) {
        try {
            const user = await this.getUserByAddress(address);
            if (!user)
                return false;
            // Check userkeys for service attestation
            const servicePrefix = service.toLowerCase();
            return user.userkeys.some(key => key.toLowerCase().includes(servicePrefix));
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get minimum required Ethos score for platform access
     * REQUIRED threshold enforcement (on 0-2000 scale)
     */
    getMinimumEthosScore() {
        return 400; // Minimum Ethos score of 400/2000 required
    }
    /**
     * Check if user meets minimum Ethos requirements
     * REQUIRED validation before platform access
     */
    async meetsMinimumRequirements(address) {
        const user = await this.getUserByAddress(address);
        const minScore = this.getMinimumEthosScore();
        if (!user) {
            return {
                meets: false,
                reason: 'No Ethos profile found',
                ethosScore: 0,
            };
        }
        if (user.score < minScore) {
            return {
                meets: false,
                reason: `Ethos score too low: ${user.score}/${minScore}`,
                ethosScore: user.score,
            };
        }
        return {
            meets: true,
            ethosScore: user.score,
        };
    }
    /**
     * Health check for Ethos API
     * REQUIRED to ensure service availability
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Use search endpoint with empty result as health check
            await this.client.get('/users/search?query=healthcheck&limit=1');
            const latency = Date.now() - startTime;
            return {
                healthy: true,
                latency,
            };
        }
        catch (error) {
            return {
                healthy: false,
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.EthosService = EthosService;
/**
 * Ethos webhook handler for real-time updates
 * REQUIRED for keeping reputation in sync
 */
class EthosWebhookHandler {
    constructor(webhookSecret) {
        if (!webhookSecret) {
            throw new Error('Webhook secret is required for Ethos integration');
        }
        this.webhookSecret = webhookSecret;
    }
    /**
     * Verify webhook signature
     * REQUIRED for security
     */
    verifySignature(payload, signature) {
        const expectedSignature = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(payload + this.webhookSecret));
        return signature === expectedSignature;
    }
    /**
     * Process webhook event
     * REQUIRED for handling Ethos updates
     */
    async processEvent(event) {
        switch (event.type) {
            case 'score_updated':
                // Ethos score changed - update on-chain reputation
                return {
                    shouldUpdateOnChain: true,
                    newScores: {
                        qualityScore: event.data.qualityScore,
                        reliabilityScore: event.data.reliabilityScore,
                        professionalismScore: event.data.professionalismScore,
                    },
                };
            case 'review_added':
                // New review - may trigger score update
                if (event.data.significant) {
                    return {
                        shouldUpdateOnChain: true,
                        newScores: event.data.newScores,
                    };
                }
                return { shouldUpdateOnChain: false };
            case 'vouch_added':
                // New vouch - update reliability score
                return {
                    shouldUpdateOnChain: true,
                    newScores: event.data.newScores,
                };
            case 'attestation_verified':
                // New attestation - may boost professionalism
                return {
                    shouldUpdateOnChain: true,
                    newScores: event.data.newScores,
                };
            default:
                return { shouldUpdateOnChain: false };
        }
    }
}
exports.EthosWebhookHandler = EthosWebhookHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXRob3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NlcnZpY2VzL0V0aG9zU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBNkM7QUFDN0MsbUNBQWdDO0FBNkNoQzs7O0dBR0c7QUFDSCxNQUFhLFlBQVk7SUFJckIsWUFBWSxNQUdYO1FBQ0csSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLDBFQUEwRSxDQUFDLENBQUM7UUFDaEcsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUU1QixJQUFJLENBQUMsTUFBTSxHQUFHLGVBQUssQ0FBQyxNQUFNLENBQUM7WUFDdkIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLElBQUksa0NBQWtDO1lBQzdELE9BQU8sRUFBRTtnQkFDTCxlQUFlLEVBQUUsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUMxQyxjQUFjLEVBQUUsa0JBQWtCO2FBQ3JDO1lBQ0QsT0FBTyxFQUFFLEtBQUs7U0FDakIsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFlO1FBQ2xDLElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDdEUsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQ3pCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsSUFBSSxlQUFLLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUM5RCxPQUFPLElBQUksQ0FBQyxDQUFDLDBCQUEwQjtZQUMzQyxDQUFDO1lBQ0QsTUFBTSxLQUFLLENBQUM7UUFDaEIsQ0FBQztJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQWU7UUFRMUIsSUFBSSxDQUFDO1lBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFbEQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNSLCtDQUErQztnQkFDL0MsT0FBTztvQkFDSCxLQUFLLEVBQUUsQ0FBQztvQkFDUixnQkFBZ0IsRUFBRSxDQUFDO29CQUNuQixtQkFBbUIsRUFBRSxDQUFDO29CQUN0QixtQkFBbUIsRUFBRSxDQUFDO29CQUN0QixrQkFBa0IsRUFBRSxDQUFDO29CQUNyQixXQUFXLEVBQUUsSUFBSSxJQUFJLEVBQUU7aUJBQzFCLENBQUM7WUFDTixDQUFDO1lBRUQsT0FBTztnQkFDSCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7Z0JBQ2pCLGdCQUFnQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsRUFBRSx5QkFBeUI7Z0JBQ3pFLG1CQUFtQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRO2dCQUN4RCxtQkFBbUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUTtnQkFDeEQsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU87Z0JBQ3RELFdBQVcsRUFBRSxJQUFJLElBQUksRUFBRTthQUMxQixDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixJQUFJLGVBQUssQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2hCLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlO1FBb0I1QixJQUFJLENBQUM7WUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVsRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1IsT0FBTztvQkFDSCxPQUFPO29CQUNQLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksRUFBRSxJQUFJO29CQUNWLE9BQU8sRUFBRSxFQUFFO29CQUNYLE9BQU8sRUFBRSxFQUFFO29CQUNYLFlBQVksRUFBRSxFQUFFO2lCQUNuQixDQUFDO1lBQ04sQ0FBQztZQUVELE9BQU87Z0JBQ0gsT0FBTztnQkFDUCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7Z0JBQ2pCLElBQUk7Z0JBQ0osMEVBQTBFO2dCQUMxRSxpREFBaUQ7Z0JBQ2pELE9BQU8sRUFBRSxFQUFFO2dCQUNYLE9BQU8sRUFBRSxFQUFFO2dCQUNYLFlBQVksRUFBRSxFQUFFO2FBQ25CLENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLElBQUksZUFBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN6RCxDQUFDO1lBQ0QsTUFBTSxLQUFLLENBQUM7UUFDaEIsQ0FBQztJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSCwyQkFBMkIsQ0FBQyxTQU0zQjtRQU1HLG9EQUFvRDtRQUNwRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRS9FLDBDQUEwQztRQUMxQyxNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsbUJBQW1CO1lBQzlDLFNBQVMsQ0FBQyxtQkFBbUI7WUFDN0IsU0FBUyxDQUFDLGtCQUFrQixDQUFDO1FBRWpDLElBQUksZ0JBQWdCLEdBQUcsRUFBRSxDQUFDLENBQUMsVUFBVTtRQUNyQyxJQUFJLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNuQixNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsWUFBWSxDQUFDO1lBQ25FLGdCQUFnQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFFRCwyQ0FBMkM7UUFDM0MsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFbEcsb0ZBQW9GO1FBQ3BGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQzNCLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQztZQUNwQixDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztZQUN6QixDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQyxDQUNoQyxDQUFDO1FBRUYsT0FBTztZQUNILFlBQVk7WUFDWixnQkFBZ0I7WUFDaEIsb0JBQW9CO1lBQ3BCLFlBQVk7U0FDZixDQUFDO0lBQ04sQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQywyQkFBMkIsQ0FDN0IsV0FBbUIsRUFDbkIsWUFBb0IsRUFDcEIsZ0JBQXdCLEVBQ3hCLG9CQUE0QixFQUM1QixnQkFBd0I7UUFFeEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFbkQsc0RBQXNEO1FBQ3RELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLGFBQWE7UUFDckUsTUFBTSxXQUFXLEdBQUcsZUFBTSxDQUFDLHVCQUF1QixDQUM5QyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUMsRUFDakQsQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxDQUNqRixDQUFDO1FBRUYsZUFBZTtRQUNmLE1BQU0sU0FBUyxHQUFHLE1BQU0sTUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFekUsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBbUI7UUFDbkMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtnQkFDekQsU0FBUzthQUNaLENBQUMsQ0FBQztZQUVILE1BQU0sS0FBSyxHQUFnQixRQUFRLENBQUMsSUFBSSxDQUFDO1lBQ3pDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1lBRTdDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ3ZCLHdDQUF3QztnQkFDeEMsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQzlCLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO3dCQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDekMsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUVELE9BQU8sT0FBTyxDQUFDO1FBQ25CLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsSUFBSSxlQUFLLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQy9ELENBQUM7WUFDRCxNQUFNLEtBQUssQ0FBQztRQUNoQixDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxjQUFjLENBQUMsU0FBbUI7UUFPcEMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQU1uQixDQUFDO1lBRUwsS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRTtvQkFDakIsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO29CQUNqQixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO29CQUM5QyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUTtvQkFDeEQsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVE7b0JBQ3hELGtCQUFrQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPO2lCQUN6RCxDQUFDLENBQUM7WUFDUCxDQUFDO1lBRUQsT0FBTyxPQUFPLENBQUM7UUFDbkIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixJQUFJLGVBQUssQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDL0QsQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2hCLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsWUFBb0I7UUFDdkMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxjQUFjLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDckUsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQ3pCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsSUFBSSxlQUFLLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUM5RCxPQUFPLElBQUksQ0FBQztZQUNoQixDQUFDO1lBQ0QsTUFBTSxLQUFLLENBQUM7UUFDaEIsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFpQjtRQUNwQyxJQUFJLENBQUM7WUFDRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3hFLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQztRQUN6QixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLElBQUksZUFBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDOUQsT0FBTyxJQUFJLENBQUM7WUFDaEIsQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2hCLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUNiLEtBQWEsRUFDYixPQUE2QztRQUU3QyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQWUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDOUMsSUFBSSxPQUFPLEVBQUUsS0FBSztnQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDbEUsSUFBSSxPQUFPLEVBQUUsTUFBTTtnQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFFckUsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUNsRSxPQUFPO2dCQUNILEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFO2dCQUNqQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQzthQUNsQyxDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixJQUFJLGVBQUssQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2hCLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLGlCQUFpQixDQUNuQixPQUFlLEVBQ2YsT0FBZTtRQUVmLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxJQUFJO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBRXhCLHlDQUF5QztZQUN6QyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDNUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUM1QixHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUM1QyxDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPLEtBQUssQ0FBQztRQUNqQixDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILG9CQUFvQjtRQUNoQixPQUFPLEdBQUcsQ0FBQyxDQUFDLDJDQUEyQztJQUMzRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLHdCQUF3QixDQUFDLE9BQWU7UUFLMUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFFN0MsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1IsT0FBTztnQkFDSCxLQUFLLEVBQUUsS0FBSztnQkFDWixNQUFNLEVBQUUsd0JBQXdCO2dCQUNoQyxVQUFVLEVBQUUsQ0FBQzthQUNoQixDQUFDO1FBQ04sQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztZQUN4QixPQUFPO2dCQUNILEtBQUssRUFBRSxLQUFLO2dCQUNaLE1BQU0sRUFBRSx3QkFBd0IsSUFBSSxDQUFDLEtBQUssSUFBSSxRQUFRLEVBQUU7Z0JBQ3hELFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSzthQUN6QixDQUFDO1FBQ04sQ0FBQztRQUVELE9BQU87WUFDSCxLQUFLLEVBQUUsSUFBSTtZQUNYLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSztTQUN6QixDQUFDO0lBQ04sQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxXQUFXO1FBS2IsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRTdCLElBQUksQ0FBQztZQUNELHdEQUF3RDtZQUN4RCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7WUFDakUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztZQUV2QyxPQUFPO2dCQUNILE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU87YUFDVixDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPO2dCQUNILE9BQU8sRUFBRSxLQUFLO2dCQUNkLE9BQU8sRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUztnQkFDL0IsS0FBSyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLGVBQWU7YUFDbEUsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUEvYUQsb0NBK2FDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBYSxtQkFBbUI7SUFHNUIsWUFBWSxhQUFxQjtRQUM3QixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFDRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsZUFBZSxDQUFDLE9BQWUsRUFBRSxTQUFpQjtRQUM5QyxNQUFNLGlCQUFpQixHQUFHLGVBQU0sQ0FBQyxTQUFTLENBQ3RDLGVBQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FDbkQsQ0FBQztRQUVGLE9BQU8sU0FBUyxLQUFLLGlCQUFpQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsWUFBWSxDQUFDLEtBS2xCO1FBUUcsUUFBUSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakIsS0FBSyxlQUFlO2dCQUNoQixtREFBbUQ7Z0JBQ25ELE9BQU87b0JBQ0gsbUJBQW1CLEVBQUUsSUFBSTtvQkFDekIsU0FBUyxFQUFFO3dCQUNQLFlBQVksRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVk7d0JBQ3JDLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO3dCQUM3QyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLG9CQUFvQjtxQkFDeEQ7aUJBQ0osQ0FBQztZQUVOLEtBQUssY0FBYztnQkFDZix3Q0FBd0M7Z0JBQ3hDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDekIsT0FBTzt3QkFDSCxtQkFBbUIsRUFBRSxJQUFJO3dCQUN6QixTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTO3FCQUNsQyxDQUFDO2dCQUNOLENBQUM7Z0JBQ0QsT0FBTyxFQUFFLG1CQUFtQixFQUFFLEtBQUssRUFBRSxDQUFDO1lBRTFDLEtBQUssYUFBYTtnQkFDZCx1Q0FBdUM7Z0JBQ3ZDLE9BQU87b0JBQ0gsbUJBQW1CLEVBQUUsSUFBSTtvQkFDekIsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUztpQkFDbEMsQ0FBQztZQUVOLEtBQUssc0JBQXNCO2dCQUN2Qiw4Q0FBOEM7Z0JBQzlDLE9BQU87b0JBQ0gsbUJBQW1CLEVBQUUsSUFBSTtvQkFDekIsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUztpQkFDbEMsQ0FBQztZQUVOO2dCQUNJLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUM5QyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBL0VELGtEQStFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBheGlvcywgeyBBeGlvc0luc3RhbmNlIH0gZnJvbSAnYXhpb3MnO1xyXG5pbXBvcnQgeyBldGhlcnMgfSBmcm9tICdldGhlcnMnO1xyXG5cclxuLyoqXHJcbiAqIEV0aG9zIHVzZXIgZGF0YSBhcyByZXR1cm5lZCBieSB0aGUgQVBJIHYyXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIEV0aG9zVXNlciB7XHJcbiAgICBpZDogbnVtYmVyO1xyXG4gICAgcHJvZmlsZUlkOiBudW1iZXI7XHJcbiAgICBkaXNwbGF5TmFtZTogc3RyaW5nO1xyXG4gICAgdXNlcm5hbWU6IHN0cmluZztcclxuICAgIGF2YXRhclVybDogc3RyaW5nIHwgbnVsbDtcclxuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCBudWxsO1xyXG4gICAgc2NvcmU6IG51bWJlcjsgLy8gMC0yMDAwIHNjYWxlXHJcbiAgICBzdGF0dXM6ICdBQ1RJVkUnIHwgJ0lOQUNUSVZFJyB8ICdCQU5ORUQnO1xyXG4gICAgdXNlcmtleXM6IHN0cmluZ1tdO1xyXG4gICAgeHBUb3RhbDogbnVtYmVyO1xyXG4gICAgeHBTdHJlYWtEYXlzOiBudW1iZXI7XHJcbiAgICB4cFJlbW92ZWREdWVUb0FidXNlOiBib29sZWFuO1xyXG4gICAgaW5mbHVlbmNlRmFjdG9yOiBudW1iZXI7XHJcbiAgICBpbmZsdWVuY2VGYWN0b3JQZXJjZW50aWxlOiBudW1iZXI7XHJcbiAgICBsaW5rczoge1xyXG4gICAgICAgIHByb2ZpbGU6IHN0cmluZztcclxuICAgICAgICBzY29yZUJyZWFrZG93bjogc3RyaW5nO1xyXG4gICAgfTtcclxuICAgIHN0YXRzOiB7XHJcbiAgICAgICAgcmV2aWV3OiB7XHJcbiAgICAgICAgICAgIHJlY2VpdmVkOiB7XHJcbiAgICAgICAgICAgICAgICBuZWdhdGl2ZTogbnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgbmV1dHJhbDogbnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpdmU6IG51bWJlcjtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHZvdWNoOiB7XHJcbiAgICAgICAgICAgIGdpdmVuOiB7XHJcbiAgICAgICAgICAgICAgICBhbW91bnRXZWlUb3RhbDogbnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgY291bnQ6IG51bWJlcjtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmVjZWl2ZWQ6IHtcclxuICAgICAgICAgICAgICAgIGFtb3VudFdlaVRvdGFsOiBudW1iZXI7XHJcbiAgICAgICAgICAgICAgICBjb3VudDogbnVtYmVyO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogRXRob3NTZXJ2aWNlIC0gUmVxdWlyZWQgaW50ZWdyYXRpb24gd2l0aCBFdGhvcyBOZXR3b3JrIEFQSSB2MlxyXG4gKiBUaGlzIGlzIE5PVCBvcHRpb25hbCAtIHJlcHV0YXRpb24gc3lzdGVtIGRlcGVuZHMgb24gRXRob3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBFdGhvc1NlcnZpY2Uge1xyXG4gICAgcHJpdmF0ZSBjbGllbnQ6IEF4aW9zSW5zdGFuY2U7XHJcbiAgICBwcml2YXRlIGFwaUtleTogc3RyaW5nO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGNvbmZpZzoge1xyXG4gICAgICAgIGFwaUtleTogc3RyaW5nO1xyXG4gICAgICAgIGJhc2VVcmw/OiBzdHJpbmc7XHJcbiAgICB9KSB7XHJcbiAgICAgICAgaWYgKCFjb25maWcuYXBpS2V5KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXRob3MgQVBJIGtleSBpcyByZXF1aXJlZCAtIHJlcHV0YXRpb24gc3lzdGVtIGNhbm5vdCBmdW5jdGlvbiB3aXRob3V0IGl0Jyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFwaUtleSA9IGNvbmZpZy5hcGlLZXk7XHJcblxyXG4gICAgICAgIHRoaXMuY2xpZW50ID0gYXhpb3MuY3JlYXRlKHtcclxuICAgICAgICAgICAgYmFzZVVSTDogY29uZmlnLmJhc2VVcmwgfHwgJ2h0dHBzOi8vYXBpLmV0aG9zLm5ldHdvcmsvYXBpL3YyJyxcclxuICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7Y29uZmlnLmFwaUtleX1gLFxyXG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdGltZW91dDogMTAwMDAsXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgRXRob3MgdXNlciBieSBhZGRyZXNzIChBUEkgdjIpXHJcbiAgICAgKiBSZXR1cm5zIGZ1bGwgdXNlciBkYXRhIGluY2x1ZGluZyBzY29yZVxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRVc2VyQnlBZGRyZXNzKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8RXRob3NVc2VyIHwgbnVsbD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ2V0KGAvdXNlci9ieS9hZGRyZXNzLyR7YWRkcmVzc31gKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgaWYgKGF4aW9zLmlzQXhpb3NFcnJvcihlcnJvcikgJiYgZXJyb3IucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDA0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDsgLy8gVXNlciBub3QgZm91bmQgb24gRXRob3NcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgRXRob3Mgc2NvcmUgZm9yIGFuIGFkZHJlc3NcclxuICAgICAqIFJFUVVJUkVEIGZvciByZXB1dGF0aW9uIGNhbGN1bGF0aW9uXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldFNjb3JlKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8e1xyXG4gICAgICAgIHNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgY3JlZGliaWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgIHBvc2l0aXZlUmV2aWV3Q291bnQ6IG51bWJlcjtcclxuICAgICAgICBuZWdhdGl2ZVJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICAgICAgbmV1dHJhbFJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICAgICAgbGFzdFVwZGF0ZWQ6IERhdGU7XHJcbiAgICB9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRoaXMuZ2V0VXNlckJ5QWRkcmVzcyhhZGRyZXNzKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghdXNlcikge1xyXG4gICAgICAgICAgICAgICAgLy8gUmV0dXJuIGRlZmF1bHQgc2NvcmVzIGZvciB1c2VycyBub3Qgb24gRXRob3NcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2NvcmU6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgY3JlZGliaWxpdHlTY29yZTogMCxcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGl2ZVJldmlld0NvdW50OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIG5lZ2F0aXZlUmV2aWV3Q291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgbmV1dHJhbFJldmlld0NvdW50OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGxhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHNjb3JlOiB1c2VyLnNjb3JlLFxyXG4gICAgICAgICAgICAgICAgY3JlZGliaWxpdHlTY29yZTogTWF0aC5mbG9vcih1c2VyLnNjb3JlICogMC41KSwgLy8gRGVyaXZlIGZyb20gbWFpbiBzY29yZVxyXG4gICAgICAgICAgICAgICAgcG9zaXRpdmVSZXZpZXdDb3VudDogdXNlci5zdGF0cy5yZXZpZXcucmVjZWl2ZWQucG9zaXRpdmUsXHJcbiAgICAgICAgICAgICAgICBuZWdhdGl2ZVJldmlld0NvdW50OiB1c2VyLnN0YXRzLnJldmlldy5yZWNlaXZlZC5uZWdhdGl2ZSxcclxuICAgICAgICAgICAgICAgIG5ldXRyYWxSZXZpZXdDb3VudDogdXNlci5zdGF0cy5yZXZpZXcucmVjZWl2ZWQubmV1dHJhbCxcclxuICAgICAgICAgICAgICAgIGxhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGlmIChheGlvcy5pc0F4aW9zRXJyb3IoZXJyb3IpKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV0aG9zIEFQSSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBkZXRhaWxlZCBwcm9maWxlIGZyb20gRXRob3MgKEFQSSB2MilcclxuICAgICAqIFJFUVVJUkVEIGZvciBjb21wcmVoZW5zaXZlIHJlcHV0YXRpb24gYXNzZXNzbWVudFxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRQcm9maWxlKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8e1xyXG4gICAgICAgIGFkZHJlc3M6IHN0cmluZztcclxuICAgICAgICBzY29yZTogbnVtYmVyO1xyXG4gICAgICAgIHVzZXI6IEV0aG9zVXNlciB8IG51bGw7XHJcbiAgICAgICAgcmV2aWV3czogQXJyYXk8e1xyXG4gICAgICAgICAgICBhdXRob3I6IHN0cmluZztcclxuICAgICAgICAgICAgc2NvcmU6IG51bWJlcjtcclxuICAgICAgICAgICAgY29tbWVudDogc3RyaW5nO1xyXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGU7XHJcbiAgICAgICAgfT47XHJcbiAgICAgICAgdm91Y2hlczogQXJyYXk8e1xyXG4gICAgICAgICAgICB2b3VjaGVyOiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZTtcclxuICAgICAgICB9PjtcclxuICAgICAgICBhdHRlc3RhdGlvbnM6IEFycmF5PHtcclxuICAgICAgICAgICAgc2VydmljZTogc3RyaW5nO1xyXG4gICAgICAgICAgICB2ZXJpZmllZDogYm9vbGVhbjtcclxuICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlO1xyXG4gICAgICAgIH0+O1xyXG4gICAgfT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0aGlzLmdldFVzZXJCeUFkZHJlc3MoYWRkcmVzcyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXVzZXIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkcmVzcyxcclxuICAgICAgICAgICAgICAgICAgICBzY29yZTogMCxcclxuICAgICAgICAgICAgICAgICAgICB1c2VyOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIHJldmlld3M6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZvdWNoZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIGF0dGVzdGF0aW9uczogW10sXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgYWRkcmVzcyxcclxuICAgICAgICAgICAgICAgIHNjb3JlOiB1c2VyLnNjb3JlLFxyXG4gICAgICAgICAgICAgICAgdXNlcixcclxuICAgICAgICAgICAgICAgIC8vIE5vdGU6IHYyIEFQSSBkb2Vzbid0IHJldHVybiBpbmRpdmlkdWFsIHJldmlld3Mvdm91Y2hlcyBpbiB1c2VyIGVuZHBvaW50XHJcbiAgICAgICAgICAgICAgICAvLyBXb3VsZCBuZWVkIGFkZGl0aW9uYWwgZW5kcG9pbnRzIHRvIGZldGNoIHRoZXNlXHJcbiAgICAgICAgICAgICAgICByZXZpZXdzOiBbXSxcclxuICAgICAgICAgICAgICAgIHZvdWNoZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgYXR0ZXN0YXRpb25zOiBbXSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAoYXhpb3MuaXNBeGlvc0Vycm9yKGVycm9yKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdGhvcyBBUEkgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgcGxhdGZvcm0gcmVwdXRhdGlvbiBmcm9tIEV0aG9zIHNjb3JlXHJcbiAgICAgKiBSRVFVSVJFRCBtYXBwaW5nIGZyb20gRXRob3MgKDAtMjAwMCkgdG8gcGxhdGZvcm0gc2NvcmVzICgwLTEwMClcclxuICAgICAqL1xyXG4gICAgY2FsY3VsYXRlUGxhdGZvcm1SZXB1dGF0aW9uKGV0aG9zRGF0YToge1xyXG4gICAgICAgIHNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgY3JlZGliaWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgIHBvc2l0aXZlUmV2aWV3Q291bnQ6IG51bWJlcjtcclxuICAgICAgICBuZWdhdGl2ZVJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICAgICAgbmV1dHJhbFJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICB9KToge1xyXG4gICAgICAgIHF1YWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgIHJlbGlhYmlsaXR5U2NvcmU6IG51bWJlcjtcclxuICAgICAgICBwcm9mZXNzaW9uYWxpc21TY29yZTogbnVtYmVyO1xyXG4gICAgICAgIG92ZXJhbGxTY29yZTogbnVtYmVyO1xyXG4gICAgfSB7XHJcbiAgICAgICAgLy8gTWFwIEV0aG9zIHNjb3JlICgwLTIwMDApIHRvIHF1YWxpdHkgc2NvcmUgKDAtMTAwKVxyXG4gICAgICAgIGNvbnN0IHF1YWxpdHlTY29yZSA9IE1hdGgubWluKDEwMCwgTWF0aC5mbG9vcigoZXRob3NEYXRhLnNjb3JlIC8gMjAwMCkgKiAxMDApKTtcclxuXHJcbiAgICAgICAgLy8gQ2FsY3VsYXRlIHJlbGlhYmlsaXR5IGZyb20gcmV2aWV3IHJhdGlvXHJcbiAgICAgICAgY29uc3QgdG90YWxSZXZpZXdzID0gZXRob3NEYXRhLnBvc2l0aXZlUmV2aWV3Q291bnQgK1xyXG4gICAgICAgICAgICBldGhvc0RhdGEubmVnYXRpdmVSZXZpZXdDb3VudCArXHJcbiAgICAgICAgICAgIGV0aG9zRGF0YS5uZXV0cmFsUmV2aWV3Q291bnQ7XHJcblxyXG4gICAgICAgIGxldCByZWxpYWJpbGl0eVNjb3JlID0gNTA7IC8vIERlZmF1bHRcclxuICAgICAgICBpZiAodG90YWxSZXZpZXdzID4gMCkge1xyXG4gICAgICAgICAgICBjb25zdCBwb3NpdGl2ZVJhdGlvID0gZXRob3NEYXRhLnBvc2l0aXZlUmV2aWV3Q291bnQgLyB0b3RhbFJldmlld3M7XHJcbiAgICAgICAgICAgIHJlbGlhYmlsaXR5U2NvcmUgPSBNYXRoLmZsb29yKHBvc2l0aXZlUmF0aW8gKiAxMDApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gTWFwIGNyZWRpYmlsaXR5IHNjb3JlIHRvIHByb2Zlc3Npb25hbGlzbVxyXG4gICAgICAgIGNvbnN0IHByb2Zlc3Npb25hbGlzbVNjb3JlID0gTWF0aC5taW4oMTAwLCBNYXRoLmZsb29yKChldGhvc0RhdGEuY3JlZGliaWxpdHlTY29yZSAvIDEwMDApICogMTAwKSk7XHJcblxyXG4gICAgICAgIC8vIENhbGN1bGF0ZSB3ZWlnaHRlZCBvdmVyYWxsIChRdWFsaXR5OiA0MCUsIFJlbGlhYmlsaXR5OiAzNSUsIFByb2Zlc3Npb25hbGlzbTogMjUlKVxyXG4gICAgICAgIGNvbnN0IG92ZXJhbGxTY29yZSA9IE1hdGguZmxvb3IoXHJcbiAgICAgICAgICAgIChxdWFsaXR5U2NvcmUgKiAwLjQpICtcclxuICAgICAgICAgICAgKHJlbGlhYmlsaXR5U2NvcmUgKiAwLjM1KSArXHJcbiAgICAgICAgICAgIChwcm9mZXNzaW9uYWxpc21TY29yZSAqIDAuMjUpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgcXVhbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICByZWxpYWJpbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICBwcm9mZXNzaW9uYWxpc21TY29yZSxcclxuICAgICAgICAgICAgb3ZlcmFsbFNjb3JlLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZW5lcmF0ZSBzaWduYXR1cmUgZm9yIG9uLWNoYWluIHJlcHV0YXRpb24gdXBkYXRlXHJcbiAgICAgKiBSRVFVSVJFRCBmb3Igc2VjdXJlIHJlcHV0YXRpb24gdXBkYXRlc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZVJlcHV0YXRpb25TaWduYXR1cmUoXHJcbiAgICAgICAgdXNlckFkZHJlc3M6IHN0cmluZyxcclxuICAgICAgICBxdWFsaXR5U2NvcmU6IG51bWJlcixcclxuICAgICAgICByZWxpYWJpbGl0eVNjb3JlOiBudW1iZXIsXHJcbiAgICAgICAgcHJvZmVzc2lvbmFsaXNtU2NvcmU6IG51bWJlcixcclxuICAgICAgICBzaWduZXJQcml2YXRlS2V5OiBzdHJpbmdcclxuICAgICk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICAgICAgY29uc3Qgd2FsbGV0ID0gbmV3IGV0aGVycy5XYWxsZXQoc2lnbmVyUHJpdmF0ZUtleSk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBtZXNzYWdlIGhhc2ggKG1hdGNoZXMgY29udHJhY3QgdmVyaWZpY2F0aW9uKVxyXG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDAgLyAzNjAwKTsgLy8gSG91ci1iYXNlZFxyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VIYXNoID0gZXRoZXJzLnNvbGlkaXR5UGFja2VkS2VjY2FrMjU2KFxyXG4gICAgICAgICAgICBbJ2FkZHJlc3MnLCAndWludDgnLCAndWludDgnLCAndWludDgnLCAndWludDI1NiddLFxyXG4gICAgICAgICAgICBbdXNlckFkZHJlc3MsIHF1YWxpdHlTY29yZSwgcmVsaWFiaWxpdHlTY29yZSwgcHJvZmVzc2lvbmFsaXNtU2NvcmUsIHRpbWVzdGFtcF1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBTaWduIG1lc3NhZ2VcclxuICAgICAgICBjb25zdCBzaWduYXR1cmUgPSBhd2FpdCB3YWxsZXQuc2lnbk1lc3NhZ2UoZXRoZXJzLmdldEJ5dGVzKG1lc3NhZ2VIYXNoKSk7XHJcblxyXG4gICAgICAgIHJldHVybiBzaWduYXR1cmU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBCYXRjaCBnZXQgdXNlcnMgYnkgYWRkcmVzc2VzIChBUEkgdjIpXHJcbiAgICAgKiBSRVFVSVJFRCBmb3IgZWZmaWNpZW50IHJlcHV0YXRpb24gdXBkYXRlc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBiYXRjaEdldFVzZXJzKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPE1hcDxzdHJpbmcsIEV0aG9zVXNlcj4+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LnBvc3QoJy91c2Vycy9ieS9hZGRyZXNzJywge1xyXG4gICAgICAgICAgICAgICAgYWRkcmVzc2VzLFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXJzOiBFdGhvc1VzZXJbXSA9IHJlc3BvbnNlLmRhdGE7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBuZXcgTWFwPHN0cmluZywgRXRob3NVc2VyPigpO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCB1c2VyIG9mIHVzZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBNYXRjaCB1c2VycyB0byBhZGRyZXNzZXMgdmlhIHVzZXJrZXlzXHJcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB1c2VyLnVzZXJrZXlzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleS50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgoJzB4JykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5zZXQoa2V5LnRvTG93ZXJDYXNlKCksIHVzZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgaWYgKGF4aW9zLmlzQXhpb3NFcnJvcihlcnJvcikpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXRob3MgQVBJIGJhdGNoIGVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQmF0Y2ggdXBkYXRlIHJlcHV0YXRpb25zIGZvciBtdWx0aXBsZSB1c2Vyc1xyXG4gICAgICogUkVRVUlSRUQgZm9yIGVmZmljaWVudCByZXB1dGF0aW9uIHVwZGF0ZXNcclxuICAgICAqL1xyXG4gICAgYXN5bmMgYmF0Y2hHZXRTY29yZXMoYWRkcmVzc2VzOiBzdHJpbmdbXSk6IFByb21pc2U8TWFwPHN0cmluZywge1xyXG4gICAgICAgIHNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgY3JlZGliaWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgIHBvc2l0aXZlUmV2aWV3Q291bnQ6IG51bWJlcjtcclxuICAgICAgICBuZWdhdGl2ZVJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICAgICAgbmV1dHJhbFJldmlld0NvdW50OiBudW1iZXI7XHJcbiAgICB9Pj4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXJzID0gYXdhaXQgdGhpcy5iYXRjaEdldFVzZXJzKGFkZHJlc3Nlcyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBuZXcgTWFwPHN0cmluZywge1xyXG4gICAgICAgICAgICAgICAgc2NvcmU6IG51bWJlcjtcclxuICAgICAgICAgICAgICAgIGNyZWRpYmlsaXR5U2NvcmU6IG51bWJlcjtcclxuICAgICAgICAgICAgICAgIHBvc2l0aXZlUmV2aWV3Q291bnQ6IG51bWJlcjtcclxuICAgICAgICAgICAgICAgIG5lZ2F0aXZlUmV2aWV3Q291bnQ6IG51bWJlcjtcclxuICAgICAgICAgICAgICAgIG5ldXRyYWxSZXZpZXdDb3VudDogbnVtYmVyO1xyXG4gICAgICAgICAgICB9PigpO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBbYWRkcmVzcywgdXNlcl0gb2YgdXNlcnMpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMuc2V0KGFkZHJlc3MsIHtcclxuICAgICAgICAgICAgICAgICAgICBzY29yZTogdXNlci5zY29yZSxcclxuICAgICAgICAgICAgICAgICAgICBjcmVkaWJpbGl0eVNjb3JlOiBNYXRoLmZsb29yKHVzZXIuc2NvcmUgKiAwLjUpLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aXZlUmV2aWV3Q291bnQ6IHVzZXIuc3RhdHMucmV2aWV3LnJlY2VpdmVkLnBvc2l0aXZlLFxyXG4gICAgICAgICAgICAgICAgICAgIG5lZ2F0aXZlUmV2aWV3Q291bnQ6IHVzZXIuc3RhdHMucmV2aWV3LnJlY2VpdmVkLm5lZ2F0aXZlLFxyXG4gICAgICAgICAgICAgICAgICAgIG5ldXRyYWxSZXZpZXdDb3VudDogdXNlci5zdGF0cy5yZXZpZXcucmVjZWl2ZWQubmV1dHJhbCxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAoYXhpb3MuaXNBeGlvc0Vycm9yKGVycm9yKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdGhvcyBBUEkgYmF0Y2ggZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdXNlciBieSBUd2l0dGVyL1ggdXNlcm5hbWUgKEFQSSB2MilcclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0VXNlckJ5VHdpdHRlcih1c2VybmFtZU9ySWQ6IHN0cmluZyk6IFByb21pc2U8RXRob3NVc2VyIHwgbnVsbD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ2V0KGAvdXNlci9ieS94LyR7dXNlcm5hbWVPcklkfWApO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAoYXhpb3MuaXNBeGlvc0Vycm9yKGVycm9yKSAmJiBlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCB1c2VyIGJ5IERpc2NvcmQgSUQgKEFQSSB2MilcclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0VXNlckJ5RGlzY29yZChkaXNjb3JkSWQ6IHN0cmluZyk6IFByb21pc2U8RXRob3NVc2VyIHwgbnVsbD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ2V0KGAvdXNlci9ieS9kaXNjb3JkLyR7ZGlzY29yZElkfWApO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAoYXhpb3MuaXNBeGlvc0Vycm9yKGVycm9yKSAmJiBlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlYXJjaCB1c2VycyAoQVBJIHYyKVxyXG4gICAgICovXHJcbiAgICBhc3luYyBzZWFyY2hVc2VycyhcclxuICAgICAgICBxdWVyeTogc3RyaW5nLFxyXG4gICAgICAgIG9wdGlvbnM/OiB7IGxpbWl0PzogbnVtYmVyOyBvZmZzZXQ/OiBudW1iZXIgfVxyXG4gICAgKTogUHJvbWlzZTx7IHVzZXJzOiBFdGhvc1VzZXJbXTsgdG90YWw6IG51bWJlciB9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHF1ZXJ5IH0pO1xyXG4gICAgICAgICAgICBpZiAob3B0aW9ucz8ubGltaXQpIHBhcmFtcy5zZXQoJ2xpbWl0Jywgb3B0aW9ucy5saW1pdC50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgaWYgKG9wdGlvbnM/Lm9mZnNldCkgcGFyYW1zLnNldCgnb2Zmc2V0Jywgb3B0aW9ucy5vZmZzZXQudG9TdHJpbmcoKSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmdldChgL3VzZXJzL3NlYXJjaD8ke3BhcmFtc31gKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHVzZXJzOiByZXNwb25zZS5kYXRhLnZhbHVlcyB8fCBbXSxcclxuICAgICAgICAgICAgICAgIHRvdGFsOiByZXNwb25zZS5kYXRhLnRvdGFsIHx8IDAsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgaWYgKGF4aW9zLmlzQXhpb3NFcnJvcihlcnJvcikpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXRob3MgQVBJIHNlYXJjaCBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFZlcmlmeSBFdGhvcyBhdHRlc3RhdGlvblxyXG4gICAgICogUkVRVUlSRUQgZm9yIHVzZXIgdmVyaWZpY2F0aW9uXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIHZlcmlmeUF0dGVzdGF0aW9uKFxyXG4gICAgICAgIGFkZHJlc3M6IHN0cmluZyxcclxuICAgICAgICBzZXJ2aWNlOiBzdHJpbmdcclxuICAgICk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0aGlzLmdldFVzZXJCeUFkZHJlc3MoYWRkcmVzcyk7XHJcbiAgICAgICAgICAgIGlmICghdXNlcikgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgdXNlcmtleXMgZm9yIHNlcnZpY2UgYXR0ZXN0YXRpb25cclxuICAgICAgICAgICAgY29uc3Qgc2VydmljZVByZWZpeCA9IHNlcnZpY2UudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHVzZXIudXNlcmtleXMuc29tZShrZXkgPT5cclxuICAgICAgICAgICAgICAgIGtleS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlcnZpY2VQcmVmaXgpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBtaW5pbXVtIHJlcXVpcmVkIEV0aG9zIHNjb3JlIGZvciBwbGF0Zm9ybSBhY2Nlc3NcclxuICAgICAqIFJFUVVJUkVEIHRocmVzaG9sZCBlbmZvcmNlbWVudCAob24gMC0yMDAwIHNjYWxlKVxyXG4gICAgICovXHJcbiAgICBnZXRNaW5pbXVtRXRob3NTY29yZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiA0MDA7IC8vIE1pbmltdW0gRXRob3Mgc2NvcmUgb2YgNDAwLzIwMDAgcmVxdWlyZWRcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrIGlmIHVzZXIgbWVldHMgbWluaW11bSBFdGhvcyByZXF1aXJlbWVudHNcclxuICAgICAqIFJFUVVJUkVEIHZhbGlkYXRpb24gYmVmb3JlIHBsYXRmb3JtIGFjY2Vzc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBtZWV0c01pbmltdW1SZXF1aXJlbWVudHMoYWRkcmVzczogc3RyaW5nKTogUHJvbWlzZTx7XHJcbiAgICAgICAgbWVldHM6IGJvb2xlYW47XHJcbiAgICAgICAgcmVhc29uPzogc3RyaW5nO1xyXG4gICAgICAgIGV0aG9zU2NvcmU6IG51bWJlcjtcclxuICAgIH0+IHtcclxuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdGhpcy5nZXRVc2VyQnlBZGRyZXNzKGFkZHJlc3MpO1xyXG4gICAgICAgIGNvbnN0IG1pblNjb3JlID0gdGhpcy5nZXRNaW5pbXVtRXRob3NTY29yZSgpO1xyXG5cclxuICAgICAgICBpZiAoIXVzZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1lZXRzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHJlYXNvbjogJ05vIEV0aG9zIHByb2ZpbGUgZm91bmQnLFxyXG4gICAgICAgICAgICAgICAgZXRob3NTY29yZTogMCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh1c2VyLnNjb3JlIDwgbWluU2NvcmUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1lZXRzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHJlYXNvbjogYEV0aG9zIHNjb3JlIHRvbyBsb3c6ICR7dXNlci5zY29yZX0vJHttaW5TY29yZX1gLFxyXG4gICAgICAgICAgICAgICAgZXRob3NTY29yZTogdXNlci5zY29yZSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG1lZXRzOiB0cnVlLFxyXG4gICAgICAgICAgICBldGhvc1Njb3JlOiB1c2VyLnNjb3JlLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWFsdGggY2hlY2sgZm9yIEV0aG9zIEFQSVxyXG4gICAgICogUkVRVUlSRUQgdG8gZW5zdXJlIHNlcnZpY2UgYXZhaWxhYmlsaXR5XHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGhlYWx0aENoZWNrKCk6IFByb21pc2U8e1xyXG4gICAgICAgIGhlYWx0aHk6IGJvb2xlYW47XHJcbiAgICAgICAgbGF0ZW5jeTogbnVtYmVyO1xyXG4gICAgICAgIGVycm9yPzogc3RyaW5nO1xyXG4gICAgfT4ge1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFVzZSBzZWFyY2ggZW5kcG9pbnQgd2l0aCBlbXB0eSByZXN1bHQgYXMgaGVhbHRoIGNoZWNrXHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY2xpZW50LmdldCgnL3VzZXJzL3NlYXJjaD9xdWVyeT1oZWFsdGhjaGVjayZsaW1pdD0xJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhdGVuY3kgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGhlYWx0aHk6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBsYXRlbmN5LFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBoZWFsdGh5OiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGxhdGVuY3k6IERhdGUubm93KCkgLSBzdGFydFRpbWUsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogRXRob3Mgd2ViaG9vayBoYW5kbGVyIGZvciByZWFsLXRpbWUgdXBkYXRlc1xyXG4gKiBSRVFVSVJFRCBmb3Iga2VlcGluZyByZXB1dGF0aW9uIGluIHN5bmNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBFdGhvc1dlYmhvb2tIYW5kbGVyIHtcclxuICAgIHByaXZhdGUgd2ViaG9va1NlY3JldDogc3RyaW5nO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHdlYmhvb2tTZWNyZXQ6IHN0cmluZykge1xyXG4gICAgICAgIGlmICghd2ViaG9va1NlY3JldCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYmhvb2sgc2VjcmV0IGlzIHJlcXVpcmVkIGZvciBFdGhvcyBpbnRlZ3JhdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLndlYmhvb2tTZWNyZXQgPSB3ZWJob29rU2VjcmV0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVmVyaWZ5IHdlYmhvb2sgc2lnbmF0dXJlXHJcbiAgICAgKiBSRVFVSVJFRCBmb3Igc2VjdXJpdHlcclxuICAgICAqL1xyXG4gICAgdmVyaWZ5U2lnbmF0dXJlKHBheWxvYWQ6IHN0cmluZywgc2lnbmF0dXJlOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICBjb25zdCBleHBlY3RlZFNpZ25hdHVyZSA9IGV0aGVycy5rZWNjYWsyNTYoXHJcbiAgICAgICAgICAgIGV0aGVycy50b1V0ZjhCeXRlcyhwYXlsb2FkICsgdGhpcy53ZWJob29rU2VjcmV0KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHJldHVybiBzaWduYXR1cmUgPT09IGV4cGVjdGVkU2lnbmF0dXJlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvY2VzcyB3ZWJob29rIGV2ZW50XHJcbiAgICAgKiBSRVFVSVJFRCBmb3IgaGFuZGxpbmcgRXRob3MgdXBkYXRlc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBwcm9jZXNzRXZlbnQoZXZlbnQ6IHtcclxuICAgICAgICB0eXBlOiAnc2NvcmVfdXBkYXRlZCcgfCAncmV2aWV3X2FkZGVkJyB8ICd2b3VjaF9hZGRlZCcgfCAnYXR0ZXN0YXRpb25fdmVyaWZpZWQnO1xyXG4gICAgICAgIGFkZHJlc3M6IHN0cmluZztcclxuICAgICAgICBkYXRhOiBhbnk7XHJcbiAgICAgICAgdGltZXN0YW1wOiBzdHJpbmc7XHJcbiAgICB9KTogUHJvbWlzZTx7XHJcbiAgICAgICAgc2hvdWxkVXBkYXRlT25DaGFpbjogYm9vbGVhbjtcclxuICAgICAgICBuZXdTY29yZXM/OiB7XHJcbiAgICAgICAgICAgIHF1YWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgICAgICByZWxpYWJpbGl0eVNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgICAgIHByb2Zlc3Npb25hbGlzbVNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgfTtcclxuICAgIH0+IHtcclxuICAgICAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSAnc2NvcmVfdXBkYXRlZCc6XHJcbiAgICAgICAgICAgICAgICAvLyBFdGhvcyBzY29yZSBjaGFuZ2VkIC0gdXBkYXRlIG9uLWNoYWluIHJlcHV0YXRpb25cclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkVXBkYXRlT25DaGFpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBuZXdTY29yZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eVNjb3JlOiBldmVudC5kYXRhLnF1YWxpdHlTY29yZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsaWFiaWxpdHlTY29yZTogZXZlbnQuZGF0YS5yZWxpYWJpbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9mZXNzaW9uYWxpc21TY29yZTogZXZlbnQuZGF0YS5wcm9mZXNzaW9uYWxpc21TY29yZSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ3Jldmlld19hZGRlZCc6XHJcbiAgICAgICAgICAgICAgICAvLyBOZXcgcmV2aWV3IC0gbWF5IHRyaWdnZXIgc2NvcmUgdXBkYXRlXHJcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuZGF0YS5zaWduaWZpY2FudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZFVwZGF0ZU9uQ2hhaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1Njb3JlczogZXZlbnQuZGF0YS5uZXdTY29yZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHNob3VsZFVwZGF0ZU9uQ2hhaW46IGZhbHNlIH07XHJcblxyXG4gICAgICAgICAgICBjYXNlICd2b3VjaF9hZGRlZCc6XHJcbiAgICAgICAgICAgICAgICAvLyBOZXcgdm91Y2ggLSB1cGRhdGUgcmVsaWFiaWxpdHkgc2NvcmVcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkVXBkYXRlT25DaGFpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBuZXdTY29yZXM6IGV2ZW50LmRhdGEubmV3U2NvcmVzLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ2F0dGVzdGF0aW9uX3ZlcmlmaWVkJzpcclxuICAgICAgICAgICAgICAgIC8vIE5ldyBhdHRlc3RhdGlvbiAtIG1heSBib29zdCBwcm9mZXNzaW9uYWxpc21cclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkVXBkYXRlT25DaGFpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBuZXdTY29yZXM6IGV2ZW50LmRhdGEubmV3U2NvcmVzLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzaG91bGRVcGRhdGVPbkNoYWluOiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=