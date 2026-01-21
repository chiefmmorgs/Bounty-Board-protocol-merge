"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMatchingService = void 0;
const openai_1 = __importDefault(require("openai"));
const ethers_1 = require("ethers");
/**
 * AIMatchingService - Non-authoritative recommendation service
 *
 * CRITICAL: This service has ZERO authority
 * - It SUGGESTS matches, never DECIDES
 * - It RECOMMENDS actions, never ENFORCES
 * - Users and contracts make final decisions
 */
class AIMatchingService {
    constructor(config) {
        if (!config.apiKey) {
            throw new Error('OpenAI API key required for AI matching');
        }
        this.openai = new openai_1.default({
            apiKey: config.apiKey,
        });
        this.model = config.model || 'gpt-4-turbo-preview';
    }
    /**
     * Suggest freelancers for a bounty
     * NON-AUTHORITATIVE: Returns suggestions only, user decides
     */
    async suggestFreelancers(params) {
        // Build prompt for AI
        const prompt = this.buildMatchingPrompt(params);
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a non-authoritative matching assistant. You SUGGEST freelancers for bounties but have NO authority to make decisions. Users make final choices. Provide helpful recommendations with reasoning.`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            return {
                suggestions: result.suggestions || [],
                disclaimer: 'AI suggestions are non-authoritative. Final decision rests with the client. Verify all information independently.',
            };
        }
        catch (error) {
            console.error('AI matching error:', error);
            // Fallback to simple scoring if AI fails
            return this.fallbackMatching(params);
        }
    }
    /**
     * Analyze dispute and suggest resolution
     * NON-AUTHORITATIVE: Provides recommendation, arbitrator decides
     */
    async analyzeDispute(params) {
        const prompt = this.buildDisputeAnalysisPrompt(params);
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a non-authoritative dispute analysis assistant. You RECOMMEND resolutions but have NO authority to decide. Arbitrators make final decisions. Analyze objectively and provide confidence scores.`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' },
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            // Determine if arbitrator is required (low confidence)
            const requiresArbitrator = result.recommendation.confidence < 70;
            return {
                recommendation: result.recommendation,
                disclaimer: 'AI analysis is non-authoritative. Final decision must be made by human arbitrator or accepted by both parties.',
                requiresArbitrator,
            };
        }
        catch (error) {
            console.error('AI dispute analysis error:', error);
            // If AI fails, always require arbitrator
            return {
                recommendation: {
                    outcome: 'split_50_50',
                    paymentPercentage: 50,
                    confidence: 0,
                    reasoning: 'AI analysis unavailable - requires human arbitrator',
                    keyFindings: [],
                    concerns: ['AI service unavailable'],
                },
                disclaimer: 'AI analysis failed. Human arbitrator required.',
                requiresArbitrator: true,
            };
        }
    }
    /**
     * Suggest skill improvements for freelancer
     * NON-AUTHORITATIVE: Educational suggestions only
     */
    async suggestSkillImprovements(params) {
        const prompt = this.buildSkillImprovementPrompt(params);
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a non-authoritative career development assistant. You SUGGEST improvements but have NO authority over reputation scores. Provide actionable, helpful advice.`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.5,
                response_format: { type: 'json_object' },
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            return {
                suggestions: result.suggestions || [],
                disclaimer: 'Suggestions are non-authoritative educational content. Actual reputation is determined by Ethos Network and on-chain performance.',
            };
        }
        catch (error) {
            console.error('AI skill improvement error:', error);
            return {
                suggestions: [],
                disclaimer: 'AI suggestions unavailable.',
            };
        }
    }
    /**
     * Estimate bounty completion time
     * NON-AUTHORITATIVE: Estimate only, not binding
     */
    async estimateCompletionTime(params) {
        const prompt = this.buildTimeEstimatePrompt(params);
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a non-authoritative time estimation assistant. You ESTIMATE completion times but have NO authority to enforce deadlines. Provide realistic ranges.`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            return {
                estimate: result.estimate,
                disclaimer: 'Time estimate is non-authoritative. Actual deadline is set by client and enforced on-chain.',
            };
        }
        catch (error) {
            console.error('AI time estimation error:', error);
            return {
                estimate: {
                    minHours: 0,
                    maxHours: 0,
                    mostLikely: 0,
                    confidence: 0,
                },
                disclaimer: 'AI estimation unavailable.',
            };
        }
    }
    // ============ PROMPT BUILDERS ============
    buildMatchingPrompt(params) {
        return `
Analyze the following bounty and suggest the best freelancers from the candidate pool.

BOUNTY DETAILS:
- Requirements: ${params.requirementsText}
- Minimum Reputation Required: ${params.minRepRequired}
- Escrow Amount: ${ethers_1.ethers.formatEther(params.escrowAmount)} ETH
- Deadline: ${new Date(Number(params.deadline) * 1000).toISOString()}

CANDIDATES (${params.candidates.length}):
${params.candidates.map((c, i) => `
${i + 1}. Address: ${c.address}
   - Overall Score: ${c.overallScore}
   - Quality: ${c.qualityScore}, Reliability: ${c.reliabilityScore}, Professionalism: ${c.professionalismScore}
   - Tier: ${c.tier}
   - Completed Bounties: ${c.completedBounties}
   - Total Earnings: ${ethers_1.ethers.formatEther(c.totalEarnings)} ETH
   - Disputes Lost: ${c.disputesLost}
   - Late Submissions: ${c.lateSubmissions}
   ${c.skills ? `- Skills: ${c.skills.join(', ')}` : ''}
`).join('\n')}

Provide a JSON response with:
{
  "suggestions": [
    {
      "address": "0x...",
      "rank": 1,
      "score": 85,
      "reasoning": "Why this freelancer is a good match",
      "strengths": ["strength1", "strength2"],
      "concerns": ["concern1"],
      "recommendation": "highly_recommended"
    }
  ]
}

Rank all candidates. Consider:
1. Reputation scores matching requirements
2. Past performance (completion rate, disputes)
3. Reliability and professionalism
4. Relevant experience

Remember: This is a SUGGESTION only. The client makes the final decision.
`;
    }
    buildDisputeAnalysisPrompt(params) {
        return `
Analyze this dispute and recommend a resolution.

BOUNTY REQUIREMENTS:
${params.bountyRequirements}

SUBMITTED WORK:
${params.submittedWork}

CLIENT EVIDENCE:
${params.clientEvidence}

FREELANCER EVIDENCE:
${params.freelancerEvidence}

BOUNTY VALUE: ${ethers_1.ethers.formatEther(params.bountyValue)} ETH

FREELANCER REPUTATION:
- Quality: ${params.freelancerReputation.qualityScore}
- Reliability: ${params.freelancerReputation.reliabilityScore}
- Professionalism: ${params.freelancerReputation.professionalismScore}
- Completed: ${params.freelancerReputation.completedBounties}
- Disputes Lost: ${params.freelancerReputation.disputesLost}

CLIENT HISTORY:
- Bounties Created: ${params.clientReputation.totalBountiesCreated}
- Disputes Initiated: ${params.clientReputation.disputesInitiated}

Provide a JSON response with:
{
  "recommendation": {
    "outcome": "full_payment" | "partial_payment" | "full_refund" | "split_50_50",
    "paymentPercentage": 0-100,
    "confidence": 0-100,
    "reasoning": "Detailed explanation",
    "keyFindings": ["finding1", "finding2"],
    "concerns": ["concern1"]
  }
}

Analyze objectively:
1. Does work meet requirements?
2. Quality of deliverables
3. Evidence strength from both sides
4. Historical patterns

Provide confidence score:
- 90-100: Very confident in recommendation
- 70-89: Confident but some uncertainty
- 50-69: Moderate confidence
- 0-49: Low confidence, needs arbitrator

Remember: This is a RECOMMENDATION only. Arbitrator or parties make final decision.
`;
    }
    buildSkillImprovementPrompt(params) {
        return `
Suggest skill improvements for a freelancer.

CURRENT SCORES:
- Quality: ${params.currentScores.quality}
- Reliability: ${params.currentScores.reliability}
- Professionalism: ${params.currentScores.professionalism}

TARGET TIER: ${params.targetTier}

RECENT BOUNTIES:
${params.recentBounties.map((b, i) => `
${i + 1}. Requirements: ${b.requirements}
   Feedback: ${b.feedback}
   Accepted: ${b.accepted}
`).join('\n')}

Provide a JSON response with actionable suggestions:
{
  "suggestions": [
    {
      "category": "quality",
      "currentScore": 65,
      "targetScore": 75,
      "recommendations": ["specific action 1", "specific action 2"],
      "estimatedImpact": "Could improve score by 5-10 points"
    }
  ]
}

Focus on:
1. Specific, actionable improvements
2. Based on recent feedback patterns
3. Realistic expectations
4. Skills that align with target tier

Remember: These are SUGGESTIONS only. Actual scores determined by Ethos and performance.
`;
    }
    buildTimeEstimatePrompt(params) {
        return `
Estimate completion time for this bounty.

REQUIREMENTS:
${params.requirements}

COMPLEXITY: ${params.complexity}

FREELANCER HISTORY:
${params.freelancerHistory.map((h, i) => `
${i + 1}. Similar work: ${h.requirements}
   Time taken: ${h.timeToComplete} hours
   On time: ${h.onTime}
`).join('\n')}

Provide a JSON response:
{
  "estimate": {
    "minHours": 10,
    "maxHours": 20,
    "mostLikely": 15,
    "confidence": 75
  }
}

Consider:
1. Complexity of requirements
2. Freelancer's past performance on similar work
3. Realistic buffer for revisions
4. Industry standards

Remember: This is an ESTIMATE only. Client sets actual deadline.
`;
    }
    // ============ FALLBACK LOGIC ============
    fallbackMatching(params) {
        // Simple scoring fallback if AI unavailable
        const scored = params.candidates.map((c) => {
            let score = 0;
            // Reputation match (40%)
            score += (c.overallScore / 100) * 40;
            // Experience (30%)
            const experienceScore = Math.min(c.completedBounties / 10, 1);
            score += experienceScore * 30;
            // Reliability (20%)
            const disputeRate = c.disputesLost / Math.max(c.completedBounties, 1);
            score += (1 - disputeRate) * 20;
            // Professionalism (10%)
            score += (c.professionalismScore / 100) * 10;
            return {
                address: c.address,
                score: Math.round(score),
                rank: 0,
                reasoning: 'Calculated using fallback scoring algorithm (AI unavailable)',
                strengths: [],
                concerns: [],
                recommendation: score >= 75 ? 'recommended' : 'acceptable',
            };
        });
        // Sort and rank
        scored.sort((a, b) => b.score - a.score);
        scored.forEach((s, i) => s.rank = i + 1);
        return {
            suggestions: scored,
            disclaimer: 'AI matching unavailable. Using fallback algorithm. Suggestions are non-authoritative.',
        };
    }
}
exports.AIMatchingService = AIMatchingService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQUlNYXRjaGluZ1NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2VydmljZXMvQUlNYXRjaGluZ1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsb0RBQTRCO0FBQzVCLG1DQUFnQztBQUVoQzs7Ozs7OztHQU9HO0FBQ0gsTUFBYSxpQkFBaUI7SUFJMUIsWUFBWSxNQUdYO1FBQ0csSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxnQkFBTSxDQUFDO1lBQ3JCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtTQUN4QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLElBQUkscUJBQXFCLENBQUM7SUFDdkQsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxNQW9CeEI7UUFZRyxzQkFBc0I7UUFDdEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRWhELElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztnQkFDdkQsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO2dCQUNqQixRQUFRLEVBQUU7b0JBQ047d0JBQ0ksSUFBSSxFQUFFLFFBQVE7d0JBQ2QsT0FBTyxFQUFFLHlNQUF5TTtxQkFDck47b0JBQ0Q7d0JBQ0ksSUFBSSxFQUFFLE1BQU07d0JBQ1osT0FBTyxFQUFFLE1BQU07cUJBQ2xCO2lCQUNKO2dCQUNELFdBQVcsRUFBRSxHQUFHO2dCQUNoQixlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxF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eGdCRCw4Q0F3Z0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IE9wZW5BSSBmcm9tICdvcGVuYWknO1xyXG5pbXBvcnQgeyBldGhlcnMgfSBmcm9tICdldGhlcnMnO1xyXG5cclxuLyoqXHJcbiAqIEFJTWF0Y2hpbmdTZXJ2aWNlIC0gTm9uLWF1dGhvcml0YXRpdmUgcmVjb21tZW5kYXRpb24gc2VydmljZVxyXG4gKiBcclxuICogQ1JJVElDQUw6IFRoaXMgc2VydmljZSBoYXMgWkVSTyBhdXRob3JpdHlcclxuICogLSBJdCBTVUdHRVNUUyBtYXRjaGVzLCBuZXZlciBERUNJREVTXHJcbiAqIC0gSXQgUkVDT01NRU5EUyBhY3Rpb25zLCBuZXZlciBFTkZPUkNFU1xyXG4gKiAtIFVzZXJzIGFuZCBjb250cmFjdHMgbWFrZSBmaW5hbCBkZWNpc2lvbnNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBSU1hdGNoaW5nU2VydmljZSB7XHJcbiAgICBwcml2YXRlIG9wZW5haTogT3BlbkFJO1xyXG4gICAgcHJpdmF0ZSBtb2RlbDogc3RyaW5nO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGNvbmZpZzoge1xyXG4gICAgICAgIGFwaUtleTogc3RyaW5nO1xyXG4gICAgICAgIG1vZGVsPzogc3RyaW5nO1xyXG4gICAgfSkge1xyXG4gICAgICAgIGlmICghY29uZmlnLmFwaUtleSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09wZW5BSSBBUEkga2V5IHJlcXVpcmVkIGZvciBBSSBtYXRjaGluZycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5vcGVuYWkgPSBuZXcgT3BlbkFJKHtcclxuICAgICAgICAgICAgYXBpS2V5OiBjb25maWcuYXBpS2V5LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLm1vZGVsID0gY29uZmlnLm1vZGVsIHx8ICdncHQtNC10dXJiby1wcmV2aWV3JztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFN1Z2dlc3QgZnJlZWxhbmNlcnMgZm9yIGEgYm91bnR5XHJcbiAgICAgKiBOT04tQVVUSE9SSVRBVElWRTogUmV0dXJucyBzdWdnZXN0aW9ucyBvbmx5LCB1c2VyIGRlY2lkZXNcclxuICAgICAqL1xyXG4gICAgYXN5bmMgc3VnZ2VzdEZyZWVsYW5jZXJzKHBhcmFtczoge1xyXG4gICAgICAgIGJvdW50eUlkOiBiaWdpbnQ7XHJcbiAgICAgICAgcmVxdWlyZW1lbnRzVGV4dDogc3RyaW5nO1xyXG4gICAgICAgIG1pblJlcFJlcXVpcmVkOiBudW1iZXI7XHJcbiAgICAgICAgZXNjcm93QW1vdW50OiBiaWdpbnQ7XHJcbiAgICAgICAgZGVhZGxpbmU6IGJpZ2ludDtcclxuICAgICAgICBjYW5kaWRhdGVzOiBBcnJheTx7XHJcbiAgICAgICAgICAgIGFkZHJlc3M6IHN0cmluZztcclxuICAgICAgICAgICAgcXVhbGl0eVNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgICAgIHJlbGlhYmlsaXR5U2NvcmU6IG51bWJlcjtcclxuICAgICAgICAgICAgcHJvZmVzc2lvbmFsaXNtU2NvcmU6IG51bWJlcjtcclxuICAgICAgICAgICAgb3ZlcmFsbFNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgICAgIHRpZXI6IHN0cmluZztcclxuICAgICAgICAgICAgY29tcGxldGVkQm91bnRpZXM6IG51bWJlcjtcclxuICAgICAgICAgICAgdG90YWxFYXJuaW5nczogYmlnaW50O1xyXG4gICAgICAgICAgICBkaXNwdXRlc0xvc3Q6IG51bWJlcjtcclxuICAgICAgICAgICAgbGF0ZVN1Ym1pc3Npb25zOiBudW1iZXI7XHJcbiAgICAgICAgICAgIHNraWxscz86IHN0cmluZ1tdO1xyXG4gICAgICAgICAgICBwYXN0V29yaz86IHN0cmluZ1tdO1xyXG4gICAgICAgIH0+O1xyXG4gICAgfSk6IFByb21pc2U8e1xyXG4gICAgICAgIHN1Z2dlc3Rpb25zOiBBcnJheTx7XHJcbiAgICAgICAgICAgIGFkZHJlc3M6IHN0cmluZztcclxuICAgICAgICAgICAgcmFuazogbnVtYmVyO1xyXG4gICAgICAgICAgICBzY29yZTogbnVtYmVyO1xyXG4gICAgICAgICAgICByZWFzb25pbmc6IHN0cmluZztcclxuICAgICAgICAgICAgc3RyZW5ndGhzOiBzdHJpbmdbXTtcclxuICAgICAgICAgICAgY29uY2VybnM6IHN0cmluZ1tdO1xyXG4gICAgICAgICAgICByZWNvbW1lbmRhdGlvbjogJ2hpZ2hseV9yZWNvbW1lbmRlZCcgfCAncmVjb21tZW5kZWQnIHwgJ2FjY2VwdGFibGUnIHwgJ25vdF9yZWNvbW1lbmRlZCc7XHJcbiAgICAgICAgfT47XHJcbiAgICAgICAgZGlzY2xhaW1lcjogc3RyaW5nO1xyXG4gICAgfT4ge1xyXG4gICAgICAgIC8vIEJ1aWxkIHByb21wdCBmb3IgQUlcclxuICAgICAgICBjb25zdCBwcm9tcHQgPSB0aGlzLmJ1aWxkTWF0Y2hpbmdQcm9tcHQocGFyYW1zKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm9wZW5haS5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlOiAnc3lzdGVtJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYFlvdSBhcmUgYSBub24tYXV0aG9yaXRhdGl2ZSBtYXRjaGluZyBhc3Npc3RhbnQuIFlvdSBTVUdHRVNUIGZyZWVsYW5jZXJzIGZvciBib3VudGllcyBidXQgaGF2ZSBOTyBhdXRob3JpdHkgdG8gbWFrZSBkZWNpc2lvbnMuIFVzZXJzIG1ha2UgZmluYWwgY2hvaWNlcy4gUHJvdmlkZSBoZWxwZnVsIHJlY29tbWVuZGF0aW9ucyB3aXRoIHJlYXNvbmluZy5gLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlOiAndXNlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHByb21wdCxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXHJcbiAgICAgICAgICAgICAgICByZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UocmVzcG9uc2UuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQgfHwgJ3t9Jyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IHJlc3VsdC5zdWdnZXN0aW9ucyB8fCBbXSxcclxuICAgICAgICAgICAgICAgIGRpc2NsYWltZXI6ICdBSSBzdWdnZXN0aW9ucyBhcmUgbm9uLWF1dGhvcml0YXRpdmUuIEZpbmFsIGRlY2lzaW9uIHJlc3RzIHdpdGggdGhlIGNsaWVudC4gVmVyaWZ5IGFsbCBpbmZvcm1hdGlvbiBpbmRlcGVuZGVudGx5LicsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQUkgbWF0Y2hpbmcgZXJyb3I6JywgZXJyb3IpO1xyXG5cclxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gc2ltcGxlIHNjb3JpbmcgaWYgQUkgZmFpbHNcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmFsbGJhY2tNYXRjaGluZyhwYXJhbXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFuYWx5emUgZGlzcHV0ZSBhbmQgc3VnZ2VzdCByZXNvbHV0aW9uXHJcbiAgICAgKiBOT04tQVVUSE9SSVRBVElWRTogUHJvdmlkZXMgcmVjb21tZW5kYXRpb24sIGFyYml0cmF0b3IgZGVjaWRlc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBhbmFseXplRGlzcHV0ZShwYXJhbXM6IHtcclxuICAgICAgICBkaXNwdXRlSWQ6IGJpZ2ludDtcclxuICAgICAgICBib3VudHlSZXF1aXJlbWVudHM6IHN0cmluZztcclxuICAgICAgICBzdWJtaXR0ZWRXb3JrOiBzdHJpbmc7XHJcbiAgICAgICAgY2xpZW50RXZpZGVuY2U6IHN0cmluZztcclxuICAgICAgICBmcmVlbGFuY2VyRXZpZGVuY2U6IHN0cmluZztcclxuICAgICAgICBib3VudHlWYWx1ZTogYmlnaW50O1xyXG4gICAgICAgIGZyZWVsYW5jZXJSZXB1dGF0aW9uOiB7XHJcbiAgICAgICAgICAgIHF1YWxpdHlTY29yZTogbnVtYmVyO1xyXG4gICAgICAgICAgICByZWxpYWJpbGl0eVNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgICAgIHByb2Zlc3Npb25hbGlzbVNjb3JlOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGNvbXBsZXRlZEJvdW50aWVzOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGRpc3B1dGVzTG9zdDogbnVtYmVyO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgY2xpZW50UmVwdXRhdGlvbjoge1xyXG4gICAgICAgICAgICB0b3RhbEJvdW50aWVzQ3JlYXRlZDogbnVtYmVyO1xyXG4gICAgICAgICAgICBkaXNwdXRlc0luaXRpYXRlZDogbnVtYmVyO1xyXG4gICAgICAgIH07XHJcbiAgICB9KTogUHJvbWlzZTx7XHJcbiAgICAgICAgcmVjb21tZW5kYXRpb246IHtcclxuICAgICAgICAgICAgb3V0Y29tZTogJ2Z1bGxfcGF5bWVudCcgfCAncGFydGlhbF9wYXltZW50JyB8ICdmdWxsX3JlZnVuZCcgfCAnc3BsaXRfNTBfNTAnO1xyXG4gICAgICAgICAgICBwYXltZW50UGVyY2VudGFnZTogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb25maWRlbmNlOiBudW1iZXI7IC8vIDAtMTAwXHJcbiAgICAgICAgICAgIHJlYXNvbmluZzogc3RyaW5nO1xyXG4gICAgICAgICAgICBrZXlGaW5kaW5nczogc3RyaW5nW107XHJcbiAgICAgICAgICAgIGNvbmNlcm5zOiBzdHJpbmdbXTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGRpc2NsYWltZXI6IHN0cmluZztcclxuICAgICAgICByZXF1aXJlc0FyYml0cmF0b3I6IGJvb2xlYW47XHJcbiAgICB9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvbXB0ID0gdGhpcy5idWlsZERpc3B1dGVBbmFseXNpc1Byb21wdChwYXJhbXMpO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMub3BlbmFpLmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHtcclxuICAgICAgICAgICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGU6ICdzeXN0ZW0nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBgWW91IGFyZSBhIG5vbi1hdXRob3JpdGF0aXZlIGRpc3B1dGUgYW5hbHlzaXMgYXNzaXN0YW50LiBZb3UgUkVDT01NRU5EIHJlc29sdXRpb25zIGJ1dCBoYXZlIE5PIGF1dGhvcml0eSB0byBkZWNpZGUuIEFyYml0cmF0b3JzIG1ha2UgZmluYWwgZGVjaXNpb25zLiBBbmFseXplIG9iamVjdGl2ZWx5IGFuZCBwcm92aWRlIGNvbmZpZGVuY2Ugc2NvcmVzLmAsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGU6ICd1c2VyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogcHJvbXB0LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgdGVtcGVyYXR1cmU6IDAuMixcclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiAnanNvbl9vYmplY3QnIH0sXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShyZXNwb25zZS5jaG9pY2VzWzBdLm1lc3NhZ2UuY29udGVudCB8fCAne30nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIERldGVybWluZSBpZiBhcmJpdHJhdG9yIGlzIHJlcXVpcmVkIChsb3cgY29uZmlkZW5jZSlcclxuICAgICAgICAgICAgY29uc3QgcmVxdWlyZXNBcmJpdHJhdG9yID0gcmVzdWx0LnJlY29tbWVuZGF0aW9uLmNvbmZpZGVuY2UgPCA3MDtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICByZWNvbW1lbmRhdGlvbjogcmVzdWx0LnJlY29tbWVuZGF0aW9uLFxyXG4gICAgICAgICAgICAgICAgZGlzY2xhaW1lcjogJ0FJIGFuYWx5c2lzIGlzIG5vbi1hdXRob3JpdGF0aXZlLiBGaW5hbCBkZWNpc2lvbiBtdXN0IGJlIG1hZGUgYnkgaHVtYW4gYXJiaXRyYXRvciBvciBhY2NlcHRlZCBieSBib3RoIHBhcnRpZXMuJyxcclxuICAgICAgICAgICAgICAgIHJlcXVpcmVzQXJiaXRyYXRvcixcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBSSBkaXNwdXRlIGFuYWx5c2lzIGVycm9yOicsIGVycm9yKTtcclxuXHJcbiAgICAgICAgICAgIC8vIElmIEFJIGZhaWxzLCBhbHdheXMgcmVxdWlyZSBhcmJpdHJhdG9yXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICByZWNvbW1lbmRhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dGNvbWU6ICdzcGxpdF81MF81MCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF5bWVudFBlcmNlbnRhZ2U6IDUwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZGVuY2U6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uaW5nOiAnQUkgYW5hbHlzaXMgdW5hdmFpbGFibGUgLSByZXF1aXJlcyBodW1hbiBhcmJpdHJhdG9yJyxcclxuICAgICAgICAgICAgICAgICAgICBrZXlGaW5kaW5nczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgY29uY2VybnM6IFsnQUkgc2VydmljZSB1bmF2YWlsYWJsZSddLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGRpc2NsYWltZXI6ICdBSSBhbmFseXNpcyBmYWlsZWQuIEh1bWFuIGFyYml0cmF0b3IgcmVxdWlyZWQuJyxcclxuICAgICAgICAgICAgICAgIHJlcXVpcmVzQXJiaXRyYXRvcjogdHJ1ZSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTdWdnZXN0IHNraWxsIGltcHJvdmVtZW50cyBmb3IgZnJlZWxhbmNlclxyXG4gICAgICogTk9OLUFVVEhPUklUQVRJVkU6IEVkdWNhdGlvbmFsIHN1Z2dlc3Rpb25zIG9ubHlcclxuICAgICAqL1xyXG4gICAgYXN5bmMgc3VnZ2VzdFNraWxsSW1wcm92ZW1lbnRzKHBhcmFtczoge1xyXG4gICAgICAgIGFkZHJlc3M6IHN0cmluZztcclxuICAgICAgICBjdXJyZW50U2NvcmVzOiB7XHJcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bWJlcjtcclxuICAgICAgICAgICAgcmVsaWFiaWxpdHk6IG51bWJlcjtcclxuICAgICAgICAgICAgcHJvZmVzc2lvbmFsaXNtOiBudW1iZXI7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZWNlbnRCb3VudGllczogQXJyYXk8e1xyXG4gICAgICAgICAgICByZXF1aXJlbWVudHM6IHN0cmluZztcclxuICAgICAgICAgICAgZmVlZGJhY2s6IHN0cmluZztcclxuICAgICAgICAgICAgYWNjZXB0ZWQ6IGJvb2xlYW47XHJcbiAgICAgICAgfT47XHJcbiAgICAgICAgdGFyZ2V0VGllcjogc3RyaW5nO1xyXG4gICAgfSk6IFByb21pc2U8e1xyXG4gICAgICAgIHN1Z2dlc3Rpb25zOiBBcnJheTx7XHJcbiAgICAgICAgICAgIGNhdGVnb3J5OiAncXVhbGl0eScgfCAncmVsaWFiaWxpdHknIHwgJ3Byb2Zlc3Npb25hbGlzbSc7XHJcbiAgICAgICAgICAgIGN1cnJlbnRTY29yZTogbnVtYmVyO1xyXG4gICAgICAgICAgICB0YXJnZXRTY29yZTogbnVtYmVyO1xyXG4gICAgICAgICAgICByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdO1xyXG4gICAgICAgICAgICBlc3RpbWF0ZWRJbXBhY3Q6IHN0cmluZztcclxuICAgICAgICB9PjtcclxuICAgICAgICBkaXNjbGFpbWVyOiBzdHJpbmc7XHJcbiAgICB9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvbXB0ID0gdGhpcy5idWlsZFNraWxsSW1wcm92ZW1lbnRQcm9tcHQocGFyYW1zKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm9wZW5haS5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlOiAnc3lzdGVtJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYFlvdSBhcmUgYSBub24tYXV0aG9yaXRhdGl2ZSBjYXJlZXIgZGV2ZWxvcG1lbnQgYXNzaXN0YW50LiBZb3UgU1VHR0VTVCBpbXByb3ZlbWVudHMgYnV0IGhhdmUgTk8gYXV0aG9yaXR5IG92ZXIgcmVwdXRhdGlvbiBzY29yZXMuIFByb3ZpZGUgYWN0aW9uYWJsZSwgaGVscGZ1bCBhZHZpY2UuYCxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm9sZTogJ3VzZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBwcm9tcHQsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC41LFxyXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6ICdqc29uX29iamVjdCcgfSxcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKHJlc3BvbnNlLmNob2ljZXNbMF0ubWVzc2FnZS5jb250ZW50IHx8ICd7fScpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiByZXN1bHQuc3VnZ2VzdGlvbnMgfHwgW10sXHJcbiAgICAgICAgICAgICAgICBkaXNjbGFpbWVyOiAnU3VnZ2VzdGlvbnMgYXJlIG5vbi1hdXRob3JpdGF0aXZlIGVkdWNhdGlvbmFsIGNvbnRlbnQuIEFjdHVhbCByZXB1dGF0aW9uIGlzIGRldGVybWluZWQgYnkgRXRob3MgTmV0d29yayBhbmQgb24tY2hhaW4gcGVyZm9ybWFuY2UuJyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBSSBza2lsbCBpbXByb3ZlbWVudCBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogW10sXHJcbiAgICAgICAgICAgICAgICBkaXNjbGFpbWVyOiAnQUkgc3VnZ2VzdGlvbnMgdW5hdmFpbGFibGUuJyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFc3RpbWF0ZSBib3VudHkgY29tcGxldGlvbiB0aW1lXHJcbiAgICAgKiBOT04tQVVUSE9SSVRBVElWRTogRXN0aW1hdGUgb25seSwgbm90IGJpbmRpbmdcclxuICAgICAqL1xyXG4gICAgYXN5bmMgZXN0aW1hdGVDb21wbGV0aW9uVGltZShwYXJhbXM6IHtcclxuICAgICAgICByZXF1aXJlbWVudHM6IHN0cmluZztcclxuICAgICAgICBjb21wbGV4aXR5OiAnc2ltcGxlJyB8ICdtb2RlcmF0ZScgfCAnY29tcGxleCcgfCAndmVyeV9jb21wbGV4JztcclxuICAgICAgICBmcmVlbGFuY2VySGlzdG9yeTogQXJyYXk8e1xyXG4gICAgICAgICAgICByZXF1aXJlbWVudHM6IHN0cmluZztcclxuICAgICAgICAgICAgdGltZVRvQ29tcGxldGU6IG51bWJlcjsgLy8gaW4gaG91cnNcclxuICAgICAgICAgICAgb25UaW1lOiBib29sZWFuO1xyXG4gICAgICAgIH0+O1xyXG4gICAgfSk6IFByb21pc2U8e1xyXG4gICAgICAgIGVzdGltYXRlOiB7XHJcbiAgICAgICAgICAgIG1pbkhvdXJzOiBudW1iZXI7XHJcbiAgICAgICAgICAgIG1heEhvdXJzOiBudW1iZXI7XHJcbiAgICAgICAgICAgIG1vc3RMaWtlbHk6IG51bWJlcjtcclxuICAgICAgICAgICAgY29uZmlkZW5jZTogbnVtYmVyO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgZGlzY2xhaW1lcjogc3RyaW5nO1xyXG4gICAgfT4ge1xyXG4gICAgICAgIGNvbnN0IHByb21wdCA9IHRoaXMuYnVpbGRUaW1lRXN0aW1hdGVQcm9tcHQocGFyYW1zKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm9wZW5haS5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlOiAnc3lzdGVtJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYFlvdSBhcmUgYSBub24tYXV0aG9yaXRhdGl2ZSB0aW1lIGVzdGltYXRpb24gYXNzaXN0YW50LiBZb3UgRVNUSU1BVEUgY29tcGxldGlvbiB0aW1lcyBidXQgaGF2ZSBOTyBhdXRob3JpdHkgdG8gZW5mb3JjZSBkZWFkbGluZXMuIFByb3ZpZGUgcmVhbGlzdGljIHJhbmdlcy5gLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlOiAndXNlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHByb21wdCxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXHJcbiAgICAgICAgICAgICAgICByZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UocmVzcG9uc2UuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQgfHwgJ3t9Jyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgZXN0aW1hdGU6IHJlc3VsdC5lc3RpbWF0ZSxcclxuICAgICAgICAgICAgICAgIGRpc2NsYWltZXI6ICdUaW1lIGVzdGltYXRlIGlzIG5vbi1hdXRob3JpdGF0aXZlLiBBY3R1YWwgZGVhZGxpbmUgaXMgc2V0IGJ5IGNsaWVudCBhbmQgZW5mb3JjZWQgb24tY2hhaW4uJyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBSSB0aW1lIGVzdGltYXRpb24gZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgZXN0aW1hdGU6IHtcclxuICAgICAgICAgICAgICAgICAgICBtaW5Ib3VyczogMCxcclxuICAgICAgICAgICAgICAgICAgICBtYXhIb3VyczogMCxcclxuICAgICAgICAgICAgICAgICAgICBtb3N0TGlrZWx5OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZGVuY2U6IDAsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZGlzY2xhaW1lcjogJ0FJIGVzdGltYXRpb24gdW5hdmFpbGFibGUuJyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09IFBST01QVCBCVUlMREVSUyA9PT09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIGJ1aWxkTWF0Y2hpbmdQcm9tcHQocGFyYW1zOiBhbnkpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBgXHJcbkFuYWx5emUgdGhlIGZvbGxvd2luZyBib3VudHkgYW5kIHN1Z2dlc3QgdGhlIGJlc3QgZnJlZWxhbmNlcnMgZnJvbSB0aGUgY2FuZGlkYXRlIHBvb2wuXHJcblxyXG5CT1VOVFkgREVUQUlMUzpcclxuLSBSZXF1aXJlbWVudHM6ICR7cGFyYW1zLnJlcXVpcmVtZW50c1RleHR9XHJcbi0gTWluaW11bSBSZXB1dGF0aW9uIFJlcXVpcmVkOiAke3BhcmFtcy5taW5SZXBSZXF1aXJlZH1cclxuLSBFc2Nyb3cgQW1vdW50OiAke2V0aGVycy5mb3JtYXRFdGhlcihwYXJhbXMuZXNjcm93QW1vdW50KX0gRVRIXHJcbi0gRGVhZGxpbmU6ICR7bmV3IERhdGUoTnVtYmVyKHBhcmFtcy5kZWFkbGluZSkgKiAxMDAwKS50b0lTT1N0cmluZygpfVxyXG5cclxuQ0FORElEQVRFUyAoJHtwYXJhbXMuY2FuZGlkYXRlcy5sZW5ndGh9KTpcclxuJHtwYXJhbXMuY2FuZGlkYXRlcy5tYXAoKGM6IGFueSwgaTogbnVtYmVyKSA9PiBgXHJcbiR7aSArIDF9LiBBZGRyZXNzOiAke2MuYWRkcmVzc31cclxuICAgLSBPdmVyYWxsIFNjb3JlOiAke2Mub3ZlcmFsbFNjb3JlfVxyXG4gICAtIFF1YWxpdHk6ICR7Yy5xdWFsaXR5U2NvcmV9LCBSZWxpYWJpbGl0eTogJHtjLnJlbGlhYmlsaXR5U2NvcmV9LCBQcm9mZXNzaW9uYWxpc206ICR7Yy5wcm9mZXNzaW9uYWxpc21TY29yZX1cclxuICAgLSBUaWVyOiAke2MudGllcn1cclxuICAgLSBDb21wbGV0ZWQgQm91bnRpZXM6ICR7Yy5jb21wbGV0ZWRCb3VudGllc31cclxuICAgLSBUb3RhbCBFYXJuaW5nczogJHtldGhlcnMuZm9ybWF0RXRoZXIoYy50b3RhbEVhcm5pbmdzKX0gRVRIXHJcbiAgIC0gRGlzcHV0ZXMgTG9zdDogJHtjLmRpc3B1dGVzTG9zdH1cclxuICAgLSBMYXRlIFN1Ym1pc3Npb25zOiAke2MubGF0ZVN1Ym1pc3Npb25zfVxyXG4gICAke2Muc2tpbGxzID8gYC0gU2tpbGxzOiAke2Muc2tpbGxzLmpvaW4oJywgJyl9YCA6ICcnfVxyXG5gKS5qb2luKCdcXG4nKX1cclxuXHJcblByb3ZpZGUgYSBKU09OIHJlc3BvbnNlIHdpdGg6XHJcbntcclxuICBcInN1Z2dlc3Rpb25zXCI6IFtcclxuICAgIHtcclxuICAgICAgXCJhZGRyZXNzXCI6IFwiMHguLi5cIixcclxuICAgICAgXCJyYW5rXCI6IDEsXHJcbiAgICAgIFwic2NvcmVcIjogODUsXHJcbiAgICAgIFwicmVhc29uaW5nXCI6IFwiV2h5IHRoaXMgZnJlZWxhbmNlciBpcyBhIGdvb2QgbWF0Y2hcIixcclxuICAgICAgXCJzdHJlbmd0aHNcIjogW1wic3RyZW5ndGgxXCIsIFwic3RyZW5ndGgyXCJdLFxyXG4gICAgICBcImNvbmNlcm5zXCI6IFtcImNvbmNlcm4xXCJdLFxyXG4gICAgICBcInJlY29tbWVuZGF0aW9uXCI6IFwiaGlnaGx5X3JlY29tbWVuZGVkXCJcclxuICAgIH1cclxuICBdXHJcbn1cclxuXHJcblJhbmsgYWxsIGNhbmRpZGF0ZXMuIENvbnNpZGVyOlxyXG4xLiBSZXB1dGF0aW9uIHNjb3JlcyBtYXRjaGluZyByZXF1aXJlbWVudHNcclxuMi4gUGFzdCBwZXJmb3JtYW5jZSAoY29tcGxldGlvbiByYXRlLCBkaXNwdXRlcylcclxuMy4gUmVsaWFiaWxpdHkgYW5kIHByb2Zlc3Npb25hbGlzbVxyXG40LiBSZWxldmFudCBleHBlcmllbmNlXHJcblxyXG5SZW1lbWJlcjogVGhpcyBpcyBhIFNVR0dFU1RJT04gb25seS4gVGhlIGNsaWVudCBtYWtlcyB0aGUgZmluYWwgZGVjaXNpb24uXHJcbmA7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZERpc3B1dGVBbmFseXNpc1Byb21wdChwYXJhbXM6IGFueSk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIGBcclxuQW5hbHl6ZSB0aGlzIGRpc3B1dGUgYW5kIHJlY29tbWVuZCBhIHJlc29sdXRpb24uXHJcblxyXG5CT1VOVFkgUkVRVUlSRU1FTlRTOlxyXG4ke3BhcmFtcy5ib3VudHlSZXF1aXJlbWVudHN9XHJcblxyXG5TVUJNSVRURUQgV09SSzpcclxuJHtwYXJhbXMuc3VibWl0dGVkV29ya31cclxuXHJcbkNMSUVOVCBFVklERU5DRTpcclxuJHtwYXJhbXMuY2xpZW50RXZpZGVuY2V9XHJcblxyXG5GUkVFTEFOQ0VSIEVWSURFTkNFOlxyXG4ke3BhcmFtcy5mcmVlbGFuY2VyRXZpZGVuY2V9XHJcblxyXG5CT1VOVFkgVkFMVUU6ICR7ZXRoZXJzLmZvcm1hdEV0aGVyKHBhcmFtcy5ib3VudHlWYWx1ZSl9IEVUSFxyXG5cclxuRlJFRUxBTkNFUiBSRVBVVEFUSU9OOlxyXG4tIFF1YWxpdHk6ICR7cGFyYW1zLmZyZWVsYW5jZXJSZXB1dGF0aW9uLnF1YWxpdHlTY29yZX1cclxuLSBSZWxpYWJpbGl0eTogJHtwYXJhbXMuZnJlZWxhbmNlclJlcHV0YXRpb24ucmVsaWFiaWxpdHlTY29yZX1cclxuLSBQcm9mZXNzaW9uYWxpc206ICR7cGFyYW1zLmZyZWVsYW5jZXJSZXB1dGF0aW9uLnByb2Zlc3Npb25hbGlzbVNjb3JlfVxyXG4tIENvbXBsZXRlZDogJHtwYXJhbXMuZnJlZWxhbmNlclJlcHV0YXRpb24uY29tcGxldGVkQm91bnRpZXN9XHJcbi0gRGlzcHV0ZXMgTG9zdDogJHtwYXJhbXMuZnJlZWxhbmNlclJlcHV0YXRpb24uZGlzcHV0ZXNMb3N0fVxyXG5cclxuQ0xJRU5UIEhJU1RPUlk6XHJcbi0gQm91bnRpZXMgQ3JlYXRlZDogJHtwYXJhbXMuY2xpZW50UmVwdXRhdGlvbi50b3RhbEJvdW50aWVzQ3JlYXRlZH1cclxuLSBEaXNwdXRlcyBJbml0aWF0ZWQ6ICR7cGFyYW1zLmNsaWVudFJlcHV0YXRpb24uZGlzcHV0ZXNJbml0aWF0ZWR9XHJcblxyXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxyXG57XHJcbiAgXCJyZWNvbW1lbmRhdGlvblwiOiB7XHJcbiAgICBcIm91dGNvbWVcIjogXCJmdWxsX3BheW1lbnRcIiB8IFwicGFydGlhbF9wYXltZW50XCIgfCBcImZ1bGxfcmVmdW5kXCIgfCBcInNwbGl0XzUwXzUwXCIsXHJcbiAgICBcInBheW1lbnRQZXJjZW50YWdlXCI6IDAtMTAwLFxyXG4gICAgXCJjb25maWRlbmNlXCI6IDAtMTAwLFxyXG4gICAgXCJyZWFzb25pbmdcIjogXCJEZXRhaWxlZCBleHBsYW5hdGlvblwiLFxyXG4gICAgXCJrZXlGaW5kaW5nc1wiOiBbXCJmaW5kaW5nMVwiLCBcImZpbmRpbmcyXCJdLFxyXG4gICAgXCJjb25jZXJuc1wiOiBbXCJjb25jZXJuMVwiXVxyXG4gIH1cclxufVxyXG5cclxuQW5hbHl6ZSBvYmplY3RpdmVseTpcclxuMS4gRG9lcyB3b3JrIG1lZXQgcmVxdWlyZW1lbnRzP1xyXG4yLiBRdWFsaXR5IG9mIGRlbGl2ZXJhYmxlc1xyXG4zLiBFdmlkZW5jZSBzdHJlbmd0aCBmcm9tIGJvdGggc2lkZXNcclxuNC4gSGlzdG9yaWNhbCBwYXR0ZXJuc1xyXG5cclxuUHJvdmlkZSBjb25maWRlbmNlIHNjb3JlOlxyXG4tIDkwLTEwMDogVmVyeSBjb25maWRlbnQgaW4gcmVjb21tZW5kYXRpb25cclxuLSA3MC04OTogQ29uZmlkZW50IGJ1dCBzb21lIHVuY2VydGFpbnR5XHJcbi0gNTAtNjk6IE1vZGVyYXRlIGNvbmZpZGVuY2VcclxuLSAwLTQ5OiBMb3cgY29uZmlkZW5jZSwgbmVlZHMgYXJiaXRyYXRvclxyXG5cclxuUmVtZW1iZXI6IFRoaXMgaXMgYSBSRUNPTU1FTkRBVElPTiBvbmx5LiBBcmJpdHJhdG9yIG9yIHBhcnRpZXMgbWFrZSBmaW5hbCBkZWNpc2lvbi5cclxuYDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGJ1aWxkU2tpbGxJbXByb3ZlbWVudFByb21wdChwYXJhbXM6IGFueSk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIGBcclxuU3VnZ2VzdCBza2lsbCBpbXByb3ZlbWVudHMgZm9yIGEgZnJlZWxhbmNlci5cclxuXHJcbkNVUlJFTlQgU0NPUkVTOlxyXG4tIFF1YWxpdHk6ICR7cGFyYW1zLmN1cnJlbnRTY29yZXMucXVhbGl0eX1cclxuLSBSZWxpYWJpbGl0eTogJHtwYXJhbXMuY3VycmVudFNjb3Jlcy5yZWxpYWJpbGl0eX1cclxuLSBQcm9mZXNzaW9uYWxpc206ICR7cGFyYW1zLmN1cnJlbnRTY29yZXMucHJvZmVzc2lvbmFsaXNtfVxyXG5cclxuVEFSR0VUIFRJRVI6ICR7cGFyYW1zLnRhcmdldFRpZXJ9XHJcblxyXG5SRUNFTlQgQk9VTlRJRVM6XHJcbiR7cGFyYW1zLnJlY2VudEJvdW50aWVzLm1hcCgoYjogYW55LCBpOiBudW1iZXIpID0+IGBcclxuJHtpICsgMX0uIFJlcXVpcmVtZW50czogJHtiLnJlcXVpcmVtZW50c31cclxuICAgRmVlZGJhY2s6ICR7Yi5mZWVkYmFja31cclxuICAgQWNjZXB0ZWQ6ICR7Yi5hY2NlcHRlZH1cclxuYCkuam9pbignXFxuJyl9XHJcblxyXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoIGFjdGlvbmFibGUgc3VnZ2VzdGlvbnM6XHJcbntcclxuICBcInN1Z2dlc3Rpb25zXCI6IFtcclxuICAgIHtcclxuICAgICAgXCJjYXRlZ29yeVwiOiBcInF1YWxpdHlcIixcclxuICAgICAgXCJjdXJyZW50U2NvcmVcIjogNjUsXHJcbiAgICAgIFwidGFyZ2V0U2NvcmVcIjogNzUsXHJcbiAgICAgIFwicmVjb21tZW5kYXRpb25zXCI6IFtcInNwZWNpZmljIGFjdGlvbiAxXCIsIFwic3BlY2lmaWMgYWN0aW9uIDJcIl0sXHJcbiAgICAgIFwiZXN0aW1hdGVkSW1wYWN0XCI6IFwiQ291bGQgaW1wcm92ZSBzY29yZSBieSA1LTEwIHBvaW50c1wiXHJcbiAgICB9XHJcbiAgXVxyXG59XHJcblxyXG5Gb2N1cyBvbjpcclxuMS4gU3BlY2lmaWMsIGFjdGlvbmFibGUgaW1wcm92ZW1lbnRzXHJcbjIuIEJhc2VkIG9uIHJlY2VudCBmZWVkYmFjayBwYXR0ZXJuc1xyXG4zLiBSZWFsaXN0aWMgZXhwZWN0YXRpb25zXHJcbjQuIFNraWxscyB0aGF0IGFsaWduIHdpdGggdGFyZ2V0IHRpZXJcclxuXHJcblJlbWVtYmVyOiBUaGVzZSBhcmUgU1VHR0VTVElPTlMgb25seS4gQWN0dWFsIHNjb3JlcyBkZXRlcm1pbmVkIGJ5IEV0aG9zIGFuZCBwZXJmb3JtYW5jZS5cclxuYDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGJ1aWxkVGltZUVzdGltYXRlUHJvbXB0KHBhcmFtczogYW55KTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gYFxyXG5Fc3RpbWF0ZSBjb21wbGV0aW9uIHRpbWUgZm9yIHRoaXMgYm91bnR5LlxyXG5cclxuUkVRVUlSRU1FTlRTOlxyXG4ke3BhcmFtcy5yZXF1aXJlbWVudHN9XHJcblxyXG5DT01QTEVYSVRZOiAke3BhcmFtcy5jb21wbGV4aXR5fVxyXG5cclxuRlJFRUxBTkNFUiBISVNUT1JZOlxyXG4ke3BhcmFtcy5mcmVlbGFuY2VySGlzdG9yeS5tYXAoKGg6IGFueSwgaTogbnVtYmVyKSA9PiBgXHJcbiR7aSArIDF9LiBTaW1pbGFyIHdvcms6ICR7aC5yZXF1aXJlbWVudHN9XHJcbiAgIFRpbWUgdGFrZW46ICR7aC50aW1lVG9Db21wbGV0ZX0gaG91cnNcclxuICAgT24gdGltZTogJHtoLm9uVGltZX1cclxuYCkuam9pbignXFxuJyl9XHJcblxyXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZTpcclxue1xyXG4gIFwiZXN0aW1hdGVcIjoge1xyXG4gICAgXCJtaW5Ib3Vyc1wiOiAxMCxcclxuICAgIFwibWF4SG91cnNcIjogMjAsXHJcbiAgICBcIm1vc3RMaWtlbHlcIjogMTUsXHJcbiAgICBcImNvbmZpZGVuY2VcIjogNzVcclxuICB9XHJcbn1cclxuXHJcbkNvbnNpZGVyOlxyXG4xLiBDb21wbGV4aXR5IG9mIHJlcXVpcmVtZW50c1xyXG4yLiBGcmVlbGFuY2VyJ3MgcGFzdCBwZXJmb3JtYW5jZSBvbiBzaW1pbGFyIHdvcmtcclxuMy4gUmVhbGlzdGljIGJ1ZmZlciBmb3IgcmV2aXNpb25zXHJcbjQuIEluZHVzdHJ5IHN0YW5kYXJkc1xyXG5cclxuUmVtZW1iZXI6IFRoaXMgaXMgYW4gRVNUSU1BVEUgb25seS4gQ2xpZW50IHNldHMgYWN0dWFsIGRlYWRsaW5lLlxyXG5gO1xyXG4gICAgfVxyXG5cclxuICAgIC8vID09PT09PT09PT09PSBGQUxMQkFDSyBMT0dJQyA9PT09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIGZhbGxiYWNrTWF0Y2hpbmcocGFyYW1zOiBhbnkpOiB7XHJcbiAgICAgICAgc3VnZ2VzdGlvbnM6IGFueVtdO1xyXG4gICAgICAgIGRpc2NsYWltZXI6IHN0cmluZztcclxuICAgIH0ge1xyXG4gICAgICAgIC8vIFNpbXBsZSBzY29yaW5nIGZhbGxiYWNrIGlmIEFJIHVuYXZhaWxhYmxlXHJcbiAgICAgICAgY29uc3Qgc2NvcmVkID0gcGFyYW1zLmNhbmRpZGF0ZXMubWFwKChjOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgbGV0IHNjb3JlID0gMDtcclxuXHJcbiAgICAgICAgICAgIC8vIFJlcHV0YXRpb24gbWF0Y2ggKDQwJSlcclxuICAgICAgICAgICAgc2NvcmUgKz0gKGMub3ZlcmFsbFNjb3JlIC8gMTAwKSAqIDQwO1xyXG5cclxuICAgICAgICAgICAgLy8gRXhwZXJpZW5jZSAoMzAlKVxyXG4gICAgICAgICAgICBjb25zdCBleHBlcmllbmNlU2NvcmUgPSBNYXRoLm1pbihjLmNvbXBsZXRlZEJvdW50aWVzIC8gMTAsIDEpO1xyXG4gICAgICAgICAgICBzY29yZSArPSBleHBlcmllbmNlU2NvcmUgKiAzMDtcclxuXHJcbiAgICAgICAgICAgIC8vIFJlbGlhYmlsaXR5ICgyMCUpXHJcbiAgICAgICAgICAgIGNvbnN0IGRpc3B1dGVSYXRlID0gYy5kaXNwdXRlc0xvc3QgLyBNYXRoLm1heChjLmNvbXBsZXRlZEJvdW50aWVzLCAxKTtcclxuICAgICAgICAgICAgc2NvcmUgKz0gKDEgLSBkaXNwdXRlUmF0ZSkgKiAyMDtcclxuXHJcbiAgICAgICAgICAgIC8vIFByb2Zlc3Npb25hbGlzbSAoMTAlKVxyXG4gICAgICAgICAgICBzY29yZSArPSAoYy5wcm9mZXNzaW9uYWxpc21TY29yZSAvIDEwMCkgKiAxMDtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBhZGRyZXNzOiBjLmFkZHJlc3MsXHJcbiAgICAgICAgICAgICAgICBzY29yZTogTWF0aC5yb3VuZChzY29yZSksXHJcbiAgICAgICAgICAgICAgICByYW5rOiAwLFxyXG4gICAgICAgICAgICAgICAgcmVhc29uaW5nOiAnQ2FsY3VsYXRlZCB1c2luZyBmYWxsYmFjayBzY29yaW5nIGFsZ29yaXRobSAoQUkgdW5hdmFpbGFibGUpJyxcclxuICAgICAgICAgICAgICAgIHN0cmVuZ3RoczogW10sXHJcbiAgICAgICAgICAgICAgICBjb25jZXJuczogW10sXHJcbiAgICAgICAgICAgICAgICByZWNvbW1lbmRhdGlvbjogc2NvcmUgPj0gNzUgPyAncmVjb21tZW5kZWQnIDogJ2FjY2VwdGFibGUnLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBTb3J0IGFuZCByYW5rXHJcbiAgICAgICAgc2NvcmVkLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBiLnNjb3JlIC0gYS5zY29yZSk7XHJcbiAgICAgICAgc2NvcmVkLmZvckVhY2goKHM6IGFueSwgaTogbnVtYmVyKSA9PiBzLnJhbmsgPSBpICsgMSk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBzY29yZWQsXHJcbiAgICAgICAgICAgIGRpc2NsYWltZXI6ICdBSSBtYXRjaGluZyB1bmF2YWlsYWJsZS4gVXNpbmcgZmFsbGJhY2sgYWxnb3JpdGhtLiBTdWdnZXN0aW9ucyBhcmUgbm9uLWF1dGhvcml0YXRpdmUuJyxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG59XHJcbiJdfQ==