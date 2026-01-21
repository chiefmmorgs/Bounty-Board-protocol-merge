// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/SubmissionManager.sol";
import "../contracts/Types.sol";
import "../contracts/Errors.sol";

contract InvariantsTest is Test {
    BountyRegistry public registry;
    ReputationOracle public oracle;
    PaymentEscrow public escrow;
    SubmissionManager public submissionManager;
    
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public aiService = vm.addr(aiServicePrivateKey);
    address public admin = address(0xAD1);
    address public treasury = address(0x72E);
    address public client = address(0xC11);
    address public freelancer1 = address(0xF11);
    
    function setUp() public {
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        registry = new BountyRegistry();
        submissionManager = new SubmissionManager();
        
        oracle.initialize(admin);
        escrow.initialize(admin, treasury, 1000); // 10% fee
        registry.initialize(admin, address(oracle), address(escrow));
        submissionManager.initialize(admin, address(registry), address(escrow), address(oracle));
        
        vm.startPrank(admin);
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), address(registry));
        escrow.grantRole(escrow.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        escrow.grantRole(escrow.TREASURY_ROLE(), admin); 
        
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        registry.grantRole(registry.SUBMISSION_MANAGER_ROLE(), address(escrow));
        registry.grantRole(registry.DISPUTE_RESOLVER_ROLE(), address(escrow));
        
        oracle.grantRole(oracle.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        
        escrow.setContractReferences(address(registry), address(submissionManager), address(0xD15), address(oracle));
        
        oracle.setAuthorizedUpdater(aiService, true);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 30 days);
        
        vm.deal(client, 100 ether);
        vm.deal(freelancer1, 100 ether);
        vm.deal(treasury, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
        vm.deal(address(registry), 100 ether);
        vm.deal(address(submissionManager), 100 ether);
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

    // Invariant 1: Conservation of Funds
    // Total Balance = Sum(Escrow) + Sum(Available) + Fees
    function testInvariant_BalanceConservation() public {
        uint256 initialBalance = address(escrow).balance;
        assertEq(initialBalance, 0);
        
        // 1. Create Bounty (Deposit)
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 10 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        // Check: Balance == EscrowBalance
        assertEq(address(escrow).balance, 10 ether);
        assertEq(escrow.escrowBalance(bountyId), 10 ether);
        assertEq(escrow.platformFeeBalance(), 0);
        
        // 2. Freelancer claims
        _setReputation(freelancer1, 1000, 1000, 1000);
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        // 3. Submit Work
        vm.prank(freelancer1);
        uint256 subId = submissionManager.submitWork(bountyId, keccak256("work"));
        
        // 4. Accept work (Release)
        vm.prank(client);
        submissionManager.startReview(subId);
        
        vm.prank(client);
        submissionManager.acceptSubmission(subId, bytes32("feedback"));
        
        // Check conservation:
        // EscrowBalance should be 0.
        // Available(Freelancer) should be 90% (9 ETH).
        // Fees should be 10% (1 ETH).
        // Total should be 10 ETH.
        
        assertEq(escrow.escrowBalance(bountyId), 0, "Escrow balance should be cleared");
        assertEq(escrow.platformFeeBalance(), 1 ether, "Fee should be accumulated");
        
        EscrowAccount memory acc = escrow.getEscrowAccount(freelancer1);
        assertEq(acc.availableAmount, 9 ether, "Freelancer should have available funds");
        
        uint256 calculatedTotal = escrow.platformFeeBalance() + acc.availableAmount; // sum(escrow) is 0
        assertEq(address(escrow).balance, calculatedTotal, "Balance conservation failed");
        
        // 5. Withdrawal
        vm.warp(block.timestamp + 10 days);
        vm.prank(freelancer1);
        escrow.withdraw(5 ether);
        
        // Conservation check
        acc = escrow.getEscrowAccount(freelancer1);
        assertEq(acc.availableAmount, 4 ether);
        
        calculatedTotal = escrow.platformFeeBalance() + acc.availableAmount;
        assertEq(address(escrow).balance, calculatedTotal, "Balance conservation after withdrawal failed");
    }
    
    // Invariant 2: No Over Release
    function testInvariant_NoOverRelease() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        // Try to release more than deposited via mock prank
        vm.startPrank(address(submissionManager));
        // We need Valid State for check.
        vm.mockCall(
           address(registry),
           abi.encodeWithSelector(BountyRegistry.getBounty.selector, bountyId),
           abi.encode(Bounty({
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
           }))
        );
        
        // Try release 2 ETH (only 1 deposited)
        // Should rely on arithmetic or balance check?
        // `escrowBalance` is 1 ether.
        // Logic: `escrowBalance[_bountyId] = 0;` (Resets to 0!)
        // It does NOT check if `_amount <= escrowBalance`.
        // Wait. `PaymentEscrow.releasePayment`:
        // 1. Check `escrowBalance > 0`.
        // 2. `escrowBalance[_bountyId] = 0`.
        // 3. `available += payment`.
        // 4. `fees += fee`.
        // Note: It assumes `_amount` passed matches `escrowAmount`.
        // BUT `_amount` is passed by caller!
        // If caller passes 2 ETH...
        // `available += 2 ETH`.
        // `escrowBalance` was 1 ETH.
        // Result: `available` increases by 2 ETH. Contract balance allows it?
        // Yes, if other bounties exist.
        // This creates Insolvency!
        // `PaymentEscrow.releasePayment` MUST check `_amount <= escrowBalance`!
        // Let's check the code.
        
        // Phase 2 finding: "Payment release without bounty state verification".
        // Was there "Payment release amount verification"?
        // `releasePayment` assigns `escrowBalance = 0`.
        // This implies it releases EVERYTHING.
        // But it takes `_amount` as param.
        // If `_amount` != `escrowBalance`, we have a problem.
        // If `_amount` < `escrowBalance`, we destroy funds (reset to 0).
        // If `_amount` > `escrowBalance`, we create funds (magic mint).
        // THIS IS A CRITICAL BUG.
        // The contract blindly trusts `_amount`.
        // `SubmissionManager` calls `releasePayment`.
        // `SubmissionManager` passes `bounty.escrowAmount`.
        // So it is "Safe" if `SubmissionManager` is trusted.
        // But `PaymentEscrow` should enforce `_amount == escrowBalance` or `_amount <= escrowBalance`.
        // Since `releasePayment` sets `escrowBalance = 0` (Full release), it implies `_amount` SHOULD be `escrowBalance`.
        // If `DisputeResolver` calls `releasePartialPayment`, that's different.
        
        // I should ADD A TEST exposing this vulnerability (if I can call it via compromised manager).
        // Since `SubmissionManager` is trusted role, this is "Admin/Role Trust".
        // But Invariant "No Over Release" means even the method shouldn't allow it?
        // Hardening implies Defensive Programming.
        // I should fix `PaymentEscrow` to require `_amount == escrowBalance` for full release?
        // Or `_amount <= escrowBalance`.
        
        // Let's test if I can over-release.
        
        vm.expectRevert(); // If logic is correct, it might not revert? 
        // If I want to fix it, I should update `PaymentEscrow`.
        // Phase A is technically "Done" but found new issue?
        // I will add the check in `PaymentEscrow.sol`.
        // `if (_amount != escrowBalance[_bountyId]) revert PaymentEscrow__InvalidAmount();`
        
        escrow.releasePayment(bountyId, freelancer1, 2 ether);
        vm.stopPrank();
    }

    // Invariant 3: No Stranded Funds
    function testInvariant_NoStrandedFunds_Cancel() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 0, 2, 1 days
        );
        
        vm.prank(client);
        registry.requestCancellation(bountyId, bytes32("reason"));
        
        assertEq(escrow.escrowBalance(bountyId), 0, "Escrow should be empty");
        // Funds moved to available
        EscrowAccount memory acc = escrow.getEscrowAccount(client);
        assertEq(acc.availableAmount, 1 ether);
    }
}
