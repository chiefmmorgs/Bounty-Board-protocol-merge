/**
 * AIMatchingService - Non-authoritative recommendation service
 *
 * CRITICAL: This service has ZERO authority
 * - It SUGGESTS matches, never DECIDES
 * - It RECOMMENDS actions, never ENFORCES
 * - Users and contracts make final decisions
 */
export declare class AIMatchingService {
    private openai;
    private model;
    constructor(config: {
        apiKey: string;
        model?: string;
    });
    /**
     * Suggest freelancers for a bounty
     * NON-AUTHORITATIVE: Returns suggestions only, user decides
     */
    suggestFreelancers(params: {
        bountyId: bigint;
        requirementsText: string;
        minRepRequired: number;
        escrowAmount: bigint;
        deadline: bigint;
        candidates: Array<{
            address: string;
            qualityScore: number;
            reliabilityScore: number;
            professionalismScore: number;
            overallScore: number;
            tier: string;
            completedBounties: number;
            totalEarnings: bigint;
            disputesLost: number;
            lateSubmissions: number;
            skills?: string[];
            pastWork?: string[];
        }>;
    }): Promise<{
        suggestions: Array<{
            address: string;
            rank: number;
            score: number;
            reasoning: string;
            strengths: string[];
            concerns: string[];
            recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
        }>;
        disclaimer: string;
    }>;
    /**
     * Analyze dispute and suggest resolution
     * NON-AUTHORITATIVE: Provides recommendation, arbitrator decides
     */
    analyzeDispute(params: {
        disputeId: bigint;
        bountyRequirements: string;
        submittedWork: string;
        clientEvidence: string;
        freelancerEvidence: string;
        bountyValue: bigint;
        freelancerReputation: {
            qualityScore: number;
            reliabilityScore: number;
            professionalismScore: number;
            completedBounties: number;
            disputesLost: number;
        };
        clientReputation: {
            totalBountiesCreated: number;
            disputesInitiated: number;
        };
    }): Promise<{
        recommendation: {
            outcome: 'full_payment' | 'partial_payment' | 'full_refund' | 'split_50_50';
            paymentPercentage: number;
            confidence: number;
            reasoning: string;
            keyFindings: string[];
            concerns: string[];
        };
        disclaimer: string;
        requiresArbitrator: boolean;
    }>;
    /**
     * Suggest skill improvements for freelancer
     * NON-AUTHORITATIVE: Educational suggestions only
     */
    suggestSkillImprovements(params: {
        address: string;
        currentScores: {
            quality: number;
            reliability: number;
            professionalism: number;
        };
        recentBounties: Array<{
            requirements: string;
            feedback: string;
            accepted: boolean;
        }>;
        targetTier: string;
    }): Promise<{
        suggestions: Array<{
            category: 'quality' | 'reliability' | 'professionalism';
            currentScore: number;
            targetScore: number;
            recommendations: string[];
            estimatedImpact: string;
        }>;
        disclaimer: string;
    }>;
    /**
     * Estimate bounty completion time
     * NON-AUTHORITATIVE: Estimate only, not binding
     */
    estimateCompletionTime(params: {
        requirements: string;
        complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
        freelancerHistory: Array<{
            requirements: string;
            timeToComplete: number;
            onTime: boolean;
        }>;
    }): Promise<{
        estimate: {
            minHours: number;
            maxHours: number;
            mostLikely: number;
            confidence: number;
        };
        disclaimer: string;
    }>;
    private buildMatchingPrompt;
    private buildDisputeAnalysisPrompt;
    private buildSkillImprovementPrompt;
    private buildTimeEstimatePrompt;
    private fallbackMatching;
}
