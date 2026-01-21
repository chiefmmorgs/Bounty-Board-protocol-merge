// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/Types.sol";

/**
 * @title ReputationOracleTest
 * @notice Comprehensive tests for ReputationOracle contract
 * @dev Tests reputation updates, tier calculations, decay, and access control
 */
contract ReputationOracleTest is Test {
    
    ReputationOracle public oracle;
    
    address public admin = address(0xAD1);
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public submissionManager = address(0x511);
    address public disputeResolver = address(0xD15);
    address public keeper = address(0x61);
    address public user1 = address(0x101);
    address public user2 = address(0x102);
    
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
    
    function setUp() public {
        oracle = new ReputationOracle();
        oracle.initialize(admin);
        
        // Setup roles
        vm.startPrank(admin);
        oracle.setAuthorizedUpdater(aiService, true);
        oracle.grantRole(oracle.SUBMISSION_MANAGER_ROLE(), submissionManager);
        oracle.grantRole(oracle.DISPUTE_RESOLVER_ROLE(), disputeResolver);
        oracle.grantRole(oracle.KEEPER_ROLE(), keeper);
        vm.stopPrank();
    }
    
    // ============ INITIALIZATION TESTS ============
    
    function test_Initialize_SetsAdminRole() public {
        assertTrue(oracle.hasRole(oracle.ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
    }
    
    function test_Initialize_RevertsIfZeroAddress() public {
        ReputationOracle newOracle = new ReputationOracle();
        vm.expectRevert(InvalidAddress.selector);
        newOracle.initialize(address(0));
    }
    
    function test_Initialize_CannotBeCalledTwice() public {
        vm.expectRevert();
        oracle.initialize(admin);
    }
    
    // ============ REPUTATION UPDATE TESTS ============
    
    function test_UpdateReputation_SucceedsWithValidSignature() public {
        uint16 quality = 1600;      // was 80
        uint16 reliability = 1500;  // was 75
        uint16 professionalism = 1700; // was 85
        
        bytes memory signature = _generateSignature(
            user1,
            quality,
            reliability,
            professionalism,
            aiServicePrivateKey
        );
        
        // Expected: (1600*40 + 1500*35 + 1700*25) / 100 = 1590
        vm.expectEmit(true, true, false, true);
        emit ReputationUpdated(user1, quality, reliability, professionalism, 1590, aiService);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, quality, reliability, professionalism, signature);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.qualityScore, quality);
        assertEq(rep.reliabilityScore, reliability);
        assertEq(rep.professionalismScore, professionalism);
        assertEq(rep.overallScore, 1590);
    }
    
    function test_UpdateReputation_RevertsIfUnauthorizedUpdater() public {
        bytes memory signature = _generateSignature(user1, 1600, 1500, 1700, aiServicePrivateKey);
        
        vm.expectRevert(ReputationOracle__UnauthorizedUpdater.selector);
        vm.prank(address(999));
        oracle.updateReputation(user1, 1600, 1500, 1700, signature);
    }
    
    function test_UpdateReputation_RevertsIfInvalidSignature() public {
        uint256 wrongKey = 0xBAD;
        bytes memory signature = _generateSignature(user1, 1600, 1500, 1700, wrongKey);
        
        vm.expectRevert(ReputationOracle__InvalidSignature.selector);
        vm.prank(aiService);
        oracle.updateReputation(user1, 1600, 1500, 1700, signature);
    }
    
    function test_UpdateReputation_RevertsIfTooFrequent() public {
        bytes memory sig1 = _generateSignature(user1, 1600, 1500, 1700, aiServicePrivateKey);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, 1600, 1500, 1700, sig1);
        
        // Try to update again immediately
        bytes memory sig2 = _generateSignature(user1, 1700, 1600, 1800, aiServicePrivateKey);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationOracle__UpdateTooFrequent.selector,
                block.timestamp,
                1 hours
            )
        );
        vm.prank(aiService);
        oracle.updateReputation(user1, 1700, 1600, 1800, sig2);
    }
    
    function test_UpdateReputation_SucceedsAfterMinInterval() public {
        bytes memory sig1 = _generateSignature(user1, 1600, 1500, 1700, aiServicePrivateKey);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, 1600, 1500, 1700, sig1);
        
        // Wait 1 hour
        vm.warp(block.timestamp + 1 hours);
        
        bytes memory sig2 = _generateSignature(user1, 1700, 1600, 1800, aiServicePrivateKey);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, 1700, 1600, 1800, sig2);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.qualityScore, 1700);
    }
    
    function test_UpdateReputation_RevertsIfScoreOutOfBounds() public {
        bytes memory signature = _generateSignature(user1, 2001, 1500, 1700, aiServicePrivateKey);
        
        vm.expectRevert(abi.encodeWithSelector(ReputationOracle__ScoreOutOfBounds.selector, 2001));
        vm.prank(aiService);
        oracle.updateReputation(user1, 2001, 1500, 1700, signature);
    }
    
    function test_UpdateReputation_CalculatesOverallScoreCorrectly() public {
        // Test weighted average: Quality 40%, Reliability 35%, Professionalism 25%
        uint16 quality = 2000;
        uint16 reliability = 1600;
        uint16 professionalism = 1200;
        
        bytes memory signature = _generateSignature(user1, quality, reliability, professionalism, aiServicePrivateKey);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, quality, reliability, professionalism, signature);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        // (2000*40 + 1600*35 + 1200*25) / 100 = 1660
        assertEq(rep.overallScore, 1660);
    }
    
    // ============ TIER CALCULATION TESTS ============
    // Thresholds: Bronze<800, Silver 800-1399, Gold 1400-1799, Platinum 1800+
    
    function test_GetTier_ReturnsBronzeForScoreBelow40() public {
        _setReputation(user1, 600, 600, 600); // Overall: 600 (Bronze)
        assertEq(uint8(oracle.getTier(user1)), uint8(ReputationTier.Bronze));
    }
    
    function test_GetTier_ReturnsSilverForScore40To69() public {
        _setReputation(user1, 1000, 1000, 1000); // Overall: 1000 (Silver)
        assertEq(uint8(oracle.getTier(user1)), uint8(ReputationTier.Silver));
    }
    
    function test_GetTier_ReturnsGoldForScore70To89() public {
        _setReputation(user1, 1500, 1500, 1500); // Overall: 1500 (Gold)
        assertEq(uint8(oracle.getTier(user1)), uint8(ReputationTier.Gold));
    }
    
    function test_GetTier_ReturnsPlatinumForScore90Plus() public {
        _setReputation(user1, 1900, 1900, 1900); // Overall: 1900 (Platinum)
        assertEq(uint8(oracle.getTier(user1)), uint8(ReputationTier.Platinum));
    }
    
    function test_UpdateReputation_EmitsTierChangedEvent() public {
        // Start at Bronze
        _setReputation(user1, 600, 600, 600);
        
        vm.warp(block.timestamp + 1 hours);
        
        // Update to Silver - generate signature AFTER warp to match hour rounding
        bytes memory signature = _generateSignature(user1, 1000, 1000, 1000, aiServicePrivateKey);
        
        vm.expectEmit(true, true, false, true, address(oracle));
        emit ReputationUpdated(user1, 1000, 1000, 1000, 1000, aiService);
        
        vm.expectEmit(true, false, false, true, address(oracle));
        emit TierChanged(user1, ReputationTier.Bronze, ReputationTier.Silver, 1000, block.timestamp);
        
        vm.prank(aiService);
        oracle.updateReputation(user1, 1000, 1000, 1000, signature);
    }
    
    // ============ BOUNTY COMPLETION TESTS ============
    
    function test_RecordCompletion_IncrementsCountAndEarnings() public {
        vm.prank(submissionManager);
        oracle.recordCompletion(user1, 1, 1 ether);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.totalBountiesCompleted, 1);
        assertEq(rep.totalEarnings, 1 ether);
    }
    
    function test_RecordCompletion_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        oracle.recordCompletion(user1, 1, 1 ether);
    }
    
    function test_RecordCompletion_RevertsIfZeroAddress() public {
        vm.expectRevert(InvalidAddress.selector);
        vm.prank(submissionManager);
        oracle.recordCompletion(address(0), 1, 1 ether);
    }
    
    function test_RecordCompletion_UpdatesActivityTime() public {
        uint256 beforeTime = oracle.lastActivityTime(user1);
        
        vm.prank(submissionManager);
        oracle.recordCompletion(user1, 1, 1 ether);
        
        uint256 afterTime = oracle.lastActivityTime(user1);
        assertEq(afterTime, block.timestamp);
        assertTrue(afterTime > beforeTime);
    }
    
    // ============ DISPUTE LOSS TESTS ============
    
    function test_RecordDisputeLoss_IncrementsCounter() public {
        vm.prank(disputeResolver);
        oracle.recordDisputeLoss(user1, 1);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.disputesLost, 1);
    }
    
    function test_RecordDisputeLoss_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        oracle.recordDisputeLoss(user1, 1);
    }
    
    // ============ DECAY TESTS ============
    
    function test_ApplyDecay_DoesNothingIfLessThan90DaysInactive() public {
        _setReputation(user1, 1600, 1600, 1600); // Overall: 1600
        
        vm.prank(submissionManager);
        oracle.recordActivity(user1);
        
        // Fast forward 89 days
        vm.warp(block.timestamp + 89 days);
        
        vm.prank(keeper);
        oracle.applyDecay(user1);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.overallScore, 1600); // No decay
    }
    
    function test_ApplyDecay_Decays1PointPer30DaysBeyond90Days() public {
        _setReputation(user1, 1600, 1600, 1600); // Overall: 1600
        
        vm.prank(submissionManager);
        oracle.recordActivity(user1);
        
        // Fast forward 120 days (90 + 30)
        vm.warp(block.timestamp + 120 days);
        
        vm.prank(keeper);
        oracle.applyDecay(user1);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.overallScore, 1599); // Decayed by 1
    }
    
    function test_ApplyDecay_DecaysMultiplePoints() public {
        _setReputation(user1, 1600, 1600, 1600); // Overall: 1600
        
        vm.prank(submissionManager);
        oracle.recordActivity(user1);
        
        // Fast forward 180 days (90 + 90 = 3 periods of 30 days)
        vm.warp(block.timestamp + 180 days);
        
        vm.prank(keeper);
        oracle.applyDecay(user1);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.overallScore, 1597); // Decayed by 3
    }
    
    function test_ApplyDecay_FloorsAtZero() public {
        _setReputation(user1, 100, 100, 100); // Overall: 100 (small value)
        
        vm.prank(submissionManager);
        oracle.recordActivity(user1);
        
        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);
        
        vm.prank(keeper);
        oracle.applyDecay(user1);
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.overallScore, 91); // 100 - (365-90)/30 = 100 - 9 = 91
    }
    
    function test_ApplyDecay_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        oracle.applyDecay(user1);
    }
    
    // ============ ADMIN ADJUSTMENT TESTS ============
    
    function test_AdminAdjustReputation_UpdatesScore() public {
        _setReputation(user1, 1000, 1000, 1000); // Overall: 1000
        
        vm.prank(admin);
        oracle.adminAdjustReputation(user1, 1050, "Manual correction");
        
        ReputationScore memory rep = oracle.getReputation(user1);
        assertEq(rep.overallScore, 1050);
    }
    
    function test_AdminAdjustReputation_RevertsIfExceedsRange() public {
        _setReputation(user1, 1000, 1000, 1000); // Overall: 1000
        
        vm.expectRevert(ReputationOracle__InvalidAdjustmentRange.selector);
        vm.prank(admin);
        oracle.adminAdjustReputation(user1, 1150, "Too large"); // +150 exceeds ±100 limit
    }
    
    function test_AdminAdjustReputation_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        oracle.adminAdjustReputation(user1, 55, "Unauthorized");
    }
    
    // ============ DISPUTE STATS TESTS ============
    
    function test_GetDisputeStats_ReturnsCorrectWinRate() public {
        vm.startPrank(disputeResolver);
        oracle.recordDisputeInitiation(user1);
        oracle.recordDisputeInitiation(user1);
        oracle.recordDisputeInitiation(user1);
        oracle.recordDisputeLoss(user1, 1);
        vm.stopPrank();
        
        (uint256 initiated, uint256 lost, uint256 winRate) = oracle.getDisputeStats(user1);
        
        assertEq(initiated, 3);
        assertEq(lost, 1);
        assertEq(winRate, 66); // (3-1)*100/3 = 66
    }
    
    function test_GetDisputeStats_Returns100PercentIfNoDisputes() public {
        (uint256 initiated, uint256 lost, uint256 winRate) = oracle.getDisputeStats(user1);
        
        assertEq(initiated, 0);
        assertEq(lost, 0);
        assertEq(winRate, 100);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    function _setReputation(address user, uint16 quality, uint16 reliability, uint16 professionalism) internal {
        bytes memory signature = _generateSignature(user, quality, reliability, professionalism, aiServicePrivateKey);
        
        vm.prank(aiService);
        oracle.updateReputation(user, quality, reliability, professionalism, signature);
    }
    
    function _generateSignature(
        address user,
        uint16 quality,
        uint16 reliability,
        uint16 professionalism,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            quality,
            reliability,
            professionalism,
            block.timestamp / 1 hours
        ));
        
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedMessageHash);
        
        return abi.encodePacked(r, s, v);
    }
}
