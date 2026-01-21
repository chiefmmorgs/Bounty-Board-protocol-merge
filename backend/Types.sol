// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Types
 * @notice Shared enums and structs for the Bounty Board platform
 * @dev All contracts import from this file for type consistency
 */

// ============ ENUMS ============

enum BountyStatus {
    Open,               // 0: Bounty created and funded, awaiting claim
    InProgress,         // 1: Claimed by freelancer, work in progress
    UnderReview,        // 2: Work submitted, client reviewing
    Completed,          // 3: Work accepted, payment released
    Disputed,           // 4: Dispute raised, funds frozen
    Cancelled,          // 5: Bounty cancelled, funds refunded
    Expired,            // 6: Deadline passed with no submissions
    PendingCancellation // 7: Cancellation requested, awaiting moderator review
}

enum SubmissionStatus {
    Pending,            // 0: Submitted, awaiting review
    UnderReview,        // 1: Client actively reviewing
    RevisionRequested,  // 2: Client requested changes
    Accepted,           // 3: Client accepted submission
    Rejected,           // 4: Client rejected submission
    Disputed            // 5: Dispute raised on this submission
}

enum ReputationTier {
    Bronze,     // 0: 0-39 reputation
    Silver,     // 1: 40-69 reputation
    Gold,       // 2: 70-89 reputation
    Platinum    // 3: 90-100 reputation
}

enum DisputeReason {
    QualityIssue,           // 0: Work quality below expectations
    ScopeCreep,             // 1: Disagreement on scope
    PaymentDispute,         // 2: Payment amount disagreement
    CommunicationIssue,     // 3: Poor communication
    Other                   // 4: Other reasons
}

enum DisputeStatus {
    Open,                   // 0: Dispute initiated, awaiting analysis
    UnderReview,            // 1: AI analyzing dispute
    AwaitingArbitration,    // 2: Assigned to human arbitrator
    Resolved,               // 3: Decision made and executed
    Appealed                // 4: Decision appealed
}

enum DisputeOutcome {
    FullPaymentToFreelancer,    // 0: Freelancer wins, gets full payment
    PartialPayment,             // 1: Split decision, partial payment
    FullRefundToClient,         // 2: Client wins, gets full refund
    Split,                      // 3: 50/50 split
    Dismissed                   // 4: Dispute dismissed (default value)
}

// ============ STRUCTS ============

struct Bounty {
    uint256 bountyId;
    address client;
    uint16 minRepRequired;      // 0-2000 (Ethos score)
    uint8 status;               // BountyStatus enum
    uint8 maxRevisions;
    uint256 escrowAmount;       // Wei
    uint256 platformFee;        // Wei
    uint256 deadline;           // Unix timestamp
    uint256 createdAt;          // Unix timestamp
    uint256 reviewPeriod;       // Seconds
    bytes32 requirementsHash;   // IPFS hash
}

struct Submission {
    uint256 submissionId;
    uint256 bountyId;
    address freelancer;
    uint8 status;               // SubmissionStatus enum
    uint8 revisionCount;
    uint256 submittedAt;        // Unix timestamp
    uint256 reviewStartedAt;    // Unix timestamp
    bytes32 workHash;           // IPFS hash
    bytes32 clientFeedbackHash; // IPFS hash
}

struct ReputationScore {
    uint16 qualityScore;         // 0-2000
    uint16 reliabilityScore;     // 0-2000
    uint16 professionalismScore; // 0-2000
    uint16 overallScore;         // Weighted composite
    uint8 tier;                 // ReputationTier enum
    uint256 totalBountiesCompleted;
    uint256 totalEarnings;      // Wei
    uint256 disputesLost;
    uint256 lastUpdated;        // Unix timestamp
}

struct EscrowAccount {
    uint256 balance;            // Total balance
    uint256 lockedAmount;       // Locked in active bounties
    uint256 availableAmount;    // Available for withdrawal
    uint256 platformFees;       // Accumulated fees
}

struct Dispute {
    uint256 disputeId;
    uint256 bountyId;
    uint256 submissionId;
    address initiator;
    uint8 reason;               // DisputeReason enum
    uint8 status;               // DisputeStatus enum
    uint8 outcome;              // DisputeOutcome enum
    uint8 aiConfidenceScore;    // 0-100
    address assignedArbitrator;
    uint256 createdAt;          // Unix timestamp
    uint256 resolvedAt;         // Unix timestamp
    bytes32 evidenceHash;       // IPFS hash
    bytes32 aiRecommendationHash; // IPFS hash
}

struct CancellationRequest {
    uint256 bountyId;
    address requester;
    uint256 requestedAt;        // Unix timestamp
    uint256 reviewDeadline;     // Unix timestamp (requestedAt + 7 days)
    bytes32 reasonHash;         // IPFS hash of cancellation reason
    bool processed;
    bool approved;
}
