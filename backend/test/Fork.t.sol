// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/SubmissionManager.sol";
import "../contracts/DisputeResolver.sol";
import "../contracts/EmergencyPause.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract ForkTest is Test {
    // Core contracts
    ProxyAdmin proxyAdmin;
    ReputationOracle reputationOracle;
    PaymentEscrow paymentEscrow;
    BountyRegistry bountyRegistry;
    SubmissionManager submissionManager;
    DisputeResolver disputeResolver;
    EmergencyPause emergencyPause;

    // Users
    address admin;
    address client;
    address freelancer;
    address treasury;

    // Config
    uint256 platformFeePercentage = 1000; // 10%
    uint256 appealThreshold = 5000 ether;

    function setUp() public {
        // Fork Base Sepolia
        // Forking handled via CLI --fork-url
        // string memory rpcUrl = vm.envString("BASE_SEPOLIA_RPC_URL");
        // vm.createSelectFork(rpcUrl);

        // Setup accounts
        admin = makeAddr("admin");
        client = makeAddr("client");
        freelancer = makeAddr("freelancer");
        treasury = makeAddr("treasury");

        // Fund accounts with real value simulation
        vm.deal(client, 1 ether);
        vm.deal(freelancer, 0.1 ether);

        vm.startPrank(admin);
        _deployAndWire();
        vm.stopPrank();
    }

    function _deployAndWire() internal {
        // 1. Deploy ProxyAdmin
        proxyAdmin = new ProxyAdmin(admin);

        // 2. Deploy Implementations
        ReputationOracle reputationOracleImpl = new ReputationOracle();
        PaymentEscrow paymentEscrowImpl = new PaymentEscrow();
        BountyRegistry bountyRegistryImpl = new BountyRegistry();
        SubmissionManager submissionManagerImpl = new SubmissionManager();
        DisputeResolver disputeResolverImpl = new DisputeResolver();
        EmergencyPause emergencyPauseImpl = new EmergencyPause();

        // 3. Deploy Proxies & Initialize
        
        // ReputationOracle
        reputationOracle = ReputationOracle(address(new TransparentUpgradeableProxy(
            address(reputationOracleImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(ReputationOracle.initialize.selector, admin)
        )));

        // PaymentEscrow
        paymentEscrow = PaymentEscrow(payable(address(new TransparentUpgradeableProxy(
            address(paymentEscrowImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(PaymentEscrow.initialize.selector, admin, treasury, platformFeePercentage)
        ))));

        // BountyRegistry
        bountyRegistry = BountyRegistry(address(new TransparentUpgradeableProxy(
            address(bountyRegistryImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(BountyRegistry.initialize.selector, admin, address(reputationOracle), address(paymentEscrow))
        )));

        // SubmissionManager
        submissionManager = SubmissionManager(address(new TransparentUpgradeableProxy(
            address(submissionManagerImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(SubmissionManager.initialize.selector, admin, address(bountyRegistry), address(paymentEscrow), address(reputationOracle))
        )));

        // DisputeResolver
        disputeResolver = DisputeResolver(address(new TransparentUpgradeableProxy(
            address(disputeResolverImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(DisputeResolver.initialize.selector, admin, address(bountyRegistry), address(paymentEscrow), address(reputationOracle), appealThreshold)
        )));

        // EmergencyPause
        emergencyPause = EmergencyPause(address(new TransparentUpgradeableProxy(
            address(emergencyPauseImpl),
            address(proxyAdmin),
            abi.encodeWithSelector(EmergencyPause.initialize.selector, admin)
        )));

        // 4. Setup Roles (Matching Deploy.s.sol)
        paymentEscrow.grantRole(paymentEscrow.BOUNTY_REGISTRY_ROLE(), address(bountyRegistry));
        paymentEscrow.grantRole(paymentEscrow.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        paymentEscrow.grantRole(paymentEscrow.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));

        reputationOracle.grantRole(reputationOracle.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        reputationOracle.grantRole(reputationOracle.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        // Grant roles on BountyRegistry for SubmissionManager and DisputeResolver to update bounty status
        bountyRegistry.grantRole(bountyRegistry.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        bountyRegistry.grantRole(bountyRegistry.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        
        // Allow oracle updates for testing
        reputationOracle.setAuthorizedUpdater(admin, true);

        bountyRegistry.grantRole(bountyRegistry.PAUSER_ROLE(), address(emergencyPause));
        submissionManager.grantRole(submissionManager.PAUSER_ROLE(), address(emergencyPause));
        disputeResolver.grantRole(disputeResolver.PAUSER_ROLE(), address(emergencyPause));

        // 5. Contract References
        paymentEscrow.setContractReferences(
            address(bountyRegistry),
            address(submissionManager),
            address(disputeResolver),
            address(reputationOracle)
        );
    }

    function test_Fork_FullLifecycle() public {
        // 1. Setup Reputation for Freelancer (Needed to claim)
        // Use a known private key for signature generation
        uint256 signerPrivateKey = 0xA11CE;
        address signer = vm.addr(signerPrivateKey);
        
        // Authorize this signer
        vm.prank(admin);
        reputationOracle.setAuthorizedUpdater(signer, true);
        
        // Construct the message hash exactly as the contract does
        bytes32 messageHash = keccak256(abi.encodePacked(
            freelancer,
            uint16(1000), // quality
            uint16(1000), // reliability
            uint16(1000), // professionalism
            block.timestamp / 1 hours
        ));
        
        // The contract's _recoverSigner applies the Ethereum signed message prefix,
        // so we must sign the prefixed hash
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(signer); // Not strictly needed as signature validates signer, but keeps flow clear
        // Actually, msg.sender must be authorized too? 
        // "if (!authorizedUpdaters[msg.sender]) revert ReputationOracle__UnauthorizedUpdater();"
        // Yes, msg.sender must be authorized. So we prune as signer.
        reputationOracle.updateReputation(freelancer, 1000, 1000, 1000, signature); 
        
        uint256 bountyAmount = 0.1 ether;
        bytes32 ipfsHash = keccak256("Bounty Requirements");

        // 2. Client Creates Bounty
        vm.startPrank(client);
        uint256 bountyId = bountyRegistry.createBounty{value: bountyAmount}(
            ipfsHash,
            block.timestamp + 7 days,
            50, // minRep
            2,  // maxRevisions
            3 days // reviewPeriod
        );
        vm.stopPrank();

        // Verify escrow deposit
        assertEq(address(paymentEscrow).balance, bountyAmount);
        Bounty memory bounty = bountyRegistry.getBounty(bountyId);
        assertEq(uint(bounty.status), uint(BountyStatus.Open));

        // 3. Freelancer Claims Bounty
        vm.prank(freelancer);
        bountyRegistry.claimBounty(bountyId);
        
        bounty = bountyRegistry.getBounty(bountyId);
        assertEq(uint(bounty.status), uint(BountyStatus.InProgress));

        // 4. Freelancer Submits Work
        bytes32 submissionHash = keccak256("Submission");
        vm.prank(freelancer);
        uint256 submissionId = submissionManager.submitWork(bountyId, submissionHash);

        bounty = bountyRegistry.getBounty(bountyId);
        assertEq(uint(bounty.status), uint(BountyStatus.UnderReview));

        // 5. Client Starts Review
        vm.prank(client);
        submissionManager.startReview(submissionId);

        // 6. Client Accepts Submission
        uint256 initialFreelancerBalance = freelancer.balance;
        uint256 initialTreasuryBalance = treasury.balance;
        
        vm.prank(client);
        submissionManager.acceptSubmission(submissionId, keccak256("Feedback"));

        // 7. Verify Payment Release
        bounty = bountyRegistry.getBounty(bountyId);
        assertEq(uint(bounty.status), uint(BountyStatus.Completed));

        // Wait/mine blocks if needed (not strictly needed for instant release unless configured otherwise)
        
        // Calculate expected amounts
        uint256 fee = (bountyAmount * platformFeePercentage) / 10000;
        uint256 netAmount = bountyAmount - fee;
        
        // 8. Freelancer Withdraws (must pass actual amount, not 0)
        // Wait for withdrawal frequency (Silver tier = 3 days)
        vm.warp(block.timestamp + 3 days);
        vm.prank(freelancer);
        paymentEscrow.withdraw(netAmount);

        // Assertions
        assertEq(freelancer.balance, initialFreelancerBalance + netAmount, "Freelancer did not receive correct amount");
        
        // Verify platform fee collection logic
        vm.prank(treasury);
        paymentEscrow.withdrawPlatformFees();
        
        assertEq(treasury.balance, fee + initialTreasuryBalance, "Treasury did not receive fees");
        assertEq(address(paymentEscrow).balance, 0, "Escrow should be empty");
    }
}
