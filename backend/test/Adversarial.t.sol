// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/SubmissionManager.sol";
import "../contracts/DisputeResolver.sol";
import "../contracts/Types.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "../contracts/Errors.sol";

contract AdversarialTest is Test {
    BountyRegistry public registry;
    ReputationOracle public oracle;
    PaymentEscrow public escrow;
    SubmissionManager public submissionManager;
    DisputeResolver public disputeResolver;
    
    // Add missing enums to test scope or use module import
    // Note: Since Types is imported, we should use Types enums directly without redefining?
    // Actually, foundry tests usually work with imported enums.
    
    // Check if DisputeReason is available. It is imported from Types.sol.
    // So 'DisputeReason' should work.
    
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public admin = address(0xAD1);
    address public client = address(0xC11);
    address public freelancer1 = address(0xF11);
    address public attacker = address(0x29A);
    address public keeper = address(0x61);
    address public arbitrator = address(0xDE1);
    
    // Roles from contracts
    bytes32 constant SUBMISSION_MANAGER_ROLE = keccak256("SUBMISSION_MANAGER_ROLE");
    bytes32 constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 constant AI_SERVICE_ROLE = keccak256("AI_SERVICE_ROLE");
    bytes32 constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    function setUp() public {
        // Deploy
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        registry = new BountyRegistry();
        submissionManager = new SubmissionManager();
        disputeResolver = new DisputeResolver();
        
        // Init
        oracle.initialize(admin);
        escrow.initialize(admin, admin, 1000); 
        registry.initialize(admin, address(oracle), address(escrow));
        submissionManager.initialize(admin, address(registry), address(escrow), address(oracle));
        disputeResolver.initialize(admin, address(registry), address(escrow), address(oracle), 5000 ether); // 5000 eth threshold
        
        // Connect
        vm.startPrank(admin);
        
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), address(registry));
        escrow.grantRole(escrow.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        registry.grantRole(registry.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(escrow));
        registry.grantRole(registry.DISPUTE_RESOLVER_ROLE(), address(escrow));
        registry.grantRole(registry.KEEPER_ROLE(), keeper);
        
        oracle.grantRole(oracle.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        oracle.grantRole(oracle.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        disputeResolver.grantRole(disputeResolver.ARBITRATOR_ROLE(), arbitrator);
        disputeResolver.grantRole(disputeResolver.AI_SERVICE_ROLE(), arbitrator); 
        disputeResolver.grantRole(disputeResolver.ARBITRATOR_ROLE(), arbitrator);

        escrow.setContractReferences(
            address(registry),
            address(submissionManager),
            address(disputeResolver),
            address(oracle)
        );
        
        oracle.setAuthorizedUpdater(admin, true);
        oracle.setAuthorizedUpdater(aiService, true);
        
        vm.stopPrank();
        
        vm.deal(client, 100 ether);
        vm.deal(freelancer1, 100 ether);
        vm.deal(attacker, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
        vm.deal(arbitrator, 100 ether);
        vm.deal(keeper, 100 ether);
        vm.deal(address(this), 100 ether);
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
    
    function _createBounty() internal returns (uint256) {
        vm.prank(client);
        return registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 50, 2, 1 days
        );
    }

    // ============ UNAUTHORIZED ACCESS TESTS ============

    function test_RevertIf_UnauthorizedClaim() public {
        uint256 bountyId = _createBounty();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BountyRegistry__InsufficientReputation.selector, 50, 0));
        registry.claimBounty(bountyId);
    }

    function test_RevertIf_UnauthorizedUpdateBountyStatus() public {
        uint256 bountyId = _createBounty();
        vm.prank(attacker);
        vm.expectRevert(); 
        registry.updateBountyStatus(bountyId, BountyStatus.Completed);
    }

    function test_RevertIf_UnauthorizedReleasePayment() public {
        uint256 bountyId = _createBounty();
        
        vm.startPrank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                attacker,
                escrow.SUBMISSION_MANAGER_ROLE()
            )
        );
        escrow.releasePayment(bountyId, freelancer1, 1 ether);
        vm.stopPrank();
    }
    
    function test_RevertIf_UnauthorizedCancel() public {
        uint256 bountyId = _createBounty();
        vm.prank(attacker);
        vm.expectRevert(BountyRegistry__NotBountyClient.selector);
        registry.requestCancellation(bountyId, bytes32("reason"));
    }
    
    function test_RevertIf_OracleUnauthorizedUpdater() public {
        bytes memory sig = new bytes(65);
        vm.prank(attacker);
        vm.expectRevert(ReputationOracle__UnauthorizedUpdater.selector);
        oracle.updateReputation(freelancer1, 50, 50, 50, sig);
    }

    // ============ STATE MANIPULATION TESTS ============

    function test_RevertIf_DoubleClaim() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        vm.expectRevert(BountyRegistry__BountyNotOpen.selector);
        registry.claimBounty(bountyId);
    }
    
    function test_RevertIf_CancelAfterAcceptance() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        
        vm.prank(client);
        submissionManager.startReview(subId);
        
        vm.prank(client);
        submissionManager.acceptSubmission(subId, bytes32("feedback"));
        
        // Status is now Completed - a terminal state. Cannot cancel Completed bounties.
        // The contract will revert with CannotCancelWithSubmissions because status != Open && status != InProgress
        vm.expectRevert(BountyRegistry__CannotCancelWithSubmissions.selector); 
        vm.prank(client);
        registry.requestCancellation(bountyId, bytes32("reason"));
    }

    function test_RevertIf_SubmissionOverwrite() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        submissionManager.submitWork(bountyId, keccak256("Work1"));
        
        vm.prank(freelancer1);
        vm.expectRevert(SubmissionManager__SubmissionAlreadyExists.selector);
        submissionManager.submitWork(bountyId, keccak256("Work2"));
    }

    function test_RevertIf_AcceptWithoutReview() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work1"));
        
        vm.expectRevert(SubmissionManager__SubmissionNotUnderReview.selector);
        vm.prank(client);
        submissionManager.acceptSubmission(subId, bytes32("feedback"));
    }
    
    function test_RevertIf_PaymentEscrow_Release_WrongState() public {
       vm.mockCall(
           address(registry),
           abi.encodeWithSelector(BountyRegistry.getBounty.selector, 999),
           abi.encode(Bounty({
               bountyId: 999,
               client: client,
               minRepRequired: 0,
               status: uint8(BountyStatus.Open),
               maxRevisions: 2,
               escrowAmount: 1 ether, 
               platformFee: 0,
               deadline: block.timestamp + 100,
               createdAt: block.timestamp,
               reviewPeriod: 1 days,
               requirementsHash: bytes32(0)
           }))
       );

       // Deposit first to avoid balance check revert
       vm.deal(address(registry), 1 ether);
       vm.prank(address(registry));
       escrow.depositToEscrow{value: 1 ether}(client, 999);

       vm.expectRevert(PaymentEscrow__InvalidBountyState.selector);
       vm.prank(address(submissionManager));
       escrow.releasePayment(999, freelancer1, 1 ether);
    }
    

    function test_RevertIf_InvalidAIAnalysis() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        
        vm.prank(client);
        submissionManager.startReview(subId);
        
        vm.prank(client);
        disputeResolver.initiateDispute(bountyId, subId, DisputeReason.QualityIssue, bytes32("evidence"));
        
        uint256 disputeId = disputeResolver.bountyToDispute(bountyId);
        
        // arbitrator has AI_SERVICE_ROLE - submit AI analysis with confidence 0, should revert
        vm.prank(arbitrator); 
        vm.expectRevert(DisputeResolver__InvalidConfidence.selector);
        disputeResolver.submitAIAnalysis(disputeId, keccak256("Rec"), 0, DisputeOutcome.FullRefundToClient);
    }
    
    function test_RevertIf_OracleScoreOutOfBounds() public {
        // We need a valid signature for an INVALID score 2001 (exceeds max 2000).
        bytes32 messageHash = keccak256(abi.encodePacked(
            freelancer1, uint16(2001), uint16(1000), uint16(1000), block.timestamp / 1 hours
        ));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash); 
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(aiService);
        vm.expectRevert(abi.encodeWithSelector(ReputationOracle__ScoreOutOfBounds.selector, 2001));
        oracle.updateReputation(freelancer1, 2001, 1000, 1000, signature);
    }

    function test_RevertIf_DoubleRelease() public {
        uint256 bountyId = _createBounty();
        vm.startPrank(address(submissionManager));
        
        Bounty memory mockBounty = Bounty({
            bountyId: bountyId,
            client: client,
            minRepRequired: 0,
            status: uint8(BountyStatus.UnderReview),
            maxRevisions: 2,
            escrowAmount: 1 ether,
            platformFee: 0,
            deadline: block.timestamp + 100,
            createdAt: block.timestamp,
            reviewPeriod: 1 days,
            requirementsHash: bytes32(0)
        });
        
        vm.mockCall(
            address(registry),
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, bountyId),
            abi.encode(mockBounty)
        );
        
        escrow.releasePayment(bountyId, freelancer1, 1 ether);
        
        vm.expectRevert(abi.encodeWithSelector(PaymentEscrow__InsufficientEscrowBalance.selector, bountyId));
        escrow.releasePayment(bountyId, freelancer1, 1 ether);
        
        vm.stopPrank();
    }
    
    function test_RevertIf_ReputationReplay() public {
        bytes32 messageHash = keccak256(abi.encodePacked(
            freelancer1, uint16(1000), uint16(1000), uint16(1000), block.timestamp / 1 hours
        ));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash); 
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(aiService);
        oracle.updateReputation(freelancer1, 1000, 1000, 1000, signature);
        
        vm.prank(aiService);
        vm.expectRevert(abi.encodeWithSelector(ReputationOracle__UpdateTooFrequent.selector, block.timestamp, 1 hours));
        oracle.updateReputation(freelancer1, 1000, 1000, 1000, signature);
    }
    
    function test_RevertIf_DisputeNotParty() public {
        uint256 bountyId = _createBounty();
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        vm.prank(client);
        submissionManager.startReview(subId);
        
        // Attacker raises dispute
        vm.prank(attacker);
        vm.expectRevert(DisputeResolver__NotPartyToDispute.selector);
        disputeResolver.initiateDispute(bountyId, subId, DisputeReason.QualityIssue, bytes32("evidence"));
    }
    
    function test_RevertIf_DisputeAbuse() public {
        // Set up attacker's dispute history to trigger abuse prevention
        // The DisputeResolver requires: initiated >= 3 && winRate < MIN_DISPUTE_WIN_RATE (30%)
        // Win rate = (initiated - lost) * 100 / initiated
        // To get winRate < 30%, need to lose more than 70% of disputes
        
        vm.prank(address(disputeResolver));
        oracle.recordDisputeInitiation(attacker);
        vm.prank(address(disputeResolver));
        oracle.recordDisputeInitiation(attacker);
        vm.prank(address(disputeResolver));
        oracle.recordDisputeInitiation(attacker);
        vm.prank(address(disputeResolver));
        oracle.recordDisputeLoss(attacker, 1);
        vm.prank(address(disputeResolver));
        oracle.recordDisputeLoss(attacker, 2);
        vm.prank(address(disputeResolver));
        oracle.recordDisputeLoss(attacker, 3);
        
        // Now win rate is 0% (3 initiated, 3 lost -> (3-3)*100/3 = 0%)
        
        // Need to wait for reputation update cooldown (MIN_UPDATE_INTERVAL = 1 hour)
        vm.warp(block.timestamp + 2 hours);
        
        // Set up bounty for attacker to be party to
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req2"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        _setReputation(attacker, 1000, 1000, 1000);
        
        vm.prank(attacker);
        registry.claimBounty(bountyId);
        
        vm.prank(attacker);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("Work"));
        
        vm.prank(client);
        submissionManager.startReview(subId);
        
        // Attacker tries to raise dispute - should fail due to abuse prevention
        vm.expectRevert(abi.encodeWithSelector(DisputeResolver__DisputeAbusePrevention.selector, uint256(0)));
        vm.prank(attacker);
        disputeResolver.initiateDispute(bountyId, subId, DisputeReason.QualityIssue, bytes32("evidence"));
    }
    
    function test_RevertIf_EmergencyPause_CreateBounty() public {
        vm.prank(admin);
        registry.pause();
        
        vm.prank(client);
        vm.expectRevert(); // General Pausable revert
        registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 50, 2, 1 days
        );
    }
    
    function test_RevertIf_EmergencyPause_ClaimBounty() public {
        uint256 bountyId = _createBounty();
        vm.prank(admin);
        registry.pause();
        
        vm.prank(freelancer1);
        vm.expectRevert();
        registry.claimBounty(bountyId);
    }
}
