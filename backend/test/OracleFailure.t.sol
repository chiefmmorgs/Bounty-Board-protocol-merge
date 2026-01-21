// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/Types.sol";
import "../contracts/Errors.sol";

contract OracleFailureTest is Test {
    BountyRegistry public registry;
    ReputationOracle public oracle;
    PaymentEscrow public escrow;
    
    address public admin = address(0xAD1);
    address public aiService = vm.addr(0xA11CE);
    uint256 public aiServicePrivateKey = 0xA11CE;
    address public client = address(0xC11);
    address public freelancer1 = address(0xF11);
    
    function setUp() public {
        oracle = new ReputationOracle();
        escrow = new PaymentEscrow();
        registry = new BountyRegistry();
        
        oracle.initialize(admin);
        escrow.initialize(admin, admin, 1000);
        registry.initialize(admin, address(oracle), address(escrow));
        
        vm.startPrank(admin);
        escrow.grantRole(escrow.BOUNTY_REGISTRY_ROLE(), address(registry));
        escrow.setContractReferences(address(registry), address(0x511), address(0xD15), address(oracle));
        oracle.setAuthorizedUpdater(aiService, true);
        vm.warp(block.timestamp + 100 days); // Adjust timing to avoid underflows and simulate time passing
        vm.stopPrank();
        
        vm.deal(client, 100 ether);
        vm.deal(freelancer1, 100 ether);
        vm.deal(admin, 100 ether);
        vm.deal(aiService, 100 ether);
    }
    
    function _setReputation(address user, uint16 quality, uint16 reliability, uint16 professionalism, uint256 timestamp) internal {
        bytes32 messageHash = keccak256(abi.encodePacked(
            user, quality, reliability, professionalism, timestamp / 1 hours
        ));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(aiService);
        oracle.updateReputation(user, quality, reliability, professionalism, signature);
    }

    // SCENARIO 1: Ethos API Returns Zero (Valid but low score)
    function test_OracleSafety_ZeroScore() public {
        // Set Rep to 0
        _setReputation(freelancer1, 0, 0, 0, block.timestamp);
        
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 10, 2, 1 days // Min Rep 10
        );
        
        vm.prank(freelancer1);
        vm.expectRevert(abi.encodeWithSelector(BountyRegistry__InsufficientReputation.selector, 10, 0));
        registry.claimBounty(bountyId);
    }
    
    // SCENARIO 2: Ethos API Stale Data (Timestamp mismatch)
    function test_OracleSafety_StaleSignature() public {
        // Generate signature for 2 hours ago
        uint256 staleTime = block.timestamp - 2 hours;
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            freelancer1, uint16(1000), uint16(1000), uint16(1000), staleTime / 1 hours
        ));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aiServicePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(aiService);
        // Should revert because recovered signer won't match admin (since contract calculates hash with current block.timestamp)
        // logic: `keccak256(..., block.timestamp / 1 hours)`
        // vs signature signed with `staleTime / 1 hours`.
        // Result: ecrecover returns random address or 0? 
        // Returns address that WOULD sign the CURRENT blob to match `signature`.
        // That address is definitely not `admin`.
        // So `ReputationOracle__InvalidSignature` (line 146 checks `authorizedUpdaters[signer]`).
        
        vm.expectRevert(ReputationOracle__InvalidSignature.selector);
        oracle.updateReputation(freelancer1, 1000, 1000, 1000, signature);
    }
    
    // SCENARIO 3: Ethos API Reverts (Contract failure downstream)
    function test_OracleSafety_ContractRevert() public {
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 10, 2, 1 days
        );
        
        // Mock Oracle to revert on meetsRepRequirement
        vm.mockCall(
            address(oracle),
            abi.encodeWithSelector(ReputationOracle.meetsRepRequirement.selector),
            abi.encodePacked("Revert") // Invalid encoding causes revert? Or just `vm.expectRevert`
        );
        
        // Actually vm.mockCallRevert exists in newer forge?
        // Or we use mockCall to return false?
        // Scenario is "Ethos API Reverts". 
        // If Oracle is an external API call? No, it's a contract.
        // If the contract logic reverts (e.g. storage error, gas).
        // `registry.claimBounty` calls `oracle.meetsRepRequirement`.
        // If that reverts, `claimBounty` reverts.
        
        // Mock getReputation to return a failing score
        // Or mock it to revert.
        vm.mockCallRevert(
            address(oracle),
            abi.encodeWithSelector(ReputationOracle.getReputation.selector, freelancer1),
            "Oracle Failure"
        );
        
        vm.prank(freelancer1);
        vm.expectRevert("Oracle Failure");
        registry.claimBounty(bountyId);
        
        // Verify: Platform fails safely (transaction reverts), funds safe (no change).
    }
    
    // SCENARIO 4: Ethos Unavailable (Persistence)
    function test_OracleSafety_Persistence() public {
        // 1. Set valid reputation
        _setReputation(freelancer1, 1000, 1000, 1000, block.timestamp);
        
        // 2. Oracle service goes down (no new updates)
        // 3. Time passes (1 day)
        vm.warp(block.timestamp + 1 days);
        
        // 4. User tries to claim
        vm.prank(client);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            keccak256("Req"), block.timestamp + 1 days, 40, 2, 1 days
        );
        
        vm.prank(freelancer1);
        registry.claimBounty(bountyId);
        
        // Verify success
        address assignee = registry.bountyAssignments(bountyId);
        assertEq(assignee, freelancer1);
    }
}
