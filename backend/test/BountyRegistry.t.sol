// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/Types.sol";

/**
 * @title BountyRegistryTest
 * @notice Comprehensive tests for BountyRegistry contract
 * @dev Tests bounty creation, claiming, cancellation, and expiration
 */
contract BountyRegistryTest is Test {
    
    BountyRegistry public registry;
    ReputationOracle public oracle;
    PaymentEscrow public escrow;
    
    address public admin = address(0xAD1);
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public client = address(0xC11);
    address public freelancer1 = address(0xF11);
    address public freelancer2 = address(0xF12);
    address public keeper = address(0x61);
    
    uint256 public constant MIN_ESCROW = 0.001 ether;
    
    function setUp() public {
        // Deploy contracts
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        registry = new BountyRegistry();
        
        // Initialize
        oracle.initialize(admin);
        escrow.initialize(admin, admin, 1000); // 10% platform fee
        registry.initialize(admin, address(oracle), address(escrow));
        
        // Setup roles
        vm.startPrank(admin);
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), address(registry));
        registry.grantRole(registry.KEEPER_ROLE(), keeper);
        
        // Set contract references
        escrow.setContractReferences(
            address(registry),
            address(0x511), // mock submissionManager
            address(0xD15), // mock disputeResolver
            address(oracle)
        );
        oracle.setAuthorizedUpdater(aiService, true);
        vm.stopPrank();
        
        // Fund test accounts
        vm.deal(client, 10000 ether);
        vm.deal(freelancer1, 100 ether);
        vm.deal(freelancer2, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
        vm.deal(keeper, 100 ether);
    }
    
    // ============ BOUNTY CREATION TESTS ============
    
    function test_CreateBounty_SucceedsWithValidParams() public {
        bytes32 requirementsHash = keccak256("Requirements");
        uint256 deadline = block.timestamp + 7 days;
        uint8 minRep = 50;
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            requirementsHash,
            deadline,
            minRep,
            2,
            72 hours
        );
        
        assertEq(bountyId, 1);
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(bounty.bountyId, 1);
        assertEq(bounty.client, client);
        assertEq(bounty.escrowAmount, 1 ether);
        assertEq(bounty.minRepRequired, minRep);
        assertEq(bounty.deadline, deadline);
        assertEq(uint8(bounty.status), uint8(BountyStatus.Open));
    }
    
    function test_CreateBounty_RevertsIfEscrowTooLow() public {
        vm.expectRevert(BountyRegistry__InvalidEscrowAmount.selector);
        vm.prank(client);
        registry.createBounty{value: 0.0001 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            72 hours
        );
    }
    
    function test_CreateBounty_RevertsIfDeadlineInPast() public {
        vm.expectRevert(BountyRegistry__InvalidDeadline.selector);
        vm.prank(client);
        registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp - 1,
            50,
            2,
            72 hours
        );
    }
    
    function test_CreateBounty_RevertsIfMinRepTooHigh() public {
        vm.expectRevert(BountyRegistry__InvalidMinRepRequirement.selector);
        vm.prank(client);
        registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            2001, // Invalid - exceeds max of 2000
            2,
            72 hours
        );
    }
    
    function test_CreateBounty_CalculatesPlatformFee() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            72 hours
        );
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(bounty.platformFee, 0.1 ether); // 10% of 1 ether
    }
    
    function test_CreateBounty_DepositsToEscrow() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            72 hours
        );
        
        assertEq(escrow.escrowBalance(bountyId), 1 ether);
    }
    
    function test_CreateBounty_UsesDefaultReviewPeriodIfZero() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            0 // Should use default
        );
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(bounty.reviewPeriod, 72 hours);
    }
    
    // ============ BOUNTY CLAIMING TESTS ============
    
    function test_ClaimBounty_SucceedsWithSufficientReputation() public {
        // Create bounty requiring 50 rep
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            72 hours
        );
        
        // Give freelancer 60 rep
        _setReputation(freelancer1, 1200, 1200, 1200);
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        assertEq(registry.bountyAssignments(bountyId), freelancer1);
        assertEq(registry.activeBountyCount(freelancer1), 1);
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(uint8(bounty.status), uint8(BountyStatus.InProgress));
    }
    
    function test_ClaimBounty_RevertsIfInsufficientReputation() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            50,
            2,
            72 hours
        );
        
        // Give freelancer only 40 rep (below minRep of 50)
        _setReputation(freelancer1, 40, 40, 40);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                BountyRegistry__InsufficientReputation.selector,
                50,
                40
            )
        );
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
    }
    
    function test_ClaimBounty_RevertsIfCapacityLimitReached() public {
        // Give freelancer Bronze tier (max 2 concurrent)
        _setReputation(freelancer1, 600, 600, 600);
        
        // Create and claim 2 bounties
        for (uint i = 0; i < 2; i++) {
            vm.prank(client);
            uint256 bountyId = registry.createBounty{value: 1 ether}(
                keccak256(abi.encodePacked("Requirements", i)),
                block.timestamp + 7 days,
                0,
                2,
                72 hours
            );
            
            vm.prank(freelancer1);
            registry.claimBounty(bountyId);
        }
        
        // Try to claim 3rd bounty
        vm.prank(client);
        uint256 bountyId3 = registry.createBounty{value: 1 ether}(
            keccak256("Requirements3"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                BountyRegistry__CapacityLimitReached.selector,
                2,
                2
            )
        );
        vm.prank(freelancer1);
        registry.claimBounty(bountyId3);
    }
    
    function test_ClaimBounty_RevertsIfValueExceedsTierLimit() public {
        // Give freelancer Bronze tier (max $500)
        _setReputation(freelancer1, 600, 600, 600);
        
        // Create bounty worth 600 ether (exceeds Bronze limit of 500)
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 600 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                BountyRegistry__BountyValueExceedsTierLimit.selector,
                600 ether,
                500 ether
            )
        );
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
    }
    
    function test_ClaimBounty_RevertsIfBountyNotOpen() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        _setReputation(freelancer1, 1000, 1000, 1000);
        
        // Claim bounty
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        // Try to claim again
        vm.expectRevert(BountyRegistry__BountyNotOpen.selector);
        vm.prank(freelancer2);
        registry.claimBounty(bountyId);
    }
    
    function test_ClaimBounty_RevertsIfAlreadyClaimed() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        _setReputation(freelancer1, 1000, 1000, 1000);
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.expectRevert(BountyRegistry__BountyNotOpen.selector);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
    }
    
    // ============ TIER-BASED LIMIT TESTS ============
    
    function test_TierLimits_BronzeAllows2Concurrent() public {
        _setReputation(freelancer1, 600, 600, 600); // Bronze
        
        // Should allow 2
        for (uint i = 0; i < 2; i++) {
            vm.prank(client);
            uint256 bountyId = registry.createBounty{value: 1 ether}(
                keccak256(abi.encodePacked("Req", i)),
                block.timestamp + 7 days,
                0,
                2,
                72 hours
            );
            
            vm.prank(freelancer1);
            registry.claimBounty(bountyId);
        }
        
        assertEq(registry.activeBountyCount(freelancer1), 2);
    }
    
    function test_TierLimits_SilverAllows5Concurrent() public {
        _setReputation(freelancer1, 1000, 1000, 1000); // Silver
        
        for (uint i = 0; i < 5; i++) {
            vm.prank(client);
            uint256 bountyId = registry.createBounty{value: 1 ether}(
                keccak256(abi.encodePacked("Req", i)),
                block.timestamp + 7 days,
                0,
                2,
                72 hours
            );
            
            vm.prank(freelancer1);
            registry.claimBounty(bountyId);
        }
        
        assertEq(registry.activeBountyCount(freelancer1), 5);
    }
    
    function test_TierLimits_GoldAllows10Concurrent() public {
        _setReputation(freelancer1, 1500, 1500, 1500); // Gold
        
        for (uint i = 0; i < 10; i++) {
            vm.prank(client);
            uint256 bountyId = registry.createBounty{value: 1 ether}(
                keccak256(abi.encodePacked("Req", i)),
                block.timestamp + 7 days,
                0,
                2,
                72 hours
            );
            
            vm.prank(freelancer1);
            registry.claimBounty(bountyId);
        }
        
        assertEq(registry.activeBountyCount(freelancer1), 10);
    }
    
    function test_TierLimits_PlatinumAllows20Concurrent() public {
        _setReputation(freelancer1, 1900, 1900, 1900); // Platinum
        
        for (uint i = 0; i < 20; i++) {
            vm.prank(client);
            uint256 bountyId = registry.createBounty{value: 1 ether}(
                keccak256(abi.encodePacked("Req", i)),
                block.timestamp + 7 days,
                0,
                2,
                72 hours
            );
            
            vm.prank(freelancer1);
            registry.claimBounty(bountyId);
        }
        
        assertEq(registry.activeBountyCount(freelancer1), 20);
    }
    
    // ============ BOUNTY CANCELLATION TESTS ============
    
    function test_CancelBounty_SucceedsIfNotClaimed() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        uint256 balanceBefore = client.balance;
        
        vm.prank(client);
        registry.requestCancellation(bountyId, bytes32("reason"));
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(uint8(bounty.status), uint8(BountyStatus.Cancelled));
    }
    
    function test_CancelBounty_RefundsEscrow() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        vm.prank(client);
        registry.requestCancellation(bountyId, bytes32("reason"));
        
        // Check escrow balance increased
        EscrowAccount memory account = escrow.getEscrowAccount(client);
        assertEq(account.availableAmount, 1 ether);
    }
    
    function test_CancelBounty_RevertsIfNotClient() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        vm.expectRevert(BountyRegistry__NotBountyClient.selector);
        vm.prank(freelancer1);
        registry.requestCancellation(bountyId, bytes32("reason"));
    }
    
    // ============ BOUNTY EXPIRATION TESTS ============
    
    function test_ExpireBounty_SucceedsAfterDeadline() public {
        uint256 deadline = block.timestamp + 7 days;
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            deadline,
            0,
            2,
            72 hours
        );
        
        // Fast forward past deadline
        vm.warp(deadline + 1);
        
        vm.prank(keeper);
        registry.expireBounty(bountyId);
        
        Bounty memory bounty = registry.getBounty(bountyId);
        assertEq(uint8(bounty.status), uint8(BountyStatus.Expired));
    }
    
    function test_ExpireBounty_RevertsIfNotExpired() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        vm.expectRevert(BountyRegistry__BountyNotExpired.selector);
        vm.prank(keeper);
        registry.expireBounty(bountyId);
    }
    
    function test_ExpireBounty_RefundsClient() public {
        uint256 deadline = block.timestamp + 7 days;
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            deadline,
            0,
            2,
            72 hours
        );
        
        vm.warp(deadline + 1);
        
        vm.prank(keeper);
        registry.expireBounty(bountyId);
        
        EscrowAccount memory account = escrow.getEscrowAccount(client);
        assertEq(account.availableAmount, 1 ether);
    }
    
    function test_ExpireBounty_UpdatesFreelancerActiveCount() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        _setReputation(freelancer1, 1000, 1000, 1000);
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        assertEq(registry.activeBountyCount(freelancer1), 1);
        
        vm.warp(block.timestamp + 8 days);
        
        vm.prank(keeper);
        registry.expireBounty(bountyId);
        
        assertEq(registry.activeBountyCount(freelancer1), 0);
    }
    
    // ============ PAUSE TESTS ============
    
    function test_Pause_PreventsNewBounties() public {
        vm.prank(admin);
        registry.pause();
        
        vm.expectRevert();
        vm.prank(client);
        registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
    }
    
    function test_Unpause_AllowsNewBounties() public {
        vm.startPrank(admin);
        registry.pause();
        registry.unpause();
        vm.stopPrank();
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Requirements"),
            block.timestamp + 7 days,
            0,
            2,
            72 hours
        );
        
        assertEq(bountyId, 1);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    function _setReputation(address user, uint16 quality, uint16 reliability, uint16 professionalism) internal {
        vm.startPrank(admin);
        oracle.setAuthorizedUpdater(aiService, true);
        vm.stopPrank();
        
        bytes memory signature = _generateSignature(user, quality, reliability, professionalism);
        
        vm.prank(aiService);
        oracle.updateReputation(user, quality, reliability, professionalism, signature);
    }
    
    function _generateSignature(
        address user,
        uint16 quality,
        uint16 reliability,
        uint16 professionalism
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
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash);
        
        return abi.encodePacked(r, s, v);
    }
}
