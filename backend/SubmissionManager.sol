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
 * @title SubmissionManager
 * @notice Handle work submissions and review workflow
 * @dev Manages submission lifecycle from submission to acceptance/rejection
 */
contract SubmissionManager is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable
{
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    uint16 public constant MIN_QUALITY_SCORE_FOR_RESUBMISSION = 600;
    
    // ============ STATE VARIABLES ============
    
    uint256 public submissionCounter;
    
    address public bountyRegistry;
    address public paymentEscrow;
    address public reputationOracle;
    
    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => uint256) public bountyToSubmission; // bountyId => submissionId
    mapping(address => mapping(uint256 => uint256)) public submissionTimestamps; // freelancer => bountyId => timestamp
    mapping(uint256 => uint256) public reviewDeadlines; // submissionId => deadline
    
    // ============ EVENTS ============
    
    event WorkSubmitted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed freelancer,
        bytes32 workHash,
        bool onTime,
        uint256 timestamp
    );
    
    event ReviewStarted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        uint256 reviewDeadline,
        uint256 timestamp
    );
    
    event SubmissionAccepted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed freelancer,
        uint256 paymentAmount,
        uint256 platformFee,
        bytes32 feedbackHash,
        uint256 timestamp
    );
    
    event SubmissionRejected(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        bytes32 feedbackHash,
        uint8 revisionCount,
        uint256 timestamp
    );
    
    event RevisionRequested(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        uint8 revisionNumber,
        bytes32 feedbackHash,
        uint256 timestamp
    );
    
    event WorkResubmitted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        bytes32 newWorkHash,
        uint8 revisionNumber,
        uint256 timestamp
    );
    
    event AutoAccepted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed freelancer,
        uint256 paymentAmount,
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
        address _reputationOracle
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
    }
    

    
    // ============ SUBMISSION ============
    
    /**
     * @notice Submit work for a bounty
     * @param _bountyId Bounty ID
     * @param _workHash IPFS hash of work deliverables
     * @return submissionId Created submission ID
     */
    function submitWork(
        uint256 _bountyId,
        bytes32 _workHash
    ) external whenNotPaused nonReentrant returns (uint256 submissionId) {
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(_bountyId);
        
        // Validate bounty is assigned to caller
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        
        address assignedFreelancer = BountyRegistry(bountyRegistry).bountyAssignments(_bountyId);
        if (assignedFreelancer != msg.sender) revert SubmissionManager__BountyNotAssignedToYou();

        // Check for existing active submission
        uint256 existingId = bountyToSubmission[_bountyId];
        if (existingId != 0) {
            SubmissionStatus status = SubmissionStatus(submissions[existingId].status);
            // Allow resubmission only if previous was Rejected or Disputed (though Disputed is separate flow)
            // Actually Disputed shouldn't allow resubmit?
            // If Rejected, user can resubmit?
            // Logic: Reject -> Freelancer fixes -> submitWork (new submission)?
            // Or use resubmitWork?
            // If Rejected, status is Rejected.
            // If we allow new submission, we overwrite.
            // But `resubmitWork` is for RevisionRequested.
            // What if Rejected?
            // If client rejects (final), can freelancer submit again?
            // If bounty is still InProgress?
            // rejectSubmission sets status to Rejected. Does NOT change Bounty status (stays UnderReview or goes back?)
            // rejectSubmission: `submission.status = Rejected`.
            // Does NOT call updateBountyStatus.
            // So Bounty stays UnderReview!!
            // This is a state machine issue I identified earlier.
            // "UnderReview -> UnderReview is redundant but safe."
            // But if Rejected, bounty is stuck in UnderReview?
            // Then freelancer cannot `submitWork` because `submitWork` doesn't check bounty status but `updateBountyStatus(UnderReview)` might fail if already UnderReview?
            // `_isValidTransition`: UnderReview -> UnderReview IS Valid (I added it).
            // But keeping bounty UnderReview forever on Rejection is weird.
            // Client should probably be able to cancel or freelancer resubmit.
            // If Rejected, I'll allow `submitWork`.
            if (status != SubmissionStatus.Rejected && status != SubmissionStatus.Disputed) {
                 revert SubmissionManager__SubmissionAlreadyExists();
            }
        }
        
        // Check if this is a resubmission
        bool isResubmission = submissionTimestamps[msg.sender][_bountyId] > 0;
        
        // For resubmissions, check quality score
        if (isResubmission) {
            ReputationScore memory rep = ReputationOracle(reputationOracle).getReputation(msg.sender);
            if (rep.qualityScore < MIN_QUALITY_SCORE_FOR_RESUBMISSION) {
                revert SubmissionManager__QualityScoreTooLowForResubmission(rep.qualityScore);
            }
        }
        
        // Check if submission is on time
        bool onTime = block.timestamp <= bounty.deadline;
        
        // Record late submission if applicable
        if (!onTime) {
            ReputationOracle(reputationOracle).recordLateSubmission(
                msg.sender,
                _bountyId,
                bounty.deadline
            );
        }
        
        // Create submission
        submissionCounter++;
        submissionId = submissionCounter;
        
        submissions[submissionId] = Submission({
            submissionId: submissionId,
            bountyId: _bountyId,
            freelancer: msg.sender,
            status: uint8(SubmissionStatus.Pending),
            revisionCount: 0,
            submittedAt: block.timestamp,
            reviewStartedAt: 0,
            workHash: _workHash,
            clientFeedbackHash: bytes32(0)
        });
        
        bountyToSubmission[_bountyId] = submissionId;
        submissionTimestamps[msg.sender][_bountyId] = block.timestamp;
        
        // Update bounty status
        BountyRegistry(bountyRegistry).updateBountyStatus(_bountyId, BountyStatus.UnderReview);
        
        emit WorkSubmitted(submissionId, _bountyId, msg.sender, _workHash, onTime, block.timestamp);
    }
    
    // ============ REVIEW ============
    
    /**
     * @notice Client starts reviewing submission
     * @param _submissionId Submission ID
     */
    function startReview(uint256 _submissionId) external whenNotPaused nonReentrant {
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(submission.bountyId);
        if (bounty.client != msg.sender) revert SubmissionManager__NotBountyClient();
        
        if (SubmissionStatus(submission.status) != SubmissionStatus.Pending) {
            revert SubmissionManager__SubmissionAlreadyUnderReview();
        }
        
        // Update status and set review deadline
        submission.status = uint8(SubmissionStatus.UnderReview);
        submission.reviewStartedAt = block.timestamp;
        
        uint256 reviewDeadline = block.timestamp + bounty.reviewPeriod;
        reviewDeadlines[_submissionId] = reviewDeadline;

        // Update bounty status on registry
        BountyRegistry(bountyRegistry).updateBountyStatus(submission.bountyId, BountyStatus.UnderReview);
        
        emit ReviewStarted(_submissionId, submission.bountyId, reviewDeadline, block.timestamp);
    }
    
    /**
     * @notice Client accepts submission
     * @param _submissionId Submission ID
     * @param _feedbackHash IPFS hash of feedback
     */
    function acceptSubmission(
        uint256 _submissionId,
        bytes32 _feedbackHash
    ) external whenNotPaused nonReentrant {
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(submission.bountyId);
        if (bounty.client != msg.sender) revert SubmissionManager__NotBountyClient();
        
        SubmissionStatus currentStatus = SubmissionStatus(submission.status);
        if (currentStatus != SubmissionStatus.UnderReview) {
            revert SubmissionManager__SubmissionNotUnderReview();
        }
        
        // Update submission
        submission.status = uint8(SubmissionStatus.Accepted);
        submission.clientFeedbackHash = _feedbackHash;
        
        // Release payment
        PaymentEscrow(paymentEscrow).releasePayment(
            submission.bountyId,
            submission.freelancer,
            bounty.escrowAmount
        );
        
        // Record completion in reputation oracle
        ReputationOracle(reputationOracle).recordCompletion(
            submission.freelancer,
            submission.bountyId,
            bounty.escrowAmount - bounty.platformFee
        );
        
        // Update bounty status
        BountyRegistry(bountyRegistry).updateBountyStatus(submission.bountyId, BountyStatus.Completed);
        
        emit SubmissionAccepted(
            _submissionId,
            submission.bountyId,
            submission.freelancer,
            bounty.escrowAmount - bounty.platformFee,
            bounty.platformFee,
            _feedbackHash,
            block.timestamp
        );
    }
    
    /**
     * @notice Client rejects submission
     * @param _submissionId Submission ID
     * @param _feedbackHash IPFS hash of rejection feedback (required)
     */
    function rejectSubmission(
        uint256 _submissionId,
        bytes32 _feedbackHash
    ) external whenNotPaused nonReentrant {
        if (_feedbackHash == bytes32(0)) revert SubmissionManager__FeedbackRequired();
        
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(submission.bountyId);
        if (bounty.client != msg.sender) revert SubmissionManager__NotBountyClient();
        
        if (SubmissionStatus(submission.status) != SubmissionStatus.UnderReview) {
            revert SubmissionManager__SubmissionNotUnderReview();
        }
        
        // Update submission
        submission.status = uint8(SubmissionStatus.Rejected);
        submission.clientFeedbackHash = _feedbackHash;
        
        emit SubmissionRejected(
            _submissionId,
            submission.bountyId,
            _feedbackHash,
            submission.revisionCount,
            block.timestamp
        );
    }
    
    /**
     * @notice Client requests revision
     * @param _submissionId Submission ID
     * @param _feedbackHash IPFS hash of revision request
     */
    function requestRevision(
        uint256 _submissionId,
        bytes32 _feedbackHash
    ) external whenNotPaused nonReentrant {
        if (_feedbackHash == bytes32(0)) revert SubmissionManager__FeedbackRequired();
        
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(submission.bountyId);
        if (bounty.client != msg.sender) revert SubmissionManager__NotBountyClient();
        
        if (SubmissionStatus(submission.status) != SubmissionStatus.UnderReview) {
            revert SubmissionManager__SubmissionNotUnderReview();
        }
        
        // Check max revisions
        if (submission.revisionCount >= bounty.maxRevisions) {
            revert SubmissionManager__MaxRevisionsExceeded();
        }
        
        // Update submission
        submission.status = uint8(SubmissionStatus.RevisionRequested);
        submission.revisionCount++;
        submission.clientFeedbackHash = _feedbackHash;
        
        emit RevisionRequested(
            _submissionId,
            submission.bountyId,
            submission.revisionCount,
            _feedbackHash,
            block.timestamp
        );
    }
    
    /**
     * @notice Freelancer resubmits after revision request
     * @param _submissionId Submission ID
     * @param _newWorkHash IPFS hash of revised work
     */
    function resubmitWork(
        uint256 _submissionId,
        bytes32 _newWorkHash
    ) external whenNotPaused nonReentrant {
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        if (submission.freelancer != msg.sender) revert Unauthorized();
        
        if (SubmissionStatus(submission.status) != SubmissionStatus.RevisionRequested) {
            revert InvalidState();
        }
        
        // Update submission
        submission.workHash = _newWorkHash;
        submission.status = uint8(SubmissionStatus.Pending);
        submission.submittedAt = block.timestamp;
        submission.reviewStartedAt = 0;
        
        emit WorkResubmitted(
            _submissionId,
            submission.bountyId,
            _newWorkHash,
            submission.revisionCount,
            block.timestamp
        );
    }
    
    /**
     * @notice Auto-accept submission after review timeout (called by Keeper)
     * @param _submissionId Submission ID
     */
    function autoAcceptSubmission(uint256 _submissionId) external onlyRole(KEEPER_ROLE) {
        Submission storage submission = submissions[_submissionId];
        
        if (submission.submissionId == 0) revert SubmissionManager__SubmissionNotFound();
        
        uint256 deadline = reviewDeadlines[_submissionId];
        if (block.timestamp <= deadline) revert SubmissionManager__ReviewPeriodNotExpired();
        
        SubmissionStatus currentStatus = SubmissionStatus(submission.status);
        if (currentStatus != SubmissionStatus.Pending && currentStatus != SubmissionStatus.UnderReview) {
            return; // Already processed
        }
        
        // Update submission
        submission.status = uint8(SubmissionStatus.Accepted);
        
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(submission.bountyId);
        
        // Release payment
        PaymentEscrow(paymentEscrow).releasePayment(
            submission.bountyId,
            submission.freelancer,
            bounty.escrowAmount
        );
        
        // Record completion
        ReputationOracle(reputationOracle).recordCompletion(
            submission.freelancer,
            submission.bountyId,
            bounty.escrowAmount - bounty.platformFee
        );
        
        // Update bounty status
        BountyRegistry(bountyRegistry).updateBountyStatus(submission.bountyId, BountyStatus.Completed);
        
        emit AutoAccepted(
            _submissionId,
            submission.bountyId,
            submission.freelancer,
            bounty.escrowAmount - bounty.platformFee,
            block.timestamp
        );
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get submission details
     * @param _submissionId Submission ID
     * @return Submission struct
     */
    function getSubmission(uint256 _submissionId) external view returns (Submission memory) {
        return submissions[_submissionId];
    }
    
    // ============ ADMIN FUNCTIONS ============
    
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
