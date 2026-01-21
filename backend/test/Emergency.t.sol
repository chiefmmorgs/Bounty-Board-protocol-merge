// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/SubmissionManager.sol";
import "../contracts/DisputeResolver.sol";
import "../contracts/Types.sol";
import "../contracts/Errors.sol";

contract EmergencyTest is Test {
    BountyRegistry public registry;
    ReputationOracle public oracle;
    PaymentEscrow public escrow;
    SubmissionManager public submissionManager;
    DisputeResolver public disputeResolver;
    
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public admin = address(0xAD1);
    address public client = address(0xC11);
    address public freelancer1 = address(0xF11);
    
    function setUp() public {
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        registry = new BountyRegistry();
        submissionManager = new SubmissionManager();
        disputeResolver = new DisputeResolver();
        
        oracle.initialize(admin);
        escrow.initialize(admin, address(0x72E), 1000);
        registry.initialize(admin, address(oracle), address(escrow));
        submissionManager.initialize(admin, address(registry), address(escrow), address(oracle));
        disputeResolver.initialize(admin, address(registry), address(escrow), address(oracle), 5000 ether);
        
        vm.startPrank(admin);
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), address(registry));
        escrow.grantRole(escrow.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        registry.grantRole(registry.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(escrow));
        registry.grantRole(registry.DISPUTE_RESOLVER_ROLE(), address(escrow));
        registry.grantRole(registry.PAUSER_ROLE(), admin);
        
        submissionManager.grantRole(submissionManager.PAUSER_ROLE(), admin);
        disputeResolver.grantRole(disputeResolver.PAUSER_ROLE(), admin);
        
        oracle.grantRole(oracle.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        oracle.grantRole(oracle.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        oracle.setAuthorizedUpdater(aiService, true);
        oracle.setAuthorizedUpdater(admin, true);
        escrow.setContractReferences(address(registry), address(submissionManager), address(disputeResolver), address(oracle));
        vm.stopPrank();
        
        vm.warp(block.timestamp + 30 days);
        
        vm.deal(client, 100 ether);
        vm.deal(freelancer1, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
        vm.deal(address(0x72E), 100 ether);
    }
    
    function _setReputation(address user, uint16 quality, uint16 reliability, uint16 professionalism) internal {
        bytes32 messageHash = keccak256(abi.encodePacked(
            user, quality, reliability, professionalism, block.timestamp / 1 hours
        ));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash); 
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(aiService); 
        oracle.updateReputation(user, quality, reliability, professionalism, signature);
    }

    function test_PauseDuringActiveBounties() public {
        _setReputation(freelancer1, 1000, 1000, 1000);
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        
        // PAUSE ALL
        vm.startPrank(admin);
        registry.pause();
        submissionManager.pause();
        disputeResolver.pause();
        vm.stopPrank();
        
        // Try Accept (Should Fail)
        vm.expectRevert(); // Enforced by modifiers check `whenNotPaused`
        vm.prank(client);
        submissionManager.acceptSubmission(subId, bytes32("feedback"));
        
        // Try Submit (Should Fail)
        // Need new bounty? No, resubmit.
        vm.expectRevert();
        vm.prank(freelancer1);
        submissionManager.submitWork(bountyId, keccak256("NewWork"));
        
        // Try Cancel (Should Fail)
        vm.expectRevert();
        vm.prank(client);
        registry.requestCancellation(bountyId, bytes32("reason"));
    }
    
    function test_WithdrawDuringPause() public {
        // Create funds in Available
        _setReputation(freelancer1, 1000, 1000, 1000);
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        
        vm.prank(client);
        submissionManager.startReview(subId);
        
        vm.prank(client);
        submissionManager.acceptSubmission(subId, bytes32("feedback"));
        
        // Funds are now in available (0.9 ETH).
        
        // FAIL SAFE: PAUSE EVERYTHING
        vm.startPrank(admin);
        registry.pause();
        submissionManager.pause();
        disputeResolver.pause();
        vm.stopPrank();
        
        // Verify: Withdrawal WORKS (No fund lockup)
        uint256 balanceBefore = freelancer1.balance;
        
        vm.warp(block.timestamp + 10 days);
        vm.prank(freelancer1);
        escrow.withdraw(0.9 ether);
        
        assertEq(freelancer1.balance, balanceBefore + 0.9 ether);
    }
    
    function test_UnpauseResume() public {
         // Pause
         vm.prank(admin);
         registry.pause();
         
         // Try create (Fail)
         vm.prank(client);
         vm.expectRevert();
         registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
         );
         
         // Unpause
         vm.prank(admin);
         registry.unpause();
         
         // Try create (Success)
         vm.prank(client);
         uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
         );
         assertGt(bountyId, 0);
    }
}
