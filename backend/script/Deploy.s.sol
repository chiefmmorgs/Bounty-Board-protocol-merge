// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "../contracts/ReputationOracle.sol";
import "../contracts/PaymentEscrow.sol";
import "../contracts/BountyRegistry.sol";
import "../contracts/SubmissionManager.sol";
import "../contracts/DisputeResolver.sol";
import "../contracts/EmergencyPause.sol";

/**
 * @title DeployScript
 * @notice Production-equivalent deployment script for all contracts
 * @dev Deploys with transparent proxy pattern and proper initialization
 */
contract DeployScript is Script {
    
    // Deployment addresses
    ProxyAdmin public proxyAdmin;
    
    // Implementation contracts
    ReputationOracle public reputationOracleImpl;
    PaymentEscrow public paymentEscrowImpl;
    BountyRegistry public bountyRegistryImpl;
    SubmissionManager public submissionManagerImpl;
    DisputeResolver public disputeResolverImpl;
    EmergencyPause public emergencyPauseImpl;
    
    // Proxy contracts
    TransparentUpgradeableProxy public reputationOracleProxy;
    TransparentUpgradeableProxy public paymentEscrowProxy;
    TransparentUpgradeableProxy public bountyRegistryProxy;
    TransparentUpgradeableProxy public submissionManagerProxy;
    TransparentUpgradeableProxy public disputeResolverProxy;
    TransparentUpgradeableProxy public emergencyPauseProxy;
    
    // Wrapped proxies
    ReputationOracle public reputationOracle;
    PaymentEscrow public paymentEscrow;
    BountyRegistry public bountyRegistry;
    SubmissionManager public submissionManager;
    DisputeResolver public disputeResolver;
    EmergencyPause public emergencyPause;
    
    // Configuration
    address public admin;
    address public treasury;
    uint256 public platformFeePercentage = 1000; // 10%
    uint256 public appealThreshold = 5000 ether; // $5000 in wei
    
    function run() external {
        // Get deployer from environment or use default
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        admin = vm.addr(deployerPrivateKey);
        treasury = vm.envOr("TREASURY_ADDRESS", admin);
        
        console.log("Deploying with admin:", admin);
        console.log("Treasury:", treasury);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Deploy ProxyAdmin
        console.log("\n=== Step 1: Deploying ProxyAdmin ===");
        proxyAdmin = new ProxyAdmin(admin);
        console.log("ProxyAdmin deployed at:", address(proxyAdmin));
        
        // Step 2: Deploy Implementation Contracts
        console.log("\n=== Step 2: Deploying Implementation Contracts ===");
        _deployImplementations();
        
        // Step 3: Deploy Proxies
        console.log("\n=== Step 3: Deploying Proxies ===");
        _deployProxies();
        
        // Step 4: Initialize Contracts
        console.log("\n=== Step 4: Initializing Contracts ===");
        _initializeContracts();
        
        // Step 5: Setup Roles and Permissions
        console.log("\n=== Step 5: Setting up Roles and Permissions ===");
        _setupRoles();
        
        // Step 6: Set Contract References
        console.log("\n=== Step 6: Setting Contract References ===");
        _setContractReferences();
        
        // Step 7: Verify Deployment
        console.log("\n=== Step 7: Verifying Deployment ===");
        _verifyDeployment();
        
        vm.stopBroadcast();
        
        // Step 8: Save Deployment Addresses
        _saveDeploymentAddresses();
        
        console.log("\n=== Deployment Complete ===");
        _printSummary();
    }
    
    function _deployImplementations() internal {
        reputationOracleImpl = new ReputationOracle();
        console.log("ReputationOracle implementation:", address(reputationOracleImpl));
        
        paymentEscrowImpl = new PaymentEscrow();
        console.log("PaymentEscrow implementation:", address(paymentEscrowImpl));
        
        bountyRegistryImpl = new BountyRegistry();
        console.log("BountyRegistry implementation:", address(bountyRegistryImpl));
        
        submissionManagerImpl = new SubmissionManager();
        console.log("SubmissionManager implementation:", address(submissionManagerImpl));
        
        disputeResolverImpl = new DisputeResolver();
        console.log("DisputeResolver implementation:", address(disputeResolverImpl));
        
        emergencyPauseImpl = new EmergencyPause();
        console.log("EmergencyPause implementation:", address(emergencyPauseImpl));
    }
    
    function _deployProxies() internal {
        // ReputationOracle proxy
        bytes memory reputationOracleInitData = abi.encodeWithSelector(
            ReputationOracle.initialize.selector,
            admin
        );
        reputationOracleProxy = new TransparentUpgradeableProxy(
            address(reputationOracleImpl),
            address(proxyAdmin),
            reputationOracleInitData
        );
        reputationOracle = ReputationOracle(address(reputationOracleProxy));
        console.log("ReputationOracle proxy:", address(reputationOracle));
        
        // PaymentEscrow proxy
        bytes memory paymentEscrowInitData = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            admin,
            treasury,
            platformFeePercentage
        );
        paymentEscrowProxy = new TransparentUpgradeableProxy(
            address(paymentEscrowImpl),
            address(proxyAdmin),
            paymentEscrowInitData
        );
        paymentEscrow = PaymentEscrow(payable(address(paymentEscrowProxy)));
        console.log("PaymentEscrow proxy:", address(paymentEscrow));
        
        // BountyRegistry proxy
        bytes memory bountyRegistryInitData = abi.encodeWithSelector(
            BountyRegistry.initialize.selector,
            admin,
            address(reputationOracle),
            address(paymentEscrow)
        );
        bountyRegistryProxy = new TransparentUpgradeableProxy(
            address(bountyRegistryImpl),
            address(proxyAdmin),
            bountyRegistryInitData
        );
        bountyRegistry = BountyRegistry(address(bountyRegistryProxy));
        console.log("BountyRegistry proxy:", address(bountyRegistry));
        
        // SubmissionManager proxy
        bytes memory submissionManagerInitData = abi.encodeWithSelector(
            SubmissionManager.initialize.selector,
            admin,
            address(bountyRegistry),
            address(paymentEscrow),
            address(reputationOracle)
        );
        submissionManagerProxy = new TransparentUpgradeableProxy(
            address(submissionManagerImpl),
            address(proxyAdmin),
            submissionManagerInitData
        );
        submissionManager = SubmissionManager(address(submissionManagerProxy));
        console.log("SubmissionManager proxy:", address(submissionManager));
        
        // DisputeResolver proxy
        bytes memory disputeResolverInitData = abi.encodeWithSelector(
            DisputeResolver.initialize.selector,
            admin,
            address(bountyRegistry),
            address(paymentEscrow),
            address(reputationOracle),
            appealThreshold
        );
        disputeResolverProxy = new TransparentUpgradeableProxy(
            address(disputeResolverImpl),
            address(proxyAdmin),
            disputeResolverInitData
        );
        disputeResolver = DisputeResolver(address(disputeResolverProxy));
        console.log("DisputeResolver proxy:", address(disputeResolver));
        
        // EmergencyPause proxy
        bytes memory emergencyPauseInitData = abi.encodeWithSelector(
            EmergencyPause.initialize.selector,
            admin
        );
        emergencyPauseProxy = new TransparentUpgradeableProxy(
            address(emergencyPauseImpl),
            address(proxyAdmin),
            emergencyPauseInitData
        );
        emergencyPause = EmergencyPause(address(emergencyPauseProxy));
        console.log("EmergencyPause proxy:", address(emergencyPause));
    }
    
    function _initializeContracts() internal {
        // Contracts are initialized during proxy deployment
        console.log("All contracts initialized via proxy constructors");
    }
    
    function _setupRoles() internal {
        // PaymentEscrow roles
        paymentEscrow.grantRole(paymentEscrow.BOUNTY_REGISTRY_ROLE(), address(bountyRegistry));
        paymentEscrow.grantRole(paymentEscrow.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        paymentEscrow.grantRole(paymentEscrow.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        console.log("PaymentEscrow roles granted");
        
        // ReputationOracle roles
        reputationOracle.grantRole(reputationOracle.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        reputationOracle.grantRole(reputationOracle.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        console.log("ReputationOracle roles granted");
        
        // BountyRegistry roles
        bountyRegistry.grantRole(bountyRegistry.PAUSER_ROLE(), address(emergencyPause));
        bountyRegistry.grantRole(bountyRegistry.SUBMISSION_MANAGER_ROLE(), address(submissionManager));
        bountyRegistry.grantRole(bountyRegistry.DISPUTE_RESOLVER_ROLE(), address(disputeResolver));
        console.log("BountyRegistry roles granted");
        
        // SubmissionManager roles
        submissionManager.grantRole(submissionManager.PAUSER_ROLE(), address(emergencyPause));
        console.log("SubmissionManager roles granted");
        
        // DisputeResolver roles
        disputeResolver.grantRole(disputeResolver.PAUSER_ROLE(), address(emergencyPause));
        console.log("DisputeResolver roles granted");
    }
    
    function _setContractReferences() internal {
        paymentEscrow.setContractReferences(
            address(bountyRegistry),
            address(submissionManager),
            address(disputeResolver),
            address(reputationOracle)
        );
        console.log("PaymentEscrow contract references set");
    }
    
    function _verifyDeployment() internal view {
        // Verify ProxyAdmin
        require(proxyAdmin.owner() == admin, "ProxyAdmin owner mismatch");
        
        // Verify ReputationOracle
        require(reputationOracle.hasRole(reputationOracle.ADMIN_ROLE(), admin), "ReputationOracle admin role missing");
        
        // Verify PaymentEscrow
        require(paymentEscrow.platformTreasury() == treasury, "PaymentEscrow treasury mismatch");
        require(paymentEscrow.platformFeePercentage() == platformFeePercentage, "PaymentEscrow fee mismatch");
        
        // Verify BountyRegistry
        require(address(bountyRegistry.reputationOracle()) == address(reputationOracle), "BountyRegistry oracle mismatch");
        require(address(bountyRegistry.paymentEscrow()) == address(paymentEscrow), "BountyRegistry escrow mismatch");
        
        // Verify SubmissionManager
        require(address(submissionManager.bountyRegistry()) == address(bountyRegistry), "SubmissionManager registry mismatch");
        
        // Verify DisputeResolver
        require(disputeResolver.appealThreshold() == appealThreshold, "DisputeResolver threshold mismatch");
        
        console.log("All deployment verifications passed");
    }
    
    function _saveDeploymentAddresses() internal {
        string memory json = "deployment";
        
        vm.serializeAddress(json, "ProxyAdmin", address(proxyAdmin));
        vm.serializeAddress(json, "ReputationOracle", address(reputationOracle));
        vm.serializeAddress(json, "PaymentEscrow", address(paymentEscrow));
        vm.serializeAddress(json, "BountyRegistry", address(bountyRegistry));
        vm.serializeAddress(json, "SubmissionManager", address(submissionManager));
        vm.serializeAddress(json, "DisputeResolver", address(disputeResolver));
        string memory finalJson = vm.serializeAddress(json, "EmergencyPause", address(emergencyPause));
        
        string memory deploymentFile = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, deploymentFile);
        
        console.log("\nDeployment addresses saved to:", deploymentFile);
    }
    
    function _printSummary() internal view {
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Admin:", admin);
        console.log("Treasury:", treasury);
        console.log("Platform Fee:", platformFeePercentage / 100, "%");
        console.log("\nCore Contracts:");
        console.log("  ProxyAdmin:", address(proxyAdmin));
        console.log("  ReputationOracle:", address(reputationOracle));
        console.log("  PaymentEscrow:", address(paymentEscrow));
        console.log("  BountyRegistry:", address(bountyRegistry));
        console.log("  SubmissionManager:", address(submissionManager));
        console.log("  DisputeResolver:", address(disputeResolver));
        console.log("  EmergencyPause:", address(emergencyPause));
        console.log("========================================\n");
    }
}
