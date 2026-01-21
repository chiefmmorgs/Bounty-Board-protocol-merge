// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./Types.sol";
import "./Errors.sol";
import "./ReputationOracle.sol";
import "./PaymentEscrow.sol";

/**
 * @title BountyRegistry
 * @notice Central registry for all bounties with escrow functionality
 * @dev Manages bounty lifecycle from creation to completion/cancellation
 */
contract BountyRegistry is 
    Initializable,
    AccessControlUpgradeable, 
    ReentrancyGuard,
    PausableUpgradeable 
{
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    
    uint256 public constant MIN_ESCROW_AMOUNT = 0.001 ether;
    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
    uint256 public constant DEFAULT_REVIEW_PERIOD = 72 hours;
    uint256 public constant DEFAULT_MAX_REVISIONS = 2;
    uint256 public constant CANCELLATION_REVIEW_PERIOD = 7 days;
    
    // ============ STATE VARIABLES ============
    
    uint256 public bountyCounter;
    uint256 public cancellationCounter;
    
    address public reputationOracle;
    address public paymentEscrow;
    
    /// @notice Primary moderator address. When set to address(0), moderation is inactive.
    /// @dev Future provisions: can be a wallet, AI agent contract, or DAO governance contract.
    address public moderator;
    
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => address) public bountyAssignments; // bountyId => freelancer
    mapping(address => uint256[]) private userActiveBounties;
    mapping(address => uint256) public activeBountyCount;
    
    // Cancellation request tracking
    mapping(uint256 => CancellationRequest) public cancellationRequests; // bountyId => request
    mapping(uint256 => uint256) public bountyCancellationId; // bountyId => cancellationId (for event indexing)
    
    // ============ EVENTS ============
    
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed client,
        uint256 escrowAmount,
        uint256 platformFee,
        uint256 deadline,
        uint16 minRepRequired,
        bytes32 requirementsHash,
        uint256 timestamp
    );
    
    event BountyClaimed(
        uint256 indexed bountyId,
        address indexed freelancer,
        uint16 freelancerReputation,
        uint256 timestamp
    );
    
    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed client,
        uint256 refundAmount,
        string reason,
        uint256 timestamp
    );
    
    event BountyExpired(
        uint256 indexed bountyId,
        uint256 deadline,
        uint256 timestamp
    );
    
    event BountyStatusChanged(
        uint256 indexed bountyId,
        BountyStatus oldStatus,
        BountyStatus newStatus,
        uint256 timestamp
    );
    
    event CancellationRequested(
        uint256 indexed bountyId,
        uint256 indexed cancellationId,
        address indexed requester,
        bytes32 reasonHash,
        uint256 reviewDeadline,
        uint256 timestamp
    );
    
    event CancellationApproved(
        uint256 indexed bountyId,
        uint256 indexed cancellationId,
        address indexed moderator,
        uint256 refundAmount,
        uint256 timestamp
    );
    
    event CancellationRejected(
        uint256 indexed bountyId,
        uint256 indexed cancellationId,
        address indexed moderator,
        bytes32 reasonHash,
        uint256 timestamp
    );
    
    event CancellationAutoApproved(
        uint256 indexed bountyId,
        uint256 indexed cancellationId,
        uint256 refundAmount,
        uint256 timestamp
    );
    
    event ModerationConfigured(
        address indexed previousModerator,
        address indexed newModerator,
        uint256 timestamp
    );
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // _disableInitializers();
    }
    
    function initialize(
        address admin,
        address _reputationOracle,
        address _paymentEscrow
    ) external initializer {
        if (admin == address(0) || _reputationOracle == address(0) || _paymentEscrow == address(0)) {
            revert InvalidAddress();
        }
        
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        
        reputationOracle = _reputationOracle;
        paymentEscrow = _paymentEscrow;
    }
    
    // ============ BOUNTY CREATION ============
    
    /**
     * @notice Create a new bounty with escrow deposit
     * @param _requirementsHash IPFS hash of bounty requirements
     * @param _deadline Unix timestamp deadline
     * @param _minRepRequired Minimum reputation required (0-2000)
     * @param _maxRevisions Maximum number of revisions allowed
     * @param _reviewPeriod Review period in seconds
     * @return bountyId Created bounty ID
     */
    function createBounty(
        bytes32 _requirementsHash,
        uint256 _deadline,
        uint16 _minRepRequired,
        uint256 _maxRevisions,
        uint256 _reviewPeriod
    ) external payable whenNotPaused nonReentrant returns (uint256 bountyId) {
        // Validate inputs
        if (msg.value < MIN_ESCROW_AMOUNT) revert BountyRegistry__InvalidEscrowAmount();
        if (_deadline <= block.timestamp) revert BountyRegistry__InvalidDeadline();
        if (_minRepRequired > 2000) revert BountyRegistry__InvalidMinRepRequirement();
        if (_reviewPeriod == 0 || _reviewPeriod > MAX_REVIEW_PERIOD) {
            _reviewPeriod = DEFAULT_REVIEW_PERIOD;
        }
        if (_maxRevisions == 0) {
            _maxRevisions = DEFAULT_MAX_REVISIONS;
        }
        
        // Calculate platform fee
        uint256 platformFeePercentage = PaymentEscrow(paymentEscrow).platformFeePercentage();
        uint256 platformFee = (msg.value * platformFeePercentage) / 10000;
        
        // Create bounty
        bountyCounter++;
        bountyId = bountyCounter;
        
        bounties[bountyId] = Bounty({
            bountyId: bountyId,
            client: msg.sender,
            minRepRequired: _minRepRequired,
            status: uint8(BountyStatus.Open),
            maxRevisions: uint8(_maxRevisions),
            escrowAmount: msg.value,
            platformFee: platformFee,
            deadline: _deadline,
            createdAt: block.timestamp,
            reviewPeriod: _reviewPeriod,
            requirementsHash: _requirementsHash
        });
        
        // Deposit to escrow
        PaymentEscrow(paymentEscrow).depositToEscrow{value: msg.value}(msg.sender, bountyId);
        
        // Lock funds
        PaymentEscrow(paymentEscrow).lockFunds(msg.sender, msg.value, bountyId);
        
        emit BountyCreated(
            bountyId,
            msg.sender,
            msg.value,
            platformFee,
            _deadline,
            _minRepRequired,
            _requirementsHash,
            block.timestamp
        );
    }
    
    // ============ BOUNTY CLAIMING ============
    
    /**
     * @notice Freelancer claims a bounty
     * @param _bountyId Bounty ID to claim
     */
    function claimBounty(uint256 _bountyId) external whenNotPaused nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        
        // Validate bounty exists and is open
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (BountyStatus(bounty.status) != BountyStatus.Open) revert BountyRegistry__BountyNotOpen();
        if (bountyAssignments[_bountyId] != address(0)) revert BountyRegistry__BountyAlreadyClaimed();
        
        // Check reputation requirement
        ReputationScore memory rep = ReputationOracle(reputationOracle).getReputation(msg.sender);
        if (rep.overallScore < bounty.minRepRequired) {
            revert BountyRegistry__InsufficientReputation(bounty.minRepRequired, rep.overallScore);
        }
        
        // Check capacity limit (tier-based)
        ReputationTier tier = ReputationOracle(reputationOracle).getTier(msg.sender);
        uint256 maxConcurrent = _getMaxConcurrentBounties(tier);
        uint256 currentActive = activeBountyCount[msg.sender];
        
        if (currentActive >= maxConcurrent) {
            revert BountyRegistry__CapacityLimitReached(currentActive, maxConcurrent);
        }
        
        // Check bounty value limit (tier-based)
        uint256 maxBountyValue = _getMaxBountyValue(tier);
        if (bounty.escrowAmount > maxBountyValue) {
            revert BountyRegistry__BountyValueExceedsTierLimit(bounty.escrowAmount, maxBountyValue);
        }
        
        // Assign bounty
        bountyAssignments[_bountyId] = msg.sender;
        bounty.status = uint8(BountyStatus.InProgress);
        
        // Track active bounties
        userActiveBounties[msg.sender].push(_bountyId);
        activeBountyCount[msg.sender]++;
        
        emit BountyClaimed(_bountyId, msg.sender, rep.overallScore, block.timestamp);
        emit BountyStatusChanged(_bountyId, BountyStatus.Open, BountyStatus.InProgress, block.timestamp);
    }
    
    // ============ BOUNTY CANCELLATION (MODERATED) ============
    
    /**
     * @notice Client requests bounty cancellation
     * @dev If no moderator is configured (moderator == address(0)), cancellation is processed immediately.
     *      Otherwise, enters 1-week moderation review period.
     * @param _bountyId Bounty ID to cancel
     * @param _reasonHash IPFS hash of cancellation reason
     */
    function requestCancellation(uint256 _bountyId, bytes32 _reasonHash) external whenNotPaused nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        
        // Validate
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (bounty.client != msg.sender) revert BountyRegistry__NotBountyClient();
        
        BountyStatus currentStatus = BountyStatus(bounty.status);
        
        // Can only request cancellation if Open or InProgress
        if (currentStatus != BountyStatus.Open && currentStatus != BountyStatus.InProgress) {
            revert BountyRegistry__CannotCancelWithSubmissions();
        }
        
        // If no moderator is configured, process cancellation immediately (moderation inactive)
        if (moderator == address(0)) {
            _processCancellationImmediate(_bountyId, bounty, currentStatus, _reasonHash);
            return;
        }
        
        // Moderation is active - enter review period
        // Check if cancellation already pending
        if (cancellationRequests[_bountyId].requestedAt != 0 && !cancellationRequests[_bountyId].processed) {
            revert BountyRegistry__CancellationAlreadyPending();
        }
        
        // Create cancellation request
        cancellationCounter++;
        uint256 reviewDeadline = block.timestamp + CANCELLATION_REVIEW_PERIOD;
        
        cancellationRequests[_bountyId] = CancellationRequest({
            bountyId: _bountyId,
            requester: msg.sender,
            requestedAt: block.timestamp,
            reviewDeadline: reviewDeadline,
            reasonHash: _reasonHash,
            processed: false,
            approved: false
        });
        
        bountyCancellationId[_bountyId] = cancellationCounter;
        
        // Update bounty status
        bounty.status = uint8(BountyStatus.PendingCancellation);
        
        emit CancellationRequested(_bountyId, cancellationCounter, msg.sender, _reasonHash, reviewDeadline, block.timestamp);
        emit BountyStatusChanged(_bountyId, currentStatus, BountyStatus.PendingCancellation, block.timestamp);
    }
    
    /**
     * @notice Internal function to process immediate cancellation (when moderation is inactive)
     */
    function _processCancellationImmediate(
        uint256 _bountyId,
        Bounty storage bounty,
        BountyStatus currentStatus,
        bytes32 _reasonHash
    ) internal {
        // Update bounty status
        bounty.status = uint8(BountyStatus.Cancelled);
        
        // Refund escrow to client
        PaymentEscrow(paymentEscrow).refundClient(
            _bountyId,
            bounty.client,
            bounty.escrowAmount,
            "Cancellation processed (moderation inactive)"
        );
        
        // Update freelancer's active count if was claimed
        address freelancer = bountyAssignments[_bountyId];
        if (freelancer != address(0) && activeBountyCount[freelancer] > 0) {
            activeBountyCount[freelancer]--;
        }
        
        emit BountyCancelled(_bountyId, bounty.client, bounty.escrowAmount, "Moderation inactive", block.timestamp);
        emit BountyStatusChanged(_bountyId, currentStatus, BountyStatus.Cancelled, block.timestamp);
    }
    
    /**
     * @notice Moderator approves cancellation request
     * @param _bountyId Bounty ID
     */
    function approveCancellation(uint256 _bountyId) external onlyRole(MODERATOR_ROLE) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        CancellationRequest storage request = cancellationRequests[_bountyId];
        
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (request.requestedAt == 0) revert BountyRegistry__CancellationNotFound();
        if (request.processed) revert BountyRegistry__AlreadyProcessed();
        if (BountyStatus(bounty.status) != BountyStatus.PendingCancellation) {
            revert BountyRegistry__CancellationNotPending();
        }
        
        // Mark as processed and approved
        request.processed = true;
        request.approved = true;
        
        // Update bounty status
        bounty.status = uint8(BountyStatus.Cancelled);
        
        // Refund escrow to client
        PaymentEscrow(paymentEscrow).refundClient(
            _bountyId,
            bounty.client,
            bounty.escrowAmount,
            "Cancellation approved by moderator"
        );
        
        // Update freelancer's active count if was claimed
        address freelancer = bountyAssignments[_bountyId];
        if (freelancer != address(0) && activeBountyCount[freelancer] > 0) {
            activeBountyCount[freelancer]--;
        }
        
        uint256 cancellationId = bountyCancellationId[_bountyId];
        emit CancellationApproved(_bountyId, cancellationId, msg.sender, bounty.escrowAmount, block.timestamp);
        emit BountyStatusChanged(_bountyId, BountyStatus.PendingCancellation, BountyStatus.Cancelled, block.timestamp);
    }
    
    /**
     * @notice Moderator rejects cancellation request
     * @param _bountyId Bounty ID
     * @param _rejectReasonHash IPFS hash of rejection reason
     */
    function rejectCancellation(uint256 _bountyId, bytes32 _rejectReasonHash) external onlyRole(MODERATOR_ROLE) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        CancellationRequest storage request = cancellationRequests[_bountyId];
        
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (request.requestedAt == 0) revert BountyRegistry__CancellationNotFound();
        if (request.processed) revert BountyRegistry__AlreadyProcessed();
        if (BountyStatus(bounty.status) != BountyStatus.PendingCancellation) {
            revert BountyRegistry__CancellationNotPending();
        }
        
        // Mark as processed but not approved
        request.processed = true;
        request.approved = false;
        
        // Determine what status to return to
        BountyStatus returnStatus = bountyAssignments[_bountyId] != address(0) 
            ? BountyStatus.InProgress 
            : BountyStatus.Open;
        
        bounty.status = uint8(returnStatus);
        
        uint256 cancellationId = bountyCancellationId[_bountyId];
        emit CancellationRejected(_bountyId, cancellationId, msg.sender, _rejectReasonHash, block.timestamp);
        emit BountyStatusChanged(_bountyId, BountyStatus.PendingCancellation, returnStatus, block.timestamp);
    }
    
    /**
     * @notice Auto-approve cancellation after review period expires (callable by anyone)
     * @param _bountyId Bounty ID
     */
    function processExpiredCancellation(uint256 _bountyId) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        CancellationRequest storage request = cancellationRequests[_bountyId];
        
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (request.requestedAt == 0) revert BountyRegistry__CancellationNotFound();
        if (request.processed) revert BountyRegistry__AlreadyProcessed();
        if (BountyStatus(bounty.status) != BountyStatus.PendingCancellation) {
            revert BountyRegistry__CancellationNotPending();
        }
        if (block.timestamp < request.reviewDeadline) {
            revert BountyRegistry__ReviewPeriodNotExpired();
        }
        
        // Auto-approve after review period
        request.processed = true;
        request.approved = true;
        
        // Update bounty status
        bounty.status = uint8(BountyStatus.Cancelled);
        
        // Refund escrow to client
        PaymentEscrow(paymentEscrow).refundClient(
            _bountyId,
            bounty.client,
            bounty.escrowAmount,
            "Cancellation auto-approved after review period"
        );
        
        // Update freelancer's active count if was claimed
        address freelancer = bountyAssignments[_bountyId];
        if (freelancer != address(0) && activeBountyCount[freelancer] > 0) {
            activeBountyCount[freelancer]--;
        }
        
        uint256 cancellationId = bountyCancellationId[_bountyId];
        emit CancellationAutoApproved(_bountyId, cancellationId, bounty.escrowAmount, block.timestamp);
        emit BountyStatusChanged(_bountyId, BountyStatus.PendingCancellation, BountyStatus.Cancelled, block.timestamp);
    }
    
    /**
     * @notice Get cancellation request details
     * @param _bountyId Bounty ID
     * @return CancellationRequest struct
     */
    function getCancellationRequest(uint256 _bountyId) external view returns (CancellationRequest memory) {
        return cancellationRequests[_bountyId];
    }
    
    // ============ BOUNTY EXPIRATION ============
    
    /**
     * @notice Expire bounty past deadline (called by Keeper)
     * @param _bountyId Bounty ID to expire
     */
    function expireBounty(uint256 _bountyId) external onlyRole(KEEPER_ROLE) {
        Bounty storage bounty = bounties[_bountyId];
        
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        if (block.timestamp <= bounty.deadline) revert BountyRegistry__BountyNotExpired();
        
        BountyStatus currentStatus = BountyStatus(bounty.status);
        
        // Only expire if still Open or InProgress
        if (currentStatus != BountyStatus.Open && currentStatus != BountyStatus.InProgress) {
            return;
        }
        
        bounty.status = uint8(BountyStatus.Expired);
        
        // Refund to client
        PaymentEscrow(paymentEscrow).refundClient(
            _bountyId,
            bounty.client,
            bounty.escrowAmount,
            "Bounty expired"
        );
        
        // Update freelancer's active count if was claimed
        address freelancer = bountyAssignments[_bountyId];
        if (freelancer != address(0) && activeBountyCount[freelancer] > 0) {
            activeBountyCount[freelancer]--;
        }
        
        emit BountyExpired(_bountyId, bounty.deadline, block.timestamp);
        emit BountyStatusChanged(_bountyId, currentStatus, BountyStatus.Expired, block.timestamp);
    }
    
    // ============ STATUS UPDATES ============
    
    bytes32 public constant SUBMISSION_MANAGER_ROLE = keccak256("SUBMISSION_MANAGER_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");

    // ============ ERROR DEFINITIONS ============


    // ... (rest of contract)

    /**
     * @notice Update bounty status (called by other contracts)
     * @param _bountyId Bounty ID
     * @param _newStatus New status
     */
    function updateBountyStatus(
        uint256 _bountyId,
        BountyStatus _newStatus
    ) external {
        // Enforce role-based access control
        if (
            !hasRole(SUBMISSION_MANAGER_ROLE, msg.sender) && 
            !hasRole(DISPUTE_RESOLVER_ROLE, msg.sender) && 
            msg.sender != address(this)
        ) {
            revert Unauthorized();
        }
        
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.bountyId == 0) revert BountyRegistry__BountyNotFound();
        
        BountyStatus oldStatus = BountyStatus(bounty.status);

        // Verify valid state transition
        if (!_isValidTransition(oldStatus, _newStatus)) {
            revert BountyRegistry__InvalidStateTransition(uint8(oldStatus), uint8(_newStatus));
        }

        // Verify escrow release for terminal states
        if (
            _newStatus == BountyStatus.Completed || 
            _newStatus == BountyStatus.Cancelled || 
            _newStatus == BountyStatus.Expired
        ) {
            if (PaymentEscrow(paymentEscrow).escrowBalance(_bountyId) > 0) {
                revert BountyRegistry__EscrowNotReleased(_bountyId);
            }
        }
        
        bounty.status = uint8(_newStatus);
        
        // Update active count if completed
        if (_newStatus == BountyStatus.Completed) {
            address freelancer = bountyAssignments[_bountyId];
            if (freelancer != address(0) && activeBountyCount[freelancer] > 0) {
                activeBountyCount[freelancer]--;
            }
        }
        
        emit BountyStatusChanged(_bountyId, oldStatus, _newStatus, block.timestamp);
    }

    function _isValidTransition(BountyStatus from, BountyStatus to) internal pure returns (bool) {
        if (from == BountyStatus.Open) {
            return to == BountyStatus.InProgress || to == BountyStatus.Cancelled || to == BountyStatus.Expired || to == BountyStatus.PendingCancellation;
        }
        if (from == BountyStatus.InProgress) {
            return to == BountyStatus.UnderReview || to == BountyStatus.Cancelled || to == BountyStatus.Expired || to == BountyStatus.PendingCancellation;
        }
        if (from == BountyStatus.UnderReview) {
            return to == BountyStatus.Completed || to == BountyStatus.Disputed || to == BountyStatus.UnderReview; // Allow redundant updates
        }
        if (from == BountyStatus.Disputed) {
            return to == BountyStatus.Completed || to == BountyStatus.Cancelled;
        }
        if (from == BountyStatus.PendingCancellation) {
            return to == BountyStatus.Cancelled || to == BountyStatus.Open || to == BountyStatus.InProgress;
        }
        return false;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get bounty details
     * @param _bountyId Bounty ID
     * @return Bounty struct
     */
    function getBounty(uint256 _bountyId) external view returns (Bounty memory) {
        return bounties[_bountyId];
    }
    
    /**
     * @notice Get active bounty count for user
     * @param _user User address
     * @return Active bounty count
     */
    function getActiveBountyCount(address _user) external view returns (uint256) {
        return activeBountyCount[_user];
    }
    
    /**
     * @notice Get max concurrent bounties for tier
     * @param _tier Reputation tier
     * @return Max concurrent bounties
     */
    function _getMaxConcurrentBounties(ReputationTier _tier) internal pure returns (uint256) {
        if (_tier == ReputationTier.Bronze) return 2;
        if (_tier == ReputationTier.Silver) return 5;
        if (_tier == ReputationTier.Gold) return 10;
        if (_tier == ReputationTier.Platinum) return 20;
        return 0;
    }
    
    /**
     * @notice Get max bounty value for tier
     * @param _tier Reputation tier
     * @return Max bounty value in wei
     */
    function _getMaxBountyValue(ReputationTier _tier) internal pure returns (uint256) {
        if (_tier == ReputationTier.Bronze) return 500 ether; // Assuming 1 ETH = $1 for simplicity
        if (_tier == ReputationTier.Silver) return 2500 ether;
        if (_tier == ReputationTier.Gold) return 10000 ether;
        if (_tier == ReputationTier.Platinum) return type(uint256).max;
        return 0;
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
    
    /**
     * @notice Configure the moderation authority
     * @dev When set to address(0), moderation is inactive and cancellations are processed immediately.
     *      The moderator can be a wallet address, an AI agent contract, or a DAO governance contract.
     *      If setting a non-zero address, MODERATOR_ROLE is granted to enable moderation functions.
     * @param _moderator New moderator address (or address(0) to disable moderation)
     */
    function setModerator(address _moderator) external onlyRole(ADMIN_ROLE) {
        address previousModerator = moderator;
        moderator = _moderator;
        
        // Grant MODERATOR_ROLE if setting a valid address
        if (_moderator != address(0)) {
            _grantRole(MODERATOR_ROLE, _moderator);
        }
        
        emit ModerationConfigured(previousModerator, _moderator, block.timestamp);
    }
    
    uint256[50] private __gap;
}
