// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/Types.sol";

/**
 * @title PaymentEscrowTest
 * @notice Comprehensive tests for PaymentEscrow contract
 * @dev Tests escrow state machine, withdrawals, and tier-based restrictions
 */
contract PaymentEscrowTest is Test {
    
    PaymentEscrow public escrow;
    ReputationOracle public oracle;
    
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public admin = address(0xAD1);
    address public treasury = address(0x72E);
    address public bountyRegistry = address(0xBE6);
    address public submissionManager = address(0x511);
    address public disputeResolver = address(0xD15);
    address public client = address(0xC11);
    address public freelancer = address(0xF11);
    
    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10%
    
    function setUp() public {
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        
        oracle.initialize(admin);
        escrow.initialize(admin, treasury, PLATFORM_FEE_BPS);
        
        vm.startPrank(admin);
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), bountyRegistry);
        escrow.grantRole(escrow.SUBMISSION_MANAGER_ROLE(), submissionManager);
        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), disputeResolver);
        escrow.setContractReferences(bountyRegistry, submissionManager, disputeResolver, address(oracle));
        vm.stopPrank();
        
        vm.deal(client, 100 ether);
        vm.deal(freelancer, 100 ether);
        vm.deal(bountyRegistry, 100 ether);
        vm.deal(submissionManager, 100 ether);
        vm.deal(disputeResolver, 100 ether);
        vm.deal(treasury, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
        
        vm.warp(block.timestamp + 30 days);
        
        // Default mock for bountyRegistry.getBounty(1)
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
    }
    
    // ============ INITIALIZATION TESTS ============
    
    function test_Initialize_SetsPlatformFee() public {
        assertEq(escrow.platformFeePercentage(), PLATFORM_FEE_BPS);
    }
    
    function test_Initialize_SetsTreasury() public {
        assertEq(escrow.platformTreasury(), treasury);
    }
    
    function test_Initialize_RevertsIfZeroAddress() public {
        PaymentEscrow newEscrow = new PaymentEscrow();
        vm.expectRevert(InvalidAddress.selector);
        newEscrow.initialize(address(0), treasury, PLATFORM_FEE_BPS);
    }
    
    function test_Initialize_RevertsIfFeeTooHigh() public {
        PaymentEscrow newEscrow = new PaymentEscrow();
        vm.expectRevert(PaymentEscrow__InvalidFeePercentage.selector);
        newEscrow.initialize(admin, treasury, 2001); // >20%
    }
    
    // ============ DEPOSIT TESTS ============
    
    function test_DepositToEscrow_StoresFunds() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        assertEq(escrow.escrowBalance(1), 1 ether);
    }
    
    function test_DepositToEscrow_RevertsIfUnauthorized() public {
        vm.deal(address(0xDEAD), 10 ether);
        vm.expectRevert();
        vm.prank(address(0xDEAD));
        escrow.depositToEscrow{value: 1 ether}(client, 1);
    }
    
    function test_DepositToEscrow_RevertsIfZeroAmount() public {
        vm.expectRevert(PaymentEscrow__ZeroAmount.selector);
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 0}(client, 1);
    }
    
    // ============ LOCK FUNDS TESTS ============
    
    function test_LockFunds_UpdatesLockedAmount() public {
        vm.prank(bountyRegistry);
        escrow.lockFunds(client, 1 ether, 1);
        
        EscrowAccount memory account = escrow.getEscrowAccount(client);
        assertEq(account.lockedAmount, 1 ether);
    }
    
    function test_LockFunds_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        escrow.lockFunds(client, 1 ether, 1);
    }
    
    // ============ PAYMENT RELEASE TESTS ============
    
    function test_ReleasePayment_TransfersToFreelancer() public {
        // Setup escrow
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        // Mock BountyRegistry.getBounty to return status UnderReview
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        // Release payment
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0.9 ether); // 1 ether - 10% fee
    }
    
    function test_ReleasePayment_CollectsPlatformFee() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        assertEq(escrow.platformFeeBalance(), 0.1 ether);
    }
    
    function test_ReleasePayment_ZerosEscrowBalance() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        assertEq(escrow.escrowBalance(1), 0);
    }
    
    function test_ReleasePayment_RevertsIfInsufficientEscrow() public {
        vm.expectRevert(abi.encodeWithSelector(PaymentEscrow__InsufficientEscrowBalance.selector, 1));
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
    }
    
    function test_ReleasePayment_RevertsIfUnauthorized() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.expectRevert();
        vm.prank(address(999));
        escrow.releasePayment(1, freelancer, 1 ether);
    }
    
    // ============ REFUND TESTS ============
    
    function test_RefundClient_TransfersToClient() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.Cancelled), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(bountyRegistry);
        escrow.refundClient(1, client, 1 ether, "Bounty cancelled");
        
        EscrowAccount memory account = escrow.getEscrowAccount(client);
        assertEq(account.availableAmount, 1 ether);
    }
    
    function test_RefundClient_ZerosEscrowBalance() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.Cancelled), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(bountyRegistry);
        escrow.refundClient(1, client, 1 ether, "Bounty cancelled");
        
        assertEq(escrow.escrowBalance(1), 0);
    }
    
    function test_RefundClient_RevertsIfUnauthorized() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.expectRevert(PaymentEscrow__UnauthorizedCaller.selector);
        vm.prank(address(999));
        escrow.refundClient(1, client, 1 ether, "Unauthorized");
    }
    
    // ============ PARTIAL PAYMENT TESTS ============
    
    function test_ReleasePartialPayment_Splits50_50() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.prank(bountyRegistry);
        escrow.lockFunds(client, 1 ether, 1);
        
        vm.prank(disputeResolver);
        escrow.releasePartialPayment(1, freelancer, client, 50);
        
        EscrowAccount memory freelancerAccount = escrow.getEscrowAccount(freelancer);
        EscrowAccount memory clientAccount = escrow.getEscrowAccount(client);
        
        // Freelancer gets 50% minus platform fee on their portion
        // 0.5 ether - (0.5 * 0.1) = 0.45 ether
        assertEq(freelancerAccount.availableAmount, 0.45 ether);
        
        // Client gets 50% back
        assertEq(clientAccount.availableAmount, 0.5 ether);
    }
    
    function test_ReleasePartialPayment_Splits70_30() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.prank(bountyRegistry);
        escrow.lockFunds(client, 1 ether, 1);
        
        vm.prank(disputeResolver);
        escrow.releasePartialPayment(1, freelancer, client, 70);
        
        EscrowAccount memory freelancerAccount = escrow.getEscrowAccount(freelancer);
        EscrowAccount memory clientAccount = escrow.getEscrowAccount(client);
        
        // Freelancer: 0.7 - (0.7 * 0.1) = 0.63 ether
        assertEq(freelancerAccount.availableAmount, 0.63 ether);
        assertEq(clientAccount.availableAmount, 0.3 ether);
    }
    
    function test_ReleasePartialPayment_RevertsIfPercentageOver100() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.expectRevert(DisputeResolver__InvalidPaymentPercentage.selector);
        vm.prank(disputeResolver);
        escrow.releasePartialPayment(1, freelancer, client, 101);
    }
    
    // ============ WITHDRAWAL TESTS ============
    
    function test_Withdraw_TransfersFunds() public {
        // Give freelancer available balance
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        // Set freelancer reputation for withdrawal frequency
        _setReputation(freelancer, 1900, 1900, 1900); // Platinum = instant withdrawal
        vm.warp(block.timestamp + 1 hours);
        
        uint256 balanceBefore = freelancer.balance;
        
        vm.prank(freelancer);
        escrow.withdraw(0.9 ether);
        
        assertEq(freelancer.balance, balanceBefore + 0.9 ether);
    }
    
    function test_Withdraw_UpdatesAvailableBalance() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        _setReputation(freelancer, 1900, 1900, 1900);
        vm.warp(block.timestamp + 1 hours);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0.4 ether);
    }
    
    function test_Withdraw_RevertsIfInsufficientBalance() public {
        _setReputation(freelancer, 1900, 1900, 1900);
        vm.warp(block.timestamp + 1 hours);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                PaymentEscrow__InsufficientBalance.selector,
                1 ether,
                0
            )
        );
        vm.prank(freelancer);
        escrow.withdraw(1 ether);
    }
    
    function test_Withdraw_RevertsIfTooFrequentForBronze() public {
        // Setup balance
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 2 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 2 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 2 ether);
        
        // Set Bronze tier (7 day withdrawal frequency)
        _setReputation(freelancer, 600, 600, 600);
        vm.warp(block.timestamp + 1 hours);
        
        // First withdrawal succeeds
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        // Second withdrawal immediately fails
        vm.expectRevert();
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
    }
    
    function test_Withdraw_AllowsAfterWaitPeriodForBronze() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 2 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 2 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 2 ether);
        
        _setReputation(freelancer, 600, 600, 600); // Bronze
        vm.warp(block.timestamp + 1 hours);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        // Wait 7 days
        vm.warp(block.timestamp + 7 days);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0.8 ether);
    }
    
    function test_Withdraw_SilverRequires3Days() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 2 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 2 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 2 ether);
        
        _setReputation(freelancer, 1000, 1000, 1000); // Silver
        vm.warp(block.timestamp + 1 hours);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        // Wait 3 days
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0.8 ether);
    }
    
    function test_Withdraw_GoldRequires1Day() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 2 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 2 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 2 ether);
        
        _setReputation(freelancer, 1500, 1500, 1500); // Gold
        vm.warp(block.timestamp + 1 hours);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        // Wait 1 day
        vm.warp(block.timestamp + 1 days);
        
        vm.prank(freelancer);
        escrow.withdraw(0.5 ether);
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0.8 ether);
    }
    
    function test_Withdraw_PlatinumIsInstant() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 2 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 2 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 2 ether);
        
        _setReputation(freelancer, 1900, 1900, 1900); // Platinum
        vm.warp(block.timestamp + 1 hours);
        
        // Multiple withdrawals immediately
        vm.startPrank(freelancer);
        escrow.withdraw(0.5 ether);
        escrow.withdraw(0.5 ether);
        escrow.withdraw(0.8 ether);
        vm.stopPrank();
        
        EscrowAccount memory account = escrow.getEscrowAccount(freelancer);
        assertEq(account.availableAmount, 0);
    }
    
    // ============ PLATFORM FEE WITHDRAWAL TESTS ============
    
    function test_WithdrawPlatformFees_TransfersToTreasury() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        uint256 balanceBefore = treasury.balance;
        
        vm.prank(treasury);
        escrow.withdrawPlatformFees();
        
        assertEq(treasury.balance, balanceBefore + 0.1 ether);
    }
    
    function test_WithdrawPlatformFees_ZerosBalance() public {
        vm.prank(bountyRegistry);
        escrow.depositToEscrow{value: 1 ether}(client, 1);
        
        vm.mockCall(
            bountyRegistry,
            abi.encodeWithSelector(BountyRegistry.getBounty.selector, 1),
            abi.encode(1, client, 0, uint8(BountyStatus.UnderReview), 0, 1 ether, 0, 0, 0, 0, bytes32(0))
        );
        
        vm.prank(submissionManager);
        escrow.releasePayment(1, freelancer, 1 ether);
        
        vm.prank(treasury);
        escrow.withdrawPlatformFees();
        
        assertEq(escrow.platformFeeBalance(), 0);
    }
    
    function test_WithdrawPlatformFees_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        escrow.withdrawPlatformFees();
    }
    
    function test_WithdrawPlatformFees_RevertsIfZeroBalance() public {
        vm.expectRevert(PaymentEscrow__ZeroAmount.selector);
        vm.prank(treasury);
        escrow.withdrawPlatformFees();
    }
    
    // ============ ADMIN TESTS ============
    
    function test_SetPlatformFee_UpdatesFee() public {
        vm.prank(admin);
        escrow.setPlatformFee(1500); // 15%
        
        assertEq(escrow.platformFeePercentage(), 1500);
    }
    
    function test_SetPlatformFee_RevertsIfTooHigh() public {
        vm.expectRevert(PaymentEscrow__InvalidFeePercentage.selector);
        vm.prank(admin);
        escrow.setPlatformFee(2001); // >20%
    }
    
    function test_SetPlatformFee_RevertsIfUnauthorized() public {
        vm.expectRevert();
        vm.prank(address(999));
        escrow.setPlatformFee(1500);
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
