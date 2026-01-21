// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./Types.sol";
import "./Errors.sol";
import "./ReputationOracle.sol";
import "./BountyRegistry.sol";

/**
 * @title PaymentEscrow
 * @notice Secure fund management with automated release logic
 * @dev Implements escrow state machine with reentrancy protection
 */
contract PaymentEscrow is Initializable, AccessControlUpgradeable, ReentrancyGuard, PausableUpgradeable {
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOUNTY_REGISTRY_ROLE = keccak256("BOUNTY_REGISTRY_ROLE");
    bytes32 public constant SUBMISSION_MANAGER_ROLE = keccak256("SUBMISSION_MANAGER_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    // ============ STATE VARIABLES ============
    
    mapping(address => EscrowAccount) public escrowAccounts;
    mapping(uint256 => uint256) public escrowBalance; // bountyId => amount
    mapping(address => uint256) public lastWithdrawalTime;
    
    bool public referencesSet;


    
    uint256 public platformFeePercentage; // Basis points (1000 = 10%)
    address public platformTreasury;
    uint256 public platformFeeBalance;
    
    address public bountyRegistry;
    address public submissionManager;
    address public disputeResolver;
    address public reputationOracle;
    
    // ============ EVENTS ============
    
    event FundsDeposited(address indexed client, uint256 indexed bountyId, uint256 amount);
    event FundsLocked(address indexed client, uint256 indexed bountyId, uint256 amount);
    event PaymentReleased(
        uint256 indexed bountyId,
        address indexed freelancer,
        uint256 amount,
        uint256 platformFee,
        ReputationTier tier
    );
    event RefundIssued(uint256 indexed bountyId, address indexed client, uint256 amount, string reason);
    event Withdrawal(address indexed user, uint256 amount, ReputationTier tier, uint256 remainingBalance);
    event PlatformFeesWithdrawn(address indexed treasury, uint256 amount, uint256 totalFeesCollected);
    event PartialPaymentReleased(
        uint256 indexed bountyId,
        address indexed freelancer,
        address indexed client,
        uint256 freelancerAmount,
        uint256 clientRefund,
        uint256 platformFee
    );
    event PlatformFeeUpdated(uint256 oldFeePercentage, uint256 newFeePercentage, address indexed updatedBy);
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // _disableInitializers();
    }
    
    function initialize(
        address admin,
        address _platformTreasury,
        uint256 _platformFeePercentage
    ) external initializer {
        if (admin == address(0) || _platformTreasury == address(0)) revert InvalidAddress();
        if (_platformFeePercentage > 2000) revert PaymentEscrow__InvalidFeePercentage(); // Max 20%
        
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, _platformTreasury);
        
        platformTreasury = _platformTreasury;
        platformFeePercentage = _platformFeePercentage;
    }
    
    // ============ ESCROW MANAGEMENT ============
    
    /**
     * @notice Deposit funds to escrow (called when creating bounty)
     * @param _client Client address
     * @param _bountyId Bounty ID
     */
    function depositToEscrow(
        address _client,
        uint256 _bountyId
    ) external payable onlyRole(BOUNTY_REGISTRY_ROLE) {
        if (_client == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert PaymentEscrow__ZeroAmount();
        
        escrowBalance[_bountyId] = msg.value;
        
        emit FundsDeposited(_client, _bountyId, msg.value);
    }
    
    /**
     * @notice Lock funds for active bounty
     * @param _client Client address
     * @param _amount Amount to lock
     * @param _bountyId Bounty ID
     */
    function lockFunds(
        address _client,
        uint256 _amount,
        uint256 _bountyId
    ) external onlyRole(BOUNTY_REGISTRY_ROLE) whenNotPaused {
        if (_client == address(0)) revert InvalidAddress();
        if (_amount == 0) revert PaymentEscrow__ZeroAmount();
        
        EscrowAccount storage account = escrowAccounts[_client];
        account.lockedAmount += _amount;
        
        emit FundsLocked(_client, _bountyId, _amount);
    }
    
    /**
     * @notice Release payment to freelancer (called on acceptance)
     * @param _bountyId Bounty ID
     * @param _freelancer Freelancer address
     * @param _amount Amount to release
     */
    function releasePayment(
        uint256 _bountyId,
        address _freelancer,
        uint256 _amount
    ) external nonReentrant onlyRole(SUBMISSION_MANAGER_ROLE) whenNotPaused {
        if (_freelancer == address(0)) revert InvalidAddress();
        if (escrowBalance[_bountyId] == 0) revert PaymentEscrow__InsufficientEscrowBalance(_bountyId);
        if (_amount != escrowBalance[_bountyId]) revert PaymentEscrow__AmountMismatch(escrowBalance[_bountyId], _amount);
        
        // Verify bounty state
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(_bountyId);
        BountyStatus status = BountyStatus(bounty.status);
        if (status != BountyStatus.UnderReview && status != BountyStatus.Disputed) {
            revert PaymentEscrow__InvalidBountyState();
        }
        
        // Calculate platform fee
        uint256 platformFee = (_amount * platformFeePercentage) / 10000;
        uint256 freelancerPayment = _amount - platformFee;
        
        // Update balances (EFFECTS before INTERACTIONS)
        escrowBalance[_bountyId] = 0;
        escrowAccounts[_freelancer].availableAmount += freelancerPayment;
        platformFeeBalance += platformFee;
        
        // Get tier for event
        ReputationTier tier = ReputationOracle(reputationOracle).getTier(_freelancer);
        
        emit PaymentReleased(_bountyId, _freelancer, freelancerPayment, platformFee, tier);
    }
    
    /**
     * @notice Refund to client (called on cancellation/dispute resolution)
     * @param _bountyId Bounty ID
     * @param _client Client address
     * @param _amount Amount to refund
     * @param _reason Refund reason
     */
    function refundClient(
        uint256 _bountyId,
        address _client,
        uint256 _amount,
        string calldata _reason
    ) external nonReentrant {
        if (
            !hasRole(BOUNTY_REGISTRY_ROLE, msg.sender) &&
            !hasRole(DISPUTE_RESOLVER_ROLE, msg.sender)
        ) {
            revert PaymentEscrow__UnauthorizedCaller();
        }
        
        if (_client == address(0)) revert InvalidAddress();
        if (escrowBalance[_bountyId] < _amount) {
            revert PaymentEscrow__InsufficientEscrowBalance(_bountyId);
        }

        // Verify bounty state
        Bounty memory bounty = BountyRegistry(bountyRegistry).getBounty(_bountyId);
        BountyStatus status = BountyStatus(bounty.status);
        if (
            status != BountyStatus.Cancelled && 
            status != BountyStatus.Expired && 
            status != BountyStatus.Disputed
        ) {
            revert PaymentEscrow__InvalidBountyState();
        }
        
        // Update balances (EFFECTS before INTERACTIONS)
        escrowBalance[_bountyId] -= _amount;
        escrowAccounts[_client].availableAmount += _amount;
        
        if (escrowAccounts[_client].lockedAmount >= _amount) {
            escrowAccounts[_client].lockedAmount -= _amount;
        }
        
        emit RefundIssued(_bountyId, _client, _amount, _reason);
    }
    
    /**
     * @notice Release partial payment (for dispute resolution)
     * @param _bountyId Bounty ID
     * @param _freelancer Freelancer address
     * @param _client Client address
     * @param _percentage Percentage to freelancer (0-100)
     */
    function releasePartialPayment(
        uint256 _bountyId,
        address _freelancer,
        address _client,
        uint256 _percentage
    ) external nonReentrant onlyRole(DISPUTE_RESOLVER_ROLE) {
        if (_freelancer == address(0) || _client == address(0)) revert InvalidAddress();
        if (_percentage > 100) revert DisputeResolver__InvalidPaymentPercentage();
        if (escrowBalance[_bountyId] == 0) revert PaymentEscrow__InsufficientEscrowBalance(_bountyId);
        
        uint256 totalAmount = escrowBalance[_bountyId];
        
        // Calculate amounts
        uint256 freelancerAmount = (totalAmount * _percentage) / 100;
        uint256 clientRefund = totalAmount - freelancerAmount;
        uint256 platformFee = (freelancerAmount * platformFeePercentage) / 10000;
        
        freelancerAmount -= platformFee;
        
        // Update balances (EFFECTS before INTERACTIONS)
        escrowBalance[_bountyId] = 0;
        escrowAccounts[_freelancer].availableAmount += freelancerAmount;
        escrowAccounts[_client].availableAmount += clientRefund;
        platformFeeBalance += platformFee;
        
        if (escrowAccounts[_client].lockedAmount >= totalAmount) {
            escrowAccounts[_client].lockedAmount -= totalAmount;
        }
        
        emit PartialPaymentReleased(
            _bountyId,
            _freelancer,
            _client,
            freelancerAmount,
            clientRefund,
            platformFee
        );
    }
    
    /**
     * @notice Freelancer withdraws available balance
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant {
        if (_amount == 0) revert PaymentEscrow__ZeroAmount();
        
        EscrowAccount storage account = escrowAccounts[msg.sender];
        
        if (account.availableAmount < _amount) {
            revert PaymentEscrow__InsufficientBalance(_amount, account.availableAmount);
        }
        
        // Check withdrawal frequency based on tier
        ReputationTier tier = ReputationOracle(reputationOracle).getTier(msg.sender);
        uint256 minInterval = _getMinWithdrawalInterval(tier);
        
        if (block.timestamp < lastWithdrawalTime[msg.sender] + minInterval) {
            revert PaymentEscrow__WithdrawalTooFrequent(
                lastWithdrawalTime[msg.sender] + minInterval
            );
        }
        
        // Update state (EFFECTS before INTERACTIONS)
        account.availableAmount -= _amount;
        lastWithdrawalTime[msg.sender] = block.timestamp;
        
        uint256 remainingBalance = account.availableAmount;
        
        // Transfer funds
        (bool success, ) = msg.sender.call{value: _amount}("");
        if (!success) revert PaymentEscrow__TransferFailed();
        
        emit Withdrawal(msg.sender, _amount, tier, remainingBalance);
    }
    
    /**
     * @notice Platform withdraws accumulated fees
     */
    function withdrawPlatformFees() external nonReentrant onlyRole(TREASURY_ROLE) {
        uint256 amount = platformFeeBalance;
        if (amount == 0) revert PaymentEscrow__ZeroAmount();
        
        // Update state (EFFECTS before INTERACTIONS)
        platformFeeBalance = 0;
        
        // Transfer funds
        (bool success, ) = platformTreasury.call{value: amount}("");
        if (!success) revert PaymentEscrow__TransferFailed();
        
        emit PlatformFeesWithdrawn(platformTreasury, amount, amount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get escrow account details
     * @param _user User address
     * @return Escrow account struct
     */
    function getEscrowAccount(address _user) external view returns (EscrowAccount memory) {
        return escrowAccounts[_user];
    }
    
    /**
     * @notice Get minimum withdrawal interval for tier
     * @param _tier Reputation tier
     * @return Minimum interval in seconds
     */
    function _getMinWithdrawalInterval(ReputationTier _tier) internal pure returns (uint256) {
        if (_tier == ReputationTier.Bronze) return 7 days;
        if (_tier == ReputationTier.Silver) return 3 days;
        if (_tier == ReputationTier.Gold) return 1 days;
        return 0; // Platinum: instant
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set contract references
     * @param _bountyRegistry BountyRegistry address
     * @param _submissionManager SubmissionManager address
     * @param _disputeResolver DisputeResolver address
     * @param _reputationOracle ReputationOracle address
     */
    function setContractReferences(
        address _bountyRegistry,
        address _submissionManager,
        address _disputeResolver,
        address _reputationOracle
    ) external onlyRole(ADMIN_ROLE) {
        if (referencesSet) revert PaymentEscrow__ReferencesAlreadySet();
        if (
            _bountyRegistry == address(0) ||
            _submissionManager == address(0) ||
            _disputeResolver == address(0) ||
            _reputationOracle == address(0)
        ) revert InvalidAddress();
        
        bountyRegistry = _bountyRegistry;
        submissionManager = _submissionManager;
        disputeResolver = _disputeResolver;
        reputationOracle = _reputationOracle;
        
        referencesSet = true;
    }
    
    /**
     * @notice Update platform fee percentage
     * @param _newFeePercentage New fee percentage (basis points)
     */
    function setPlatformFee(uint256 _newFeePercentage) external onlyRole(ADMIN_ROLE) {
        if (_newFeePercentage > 2000) revert PaymentEscrow__InvalidFeePercentage(); // Max 20%
        
        uint256 oldFee = platformFeePercentage;
        platformFeePercentage = _newFeePercentage;
        
        emit PlatformFeeUpdated(oldFee, _newFeePercentage, msg.sender);
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function _authorizeUpgrade(address newImplementation) internal onlyRole(ADMIN_ROLE) {}
    
    // ============ UPGRADE SAFETY GAP ============
    
    uint256[50] private __gap;
}
