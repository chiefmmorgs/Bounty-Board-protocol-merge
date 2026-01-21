// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./Types.sol";
import "./Errors.sol";
import "./BountyRegistry.sol";
import "./PaymentEscrow.sol";
import "./ReputationOracle.sol";

/**
 * @title DisputeResolver
 * @notice Handle disputes with AI-assisted resolution and arbitrator decisions
 * @dev Implements dispute lifecycle from initiation to resolution
 */
contract DisputeResolver is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable
{
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant AI_SERVICE_ROLE = keccak256("AI_SERVICE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint8 public constant AI_CONFIDENCE_THRESHOLD = 70; // Below this, escalate to arbitrator
    uint8 public constant MIN_DISPUTE_WIN_RATE = 30; // Minimum 30% win rate
    uint16 public constant MIN_PROFESSIONALISM_FOR_DISPUTES = 1000;
    uint256 public constant DISPUTE_WINDOW = 14 days;


    
    // ============ STATE VARIABLES ============
    
    uint256 public disputeCounter;
    uint256 public appealThreshold; // Minimum bounty value for appeals (wei)
    
    address public bountyRegistry;
    address public paymentEscrow;
    address public reputationOracle;
    
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => uint256) public bountyToDispute; // bountyId => disputeId
    mapping(address => bool) public authorizedArbitrators;
    mapping(address => uint256) public arbitratorCaseCount;
    
    // ============ EVENTS ============
    
    event DisputeInitiated(
        uint256 indexed disputeId,
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address initiator,
        DisputeReason reason,
        bytes32 evidenceHash,
        uint256 timestamp
    );
    
    event AIAnalysisSubmitted(
        uint256 indexed disputeId,
        bytes32 aiRecommendationHash,
        uint8 confidenceScore,
        DisputeOutcome recommendedOutcome,
        uint256 timestamp
    );
    
    event ArbitratorAssigned(
        uint256 indexed disputeId,
        address indexed arbitrator,
        uint8 aiConfidence,
        uint256 timestamp
    );
    
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed bountyId,
        DisputeOutcome outcome,
        uint256 paymentPercentage,
        address indexed resolvedBy,
        bytes32 reasoningHash,
        uint256 timestamp
    );
    
    event DisputeAppealed(
        uint256 indexed disputeId,
        address indexed appellant,
        bytes32 appealEvidenceHash,
        uint256 timestamp
    );
    
    event OutcomeExecuted(
        uint256 indexed disputeId,
        uint256 freelancerPayment,
        uint256 clientRefund,
        uint256 timestamp
    );
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // _disableInitializers();
    }
    
    function initialize(
        address admin,
        address _bountyRegistry,
        address _paymentEscrow,
        address _reputationOracle,
        uint256 _appealThreshold
    ) external initializer {
        if (
            admin == address(0) ||
            _bountyRegistry == address(0) ||
            _paymentEscrow == address(0) ||
            _reputationOracle == address(0)
        ) revert InvalidAddress();
        
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        
        bountyRegistry = _bountyRegistry;
        paymentEscrow = _paymentEscrow;
        reputationOracle = _reputationOracle;
        appealThreshold = _appealThreshold;
    }
    
    // ============ DISPUTE INITIATION ============
    
    /**
     * @notice Initiate a dispute
     * @param _bountyId Bounty ID
     * @param _submissionId Submission ID
     * @param _reason Dispute reason
     * @param _evidenceHash IPFS hash of evidence
     * @return disputeId Created dispute ID
     */
    function initiateDispute(
        uint256 _bountyId,
        uint256 _submissionId,
        DisputeReason _reason,
        bytes32 _evidenceHash
    ) external whenNotPaused nonReentrant returns (uint256 disputeId) {
        // Validate caller is party to the bounty
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(_bountyId);
        address freelancer = BountyRegistry(bountyRegistry).bountyAssignments(_bountyId);
        
        if (msg.sender != bounty.client && msg.sender != freelancer) {
            revert DisputeResolver__NotPartyToDispute();
        }
        
        // Check if dispute already exists
        if (bountyToDispute[_bountyId] != 0) revert DisputeResolver__DisputeAlreadyExists();
        
        // Get dispute statistics
        (uint256 initiated, uint256 lost, uint256 winRate) = ReputationOracle(reputationOracle).getDisputeStats(msg.sender);
        
        // Check dispute abuse prevention
        if (initiated >= 3 && winRate < MIN_DISPUTE_WIN_RATE) {
            revert DisputeResolver__DisputeAbusePrevention(winRate);
        }
        
        // Check professionalism score for frequent disputers
        if (initiated > 5) {
            ReputationScore memory rep = ReputationOracle(reputationOracle).getReputation(msg.sender);
            if (rep.professionalismScore < MIN_PROFESSIONALISM_FOR_DISPUTES) {
                revert DisputeResolver__ProfessionalismScoreTooLow(rep.professionalismScore);
            }
        }
        
        // Create dispute
        disputeCounter++;
        disputeId = disputeCounter;
        
        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            bountyId: _bountyId,
            submissionId: _submissionId,
            initiator: msg.sender,
            reason: uint8(_reason),
            status: uint8(DisputeStatus.Open),
            outcome: uint8(DisputeOutcome.Dismissed),
            aiConfidenceScore: 0,
            assignedArbitrator: address(0),
            createdAt: block.timestamp,
            resolvedAt: 0,
            evidenceHash: _evidenceHash,
            aiRecommendationHash: bytes32(0)
        });
        
        bountyToDispute[_bountyId] = disputeId;
        
        // Update bounty status
        BountyRegistry(bountyRegistry).updateBountyStatus(_bountyId, BountyStatus.Disputed);
        
        // Record dispute initiation
        ReputationOracle(reputationOracle).recordDisputeInitiation(msg.sender);
        
        emit DisputeInitiated(
            disputeId,
            _bountyId,
            _submissionId,
            msg.sender,
            _reason,
            _evidenceHash,
            block.timestamp
        );
    }
    
    // ============ AI ANALYSIS ============
    
    /**
     * @notice Submit AI analysis for dispute
     * @param _disputeId Dispute ID
     * @param _recommendationHash IPFS hash of AI analysis
     * @param _confidenceScore AI confidence (0-100)
     * @param _recommendedOutcome Recommended outcome
     */
    function submitAIAnalysis(
        uint256 _disputeId,
        bytes32 _recommendationHash,
        uint8 _confidenceScore,
        DisputeOutcome _recommendedOutcome
    ) external onlyRole(AI_SERVICE_ROLE) {
        Dispute storage dispute = disputes[_disputeId];
        
        if (dispute.disputeId == 0) revert DisputeResolver__DisputeNotFound();
        if (_confidenceScore > 100) revert ReputationOracle__ScoreOutOfBounds(_confidenceScore);
        if (_recommendationHash == bytes32(0)) revert DisputeResolver__InvalidEvidence();
        if (_confidenceScore == 0) revert DisputeResolver__InvalidConfidence();
        
        // Update dispute
        dispute.aiRecommendationHash = _recommendationHash;
        dispute.aiConfidenceScore = _confidenceScore;
        dispute.status = uint8(DisputeStatus.UnderReview);
        
        emit AIAnalysisSubmitted(
            _disputeId,
            _recommendationHash,
            _confidenceScore,
            _recommendedOutcome,
            block.timestamp
        );
        
        // If confidence is high enough, auto-resolve
        if (_confidenceScore >= AI_CONFIDENCE_THRESHOLD) {
            _resolveDisputeInternal(_disputeId, _recommendedOutcome, 50, _recommendationHash, address(this));
        } else {
            // Escalate to arbitrator
            dispute.status = uint8(DisputeStatus.AwaitingArbitration);
        }
    }
    
    // ============ ARBITRATION ============
    
    /**
     * @notice Assign arbitrator to dispute
     * @param _disputeId Dispute ID
     * @param _arbitrator Arbitrator address
     */
    function assignArbitrator(
        uint256 _disputeId,
        address _arbitrator
    ) external onlyRole(ADMIN_ROLE) {
        if (!authorizedArbitrators[_arbitrator]) revert DisputeResolver__UnauthorizedArbitrator();
        
        Dispute storage dispute = disputes[_disputeId];
        
        if (dispute.disputeId == 0) revert DisputeResolver__DisputeNotFound();
        
        dispute.assignedArbitrator = _arbitrator;
        dispute.status = uint8(DisputeStatus.AwaitingArbitration);
        
        arbitratorCaseCount[_arbitrator]++;
        
        emit ArbitratorAssigned(_disputeId, _arbitrator, dispute.aiConfidenceScore, block.timestamp);
    }
    
    /**
     * @notice Arbitrator resolves dispute
     * @param _disputeId Dispute ID
     * @param _outcome Resolution outcome
     * @param _paymentPercentage Percentage to freelancer (0-100)
     * @param _reasoningHash IPFS hash of reasoning
     */
    function resolveDispute(
        uint256 _disputeId,
        DisputeOutcome _outcome,
        uint256 _paymentPercentage,
        bytes32 _reasoningHash
    ) external whenNotPaused nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        
        if (dispute.disputeId == 0) revert DisputeResolver__DisputeNotFound();
        
        // Verify caller is assigned arbitrator
        if (dispute.assignedArbitrator != msg.sender) {
            revert DisputeResolver__NotAssignedArbitrator();
        }
        
        if (_paymentPercentage > 100) revert DisputeResolver__InvalidPaymentPercentage();
        
        _resolveDisputeInternal(_disputeId, _outcome, _paymentPercentage, _reasoningHash, msg.sender);
    }
    
    /**
     * @notice Internal dispute resolution logic
     */
    function _resolveDisputeInternal(
        uint256 _disputeId,
        DisputeOutcome _outcome,
        uint256 _paymentPercentage,
        bytes32 _reasoningHash,
        address _resolvedBy
    ) internal {
        Dispute storage dispute = disputes[_disputeId];
        
        dispute.outcome = uint8(_outcome);
        dispute.status = uint8(DisputeStatus.Resolved);
        dispute.resolvedAt = block.timestamp;
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(dispute.bountyId);
        address freelancer = BountyRegistry(bountyRegistry).bountyAssignments(dispute.bountyId);
        
        // Execute outcome
        if (_outcome == DisputeOutcome.FullPaymentToFreelancer) {
            // Full payment to freelancer
            PaymentEscrow(paymentEscrow).releasePayment(
                dispute.bountyId,
                freelancer,
                bounty.escrowAmount
            );
            
            // Record completion
            ReputationOracle(reputationOracle).recordCompletion(
                freelancer,
                dispute.bountyId,
                bounty.escrowAmount - bounty.platformFee
            );
            
            // Client loses reputation
            ReputationOracle(reputationOracle).recordDisputeLoss(bounty.client, _disputeId);
            
        } else if (_outcome == DisputeOutcome.FullRefundToClient) {
            // Full refund to client
            PaymentEscrow(paymentEscrow).refundClient(
                dispute.bountyId,
                bounty.client,
                bounty.escrowAmount,
                "Dispute resolved in favor of client"
            );
            
            // Freelancer loses reputation
            ReputationOracle(reputationOracle).recordDisputeLoss(freelancer, _disputeId);
            
        } else if (_outcome == DisputeOutcome.PartialPayment || _outcome == DisputeOutcome.Split) {
            // Partial payment
            uint256 percentage = _outcome == DisputeOutcome.Split ? 50 : _paymentPercentage;
            
            PaymentEscrow(paymentEscrow).releasePartialPayment(
                dispute.bountyId,
                freelancer,
                bounty.client,
                percentage
            );
            
            // Both parties lose some reputation
            ReputationOracle(reputationOracle).recordDisputeLoss(freelancer, _disputeId);
            ReputationOracle(reputationOracle).recordDisputeLoss(bounty.client, _disputeId);
        }
        
        // Update bounty status
        BountyRegistry(bountyRegistry).updateBountyStatus(dispute.bountyId, BountyStatus.Completed);
        
        emit DisputeResolved(
            _disputeId,
            dispute.bountyId,
            _outcome,
            _paymentPercentage,
            _resolvedBy,
            _reasoningHash,
            block.timestamp
        );
    }
    
    // ============ APPEALS ============
    
    /**
     * @notice Appeal dispute decision (high-value bounties only)
     * @param _disputeId Dispute ID
     * @param _appealEvidenceHash IPFS hash of appeal evidence
     */
    function appealDispute(
        uint256 _disputeId,
        bytes32 _appealEvidenceHash
    ) external whenNotPaused nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        
        if (dispute.disputeId == 0) revert DisputeResolver__DisputeNotFound();
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(dispute.bountyId);
        address freelancer = BountyRegistry(bountyRegistry).bountyAssignments(dispute.bountyId);
        
        // Only parties to dispute can appeal
        if (msg.sender != bounty.client && msg.sender != freelancer) {
            revert DisputeResolver__NotPartyToDispute();
        }
        
        // Check bounty value threshold
        if (bounty.escrowAmount < appealThreshold) {
            revert DisputeResolver__AppealNotAllowed(bounty.escrowAmount, appealThreshold);
        }
        
        // Update dispute status
        dispute.status = uint8(DisputeStatus.Appealed);
        
        emit DisputeAppealed(_disputeId, msg.sender, _appealEvidenceHash, block.timestamp);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get dispute details
     * @param _disputeId Dispute ID
     * @return Dispute struct
     */
    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        return disputes[_disputeId];
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set authorized arbitrator
     * @param _arbitrator Arbitrator address
     * @param _authorized True to authorize, false to deauthorize
     */
    function setArbitrator(
        address _arbitrator,
        bool _authorized
    ) external onlyRole(ADMIN_ROLE) {
        if (_arbitrator == address(0)) revert InvalidAddress();
        
        authorizedArbitrators[_arbitrator] = _authorized;
        
        if (_authorized) {
            _grantRole(ARBITRATOR_ROLE, _arbitrator);
        } else {
            _revokeRole(ARBITRATOR_ROLE, _arbitrator);
        }
    }
    
    /**
     * @notice Update appeal threshold
     * @param _newThreshold New threshold in wei
     */
    function setAppealThreshold(uint256 _newThreshold) external onlyRole(ADMIN_ROLE) {
        appealThreshold = _newThreshold;
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // ============ UPGRADE SAFETY GAP ============
    
    uint256[50] private __gap;
}
