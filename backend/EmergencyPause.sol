// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./Errors.sol";

interface IPausable {
    function pause() external;
    function unpause() external;
}

/**
 * @title EmergencyPause
 * @notice Circuit breaker for critical vulnerabilities
 * @dev Can pause all platform operations in case of emergency
 */
contract EmergencyPause is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    
    // ============ CONSTANTS ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public constant MAX_PAUSE_DURATION = 7 days;
    
    // ============ STATE VARIABLES ============
    
    mapping(address => bool) public pausers;
    uint256 public pausedAt;
    uint256 public maxPauseDuration;
    address public emergencyAdmin;
    
    struct PauseEvent {
        uint256 pausedAt;
        uint256 unpausedAt;
        address pausedBy;
        address unpausedBy;
    }
    
    PauseEvent[] public pauseHistory;
    
    // ============ EVENTS ============
    
    event ContractPaused(address indexed pausedBy, string reason, uint256 timestamp);
    event ContractUnpaused(address indexed unpausedBy, uint256 timestamp);
    event PauserAuthorizationChanged(address indexed pauser, bool authorized);
    event MaxPauseDurationUpdated(uint256 oldDuration, uint256 newDuration);
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // _disableInitializers();
    }
    
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert InvalidAddress();
        
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        
        emergencyAdmin = admin;
        maxPauseDuration = MAX_PAUSE_DURATION;
        pausers[admin] = true;
    }
    
    // ============ PAUSE MANAGEMENT ============
    
    /**
     * @notice Pause all contract operations
     * @param _reason Reason for pause
     */
    function pauseSystem(string calldata _reason) external {
        if (!pausers[msg.sender] && !hasRole(PAUSER_ROLE, msg.sender)) {
            revert EmergencyPause__NotPauser();
        }
        
        if (paused()) revert EmergencyPause__AlreadyPaused();
        
        _pause();
        pausedAt = block.timestamp;
        
        // Record pause event
        pauseHistory.push(PauseEvent({
            pausedAt: block.timestamp,
            unpausedAt: 0,
            pausedBy: msg.sender,
            unpausedBy: address(0)
        }));
        
        emit ContractPaused(msg.sender, _reason, block.timestamp);
    }
    
    /**
     * @notice Unpause after fix deployment
     */
    function unpauseSystem() external onlyRole(ADMIN_ROLE) {
        if (!paused()) revert EmergencyPause__NotPaused();
        
        _unpause();
        
        // Update pause history
        if (pauseHistory.length > 0) {
            pauseHistory[pauseHistory.length - 1].unpausedAt = block.timestamp;
            pauseHistory[pauseHistory.length - 1].unpausedBy = msg.sender;
        }
        
        pausedAt = 0;
        
        emit ContractUnpaused(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Check if system is paused
     * @return True if paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
    
    /**
     * @notice Check if max pause duration exceeded
     * @return True if exceeded
     */
    function isPauseDurationExceeded() external view returns (bool) {
        if (!paused()) return false;
        return block.timestamp > pausedAt + maxPauseDuration;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Add/remove pauser
     * @param _pauser Address to authorize/deauthorize
     * @param _authorized True to authorize, false to deauthorize
     */
    function setPauser(address _pauser, bool _authorized) external onlyRole(ADMIN_ROLE) {
        if (_pauser == address(0)) revert InvalidAddress();
        
        pausers[_pauser] = _authorized;
        
        if (_authorized) {
            _grantRole(PAUSER_ROLE, _pauser);
        } else {
            _revokeRole(PAUSER_ROLE, _pauser);
        }
        
        emit PauserAuthorizationChanged(_pauser, _authorized);
    }
    
    /**
     * @notice Update max pause duration
     * @param _newDuration New duration in seconds
     */
    function setMaxPauseDuration(uint256 _newDuration) external onlyRole(ADMIN_ROLE) {
        if (_newDuration > 30 days) revert EmergencyPause__MaxPauseDurationExceeded();
        
        uint256 oldDuration = maxPauseDuration;
        maxPauseDuration = _newDuration;
        
        emit MaxPauseDurationUpdated(oldDuration, _newDuration);
    }
    
    /**
     * @notice Get pause history count
     * @return Number of pause events
     */
    function getPauseHistoryCount() external view returns (uint256) {
        return pauseHistory.length;
    }
    
    // ============ TARGET CONTROLS ============
    


    /**
     * @notice Pause specific target contract
     * @param _target Contract to pause
     */
    function pauseTarget(address _target) external {
        if (!pausers[msg.sender] && !hasRole(PAUSER_ROLE, msg.sender)) {
            revert EmergencyPause__NotPauser();
        }
        IPausable(_target).pause();
    }
    
    /**
     * @notice Unpause specific target contract
     * @param _target Contract to unpause
     */
    function unpauseTarget(address _target) external onlyRole(ADMIN_ROLE) {
        IPausable(_target).unpause();
    }
    
    // ============ UPGRADE SAFETY GAP ============
    
    uint256[50] private __gap;
}
