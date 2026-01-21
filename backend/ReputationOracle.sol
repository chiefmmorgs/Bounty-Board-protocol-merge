// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Types.sol";
import "./Errors.sol";

/**
 * @title ReputationOracle
 * @notice On-chain reputation scores with off-chain AI calculation verification
 * @dev Reputation scores are calculated off-chain by AI service and verified on-chain via signatures
 */
contract ReputationOracle is Initializable, AccessControlUpgradeable, ReentrancyGuard {
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SUBMISSION_MANAGER_ROLE = keccak256("SUBMISSION_MANAGER_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    uint16 public constant BRONZE_THRESHOLD = 0;
    uint16 public constant SILVER_THRESHOLD = 800;   // Ethos mapping? adjusting to 0-2000 scale
    uint16 public constant GOLD_THRESHOLD = 1400;
    uint16 public constant PLATINUM_THRESHOLD = 1800;
    
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;
    uint256 public constant APPEAL_COOLDOWN = 30 days;
    
    // ============ STATE VARIABLES ============
    
    mapping(address => ReputationScore) public reputations;
    mapping(address => bool) public authorizedUpdaters;
    mapping(address => uint256) public lastReputationUpdate;
    mapping(address => uint256) public lastActivityTime;
    mapping(address => uint256) public disputesInitiated;
    mapping(address => uint256) public lastAppealTime;
    
    // ============ EVENTS ============
    
    event ReputationUpdated(
        address indexed user,
        uint16 qualityScore,
        uint16 reliabilityScore,
        uint16 professionalismScore,
        uint16 overallScore,
        address indexed updatedBy
    );
    
    event TierChanged(
        address indexed user,
        ReputationTier oldTier,
        ReputationTier newTier,
        uint16 overallScore,
        uint256 timestamp
    );
    
    event BountyCompleted(
        address indexed freelancer,
        uint256 indexed bountyId,
        uint256 earnings,
        uint256 totalCompleted
    );
    
    event DisputeLossRecorded(
        address indexed user,
        uint256 indexed disputeId,
        uint256 totalDisputesLost
    );
    
    event ReputationDecayed(
        address indexed user,
        uint16 decayAmount,
        uint256 inactiveDays,
        uint16 newOverallScore
    );
    
    event AdminReputationAdjustment(
        address indexed user,
        uint16 oldScore,
        uint16 newScore,
        address indexed admin,
        string reason
    );
    
    event LateSubmissionRecorded(
        address indexed freelancer,
        uint256 indexed bountyId,
        uint256 deadline,
        uint256 submittedAt
    );
    
    event AuthorizedUpdaterChanged(
        address indexed updater,
        bool authorized
    );
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // _disableInitializers();
    }
    
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert InvalidAddress();
        
        __AccessControl_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    // ============ REPUTATION UPDATES ============
    
    /**
     * @notice Update reputation scores (called by authorized AI service)
     * @param _user User whose reputation to update
     * @param _qualityScore Quality score (0-100)
     * @param _reliabilityScore Reliability score (0-100)
     * @param _professionalismScore Professionalism score (0-100)
     * @param _signature Signature from authorized updater
     */
    function updateReputation(
        address _user,
        uint16 _qualityScore,
        uint16 _reliabilityScore,
        uint16 _professionalismScore,
        bytes calldata _signature
    ) external nonReentrant {
        if (!authorizedUpdaters[msg.sender]) revert ReputationOracle__UnauthorizedUpdater();
        if (_user == address(0)) revert InvalidAddress();
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            _user,
            _qualityScore,
            _reliabilityScore,
            _professionalismScore,
            block.timestamp / 1 hours // Round to hour for signature validity window
        ));
        
        address signer = _recoverSigner(messageHash, _signature);
        if (!authorizedUpdaters[signer]) revert ReputationOracle__InvalidSignature();
        
        // Check update frequency
        if (lastReputationUpdate[_user] != 0 && block.timestamp < lastReputationUpdate[_user] + MIN_UPDATE_INTERVAL) {
            revert ReputationOracle__UpdateTooFrequent(
                lastReputationUpdate[_user],
                MIN_UPDATE_INTERVAL
            );
        }
        
        // Validate scores
        if (_qualityScore > 2000) revert ReputationOracle__ScoreOutOfBounds(_qualityScore);
        if (_reliabilityScore > 2000) revert ReputationOracle__ScoreOutOfBounds(_reliabilityScore);
        if (_professionalismScore > 2000) revert ReputationOracle__ScoreOutOfBounds(_professionalismScore);
        
        // Calculate weighted overall score (Quality: 40%, Reliability: 35%, Professionalism: 25%)
        uint16 overallScore = uint16(
            (uint256(_qualityScore) * 40 + uint256(_reliabilityScore) * 35 + uint256(_professionalismScore) * 25) / 100
        );
        
        ReputationScore storage rep = reputations[_user];
        ReputationTier oldTier = getTier(_user);
        
        rep.qualityScore = _qualityScore;
        rep.reliabilityScore = _reliabilityScore;
        rep.professionalismScore = _professionalismScore;
        rep.overallScore = overallScore;
        rep.lastUpdated = block.timestamp;
        
        // Update tier
        ReputationTier newTier = _calculateTier(overallScore);
        rep.tier = uint8(newTier);
        
        lastReputationUpdate[_user] = block.timestamp;
        
        emit ReputationUpdated(
            _user,
            _qualityScore,
            _reliabilityScore,
            _professionalismScore,
            overallScore,
            msg.sender
        );
        
        if (newTier != oldTier) {
            emit TierChanged(_user, oldTier, newTier, overallScore, block.timestamp);
        }
    }
    
    /**
     * @notice Record bounty completion (called by SubmissionManager)
     * @param _freelancer Freelancer who completed bounty
     * @param _bountyId Bounty ID
     * @param _earnings Amount earned
     */
    function recordCompletion(
        address _freelancer,
        uint256 _bountyId,
        uint256 _earnings
    ) external onlyRole(SUBMISSION_MANAGER_ROLE) {
        if (_freelancer == address(0)) revert InvalidAddress();
        
        ReputationScore storage rep = reputations[_freelancer];
        rep.totalBountiesCompleted++;
        rep.totalEarnings += _earnings;
        
        lastActivityTime[_freelancer] = block.timestamp;
        
        emit BountyCompleted(_freelancer, _bountyId, _earnings, rep.totalBountiesCompleted);
    }
    
    /**
     * @notice Record dispute loss (called by DisputeResolver)
     * @param _user User who lost dispute
     * @param _disputeId Dispute ID
     */
    function recordDisputeLoss(
        address _user,
        uint256 _disputeId
    ) external onlyRole(DISPUTE_RESOLVER_ROLE) {
        if (_user == address(0)) revert InvalidAddress();
        
        ReputationScore storage rep = reputations[_user];
        rep.disputesLost++;
        
        emit DisputeLossRecorded(_user, _disputeId, rep.disputesLost);
    }
    
    /**
     * @notice Record late submission (called by SubmissionManager)
     * @param _freelancer Freelancer who submitted late
     * @param _bountyId Bounty ID
     * @param _deadline Original deadline
     */
    function recordLateSubmission(
        address _freelancer,
        uint256 _bountyId,
        uint256 _deadline
    ) external onlyRole(SUBMISSION_MANAGER_ROLE) {
        if (_freelancer == address(0)) revert InvalidAddress();
        
        emit LateSubmissionRecorded(_freelancer, _bountyId, _deadline, block.timestamp);
    }
    
    /**
     * @notice Record activity (called by various contracts)
     * @param _user User to record activity for
     */
    function recordActivity(address _user) external {
        if (
            !hasRole(SUBMISSION_MANAGER_ROLE, msg.sender) &&
            !hasRole(DISPUTE_RESOLVER_ROLE, msg.sender)
        ) {
            revert ReputationOracle__UnauthorizedCaller();
        }
        
        lastActivityTime[_user] = block.timestamp;
    }
    
    /**
     * @notice Apply reputation decay for inactive users (called by Chainlink Keeper)
     * @param _user User to apply decay to
     */
    function applyDecay(address _user) external onlyRole(KEEPER_ROLE) {
        if (_user == address(0)) revert InvalidAddress();
        
        ReputationScore storage rep = reputations[_user];
        uint256 lastActivity = lastActivityTime[_user];
        
        if (lastActivity == 0) return; // No activity recorded yet
        
        uint256 inactiveDays = (block.timestamp - lastActivity) / 1 days;
        
        if (inactiveDays > 90) {
            // Decay: -1 point per 30 days beyond 90 days
            uint256 decayAmount = (inactiveDays - 90) / 30;
            
            if (decayAmount > 0) {
                uint16 decay = uint16(decayAmount > 65535 ? 65535 : decayAmount);
                
                // Apply decay with floor at 0
                rep.overallScore = rep.overallScore > decay ? rep.overallScore - decay : 0;
                rep.qualityScore = rep.qualityScore > decay ? rep.qualityScore - decay : 0;
                rep.reliabilityScore = rep.reliabilityScore > decay ? rep.reliabilityScore - decay : 0;
                
                rep.lastUpdated = block.timestamp;
                
                emit ReputationDecayed(_user, decay, inactiveDays, rep.overallScore);
            }
        }
    }
    
    /**
     * @notice Admin adjustment of reputation (emergency use only)
     * @param _user User to adjust
     * @param _newOverallScore New overall score
     * @param _reason Reason for adjustment
     */
    function adminAdjustReputation(
        address _user,
        uint16 _newOverallScore,
        string calldata _reason
    ) external onlyRole(ADMIN_ROLE) {
        if (_user == address(0)) revert InvalidAddress();
        if (_newOverallScore > 2000) revert ReputationOracle__ScoreOutOfBounds(_newOverallScore);
        
        ReputationScore storage rep = reputations[_user];
        uint16 oldScore = rep.overallScore;
        
        // Limit adjustment to ±100 points (approx 5% of range)
        int32 diff = int32(uint32(_newOverallScore)) - int32(uint32(oldScore));
        if (diff > 100 || diff < -100) revert ReputationOracle__InvalidAdjustmentRange();
        
        rep.overallScore = _newOverallScore;
        rep.lastUpdated = block.timestamp;
        
        emit AdminReputationAdjustment(_user, oldScore, _newOverallScore, msg.sender, _reason);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get reputation score for user
     * @param _user User address
     * @return Reputation score struct
     */
    function getReputation(address _user) external view returns (ReputationScore memory) {
        return reputations[_user];
    }
    
    /**
     * @notice Get reputation tier for user
     * @param _user User address
     * @return Reputation tier
     */
    function getTier(address _user) public view returns (ReputationTier) {
        return _calculateTier(reputations[_user].overallScore);
    }
    
    /**
     * @notice Check if user meets minimum reputation requirement
     * @param _user User address
     * @param _minRep Minimum reputation required
     * @return True if user meets requirement
     */
    function meetsRepRequirement(address _user, uint16 _minRep) external view returns (bool) {
        return reputations[_user].overallScore >= _minRep;
    }
    
    /**
     * @notice Record dispute initiation (for tracking)
     * @param _user User who initiated dispute
     */
    function recordDisputeInitiation(address _user) external onlyRole(DISPUTE_RESOLVER_ROLE) {
        disputesInitiated[_user]++;
    }
    
    /**
     * @notice Get dispute statistics for user
     * @param _user User address
     * @return initiated Total disputes initiated
     * @return lost Total disputes lost
     * @return winRate Win rate percentage (0-100)
     */
    function getDisputeStats(address _user) external view returns (
        uint256 initiated,
        uint256 lost,
        uint256 winRate
    ) {
        initiated = disputesInitiated[_user];
        lost = reputations[_user].disputesLost;
        winRate = initiated > 0 ? ((initiated - lost) * 100) / initiated : 100;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set authorized updater (AI service)
     * @param _updater Address to authorize/deauthorize
     * @param _authorized True to authorize, false to deauthorize
     */
    function setAuthorizedUpdater(
        address _updater,
        bool _authorized
    ) external onlyRole(ADMIN_ROLE) {
        if (_updater == address(0)) revert InvalidAddress();
        
        authorizedUpdaters[_updater] = _authorized;
        
        emit AuthorizedUpdaterChanged(_updater, _authorized);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Calculate tier from overall score
     * @param _score Overall reputation score
     * @return Reputation tier
     */
    function _calculateTier(uint16 _score) internal pure returns (ReputationTier) {
        if (_score >= PLATINUM_THRESHOLD) return ReputationTier.Platinum;
        if (_score >= GOLD_THRESHOLD) return ReputationTier.Gold;
        if (_score >= SILVER_THRESHOLD) return ReputationTier.Silver;
        return ReputationTier.Bronze;
    }
    
    /**
     * @notice Recover signer from signature
     * @param _messageHash Message hash
     * @param _signature Signature
     * @return Signer address
     */
    function _recoverSigner(
        bytes32 _messageHash,
        bytes memory _signature
    ) internal pure returns (address) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
        );
        
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);
        
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
    
    /**
     * @notice Split signature into r, s, v
     * @param _signature Signature bytes
     * @return r R component
     * @return s S component
     * @return v V component
     */
    function _splitSignature(bytes memory _signature) internal pure returns (
        bytes32 r,
        bytes32 s,
        uint8 v
    ) {
        require(_signature.length == 65, "Invalid signature length");
        
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
    }
    
    // ============ UPGRADE SAFETY GAP ============
    
    uint256[50] private __gap;
}
