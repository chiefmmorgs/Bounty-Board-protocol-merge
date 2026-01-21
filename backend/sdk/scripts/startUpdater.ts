/**
 * Ethos Reputation Updater Runner
 * 
 * This script starts the background service that syncs Ethos scores
 * to the on-chain ReputationOracle contract.
 * 
 * Usage: npx ts-node scripts/startUpdater.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { EthosReputationUpdater } from '../src/EthosReputationUpdater';

// Import ABI (generate from contracts using: forge inspect ReputationOracle abi > sdk/abis/ReputationOracle.json)
import ReputationOracleABI from '../abis/ReputationOracle.json';

async function main() {
    console.log('='.repeat(50));
    console.log('Ethos Reputation Updater - Starting...');
    console.log('='.repeat(50));

    // Validate environment variables
    const requiredEnvVars = [
        'RPC_URL',
        'ETHOS_API_KEY',
        'REPUTATION_ORACLE_ADDRESS',
        'SIGNER_PRIVATE_KEY',
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            console.error(`❌ Missing required environment variable: ${envVar}`);
            console.error('   Please copy .env.example to .env and fill in your values.');
            process.exit(1);
        }
    }

    const config = {
        ethosApiKey: process.env.ETHOS_API_KEY!,
        reputationOracleAddress: process.env.REPUTATION_ORACLE_ADDRESS!,
        reputationOracleABI: ReputationOracleABI,
        signerPrivateKey: process.env.SIGNER_PRIVATE_KEY!,
        provider: new ethers.JsonRpcProvider(process.env.RPC_URL),
        updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '3600000'),
    };

    console.log(`\n📡 RPC URL: ${process.env.RPC_URL}`);
    console.log(`📜 Oracle Address: ${config.reputationOracleAddress}`);
    console.log(`⏱️  Update Interval: ${config.updateIntervalMs / 1000}s\n`);

    // Test provider connection with retries (Base Sepolia RPC can be flaky)
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const blockNumber = await config.provider.getBlockNumber();
            console.log(`✅ Provider connected - Block: ${blockNumber}`);

            // Test contract call directly
            const testContract = new ethers.Contract(
                config.reputationOracleAddress,
                ['function BRONZE_THRESHOLD() view returns (uint16)'],
                config.provider
            );
            const threshold = await testContract.BRONZE_THRESHOLD();
            console.log(`✅ Contract reachable - BRONZE_THRESHOLD: ${threshold}`);
            lastError = null;
            break;
        } catch (error) {
            lastError = error as Error;
            const isRpcError = lastError.message.includes('no backend') ||
                lastError.message.includes('CALL_EXCEPTION');

            if (isRpcError && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ RPC issue (attempt ${attempt}/${maxRetries}), retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error(`❌ Provider/Contract test failed after ${attempt} attempts:`, lastError.message);
            }
        }
    }

    if (lastError) {
        console.error('\n💡 The Base Sepolia public RPC is having issues.');
        console.error('   Try using a different RPC provider (Alchemy, Infura, etc.)');
        process.exit(1);
    }

    const updater = new EthosReputationUpdater(config);

    // Verify integration before starting
    console.log('Verifying integration...');
    const status = await updater.verifyIntegration();

    if (status.errors.length > 0) {
        console.error('❌ Integration verification failed:');
        status.errors.forEach(err => console.error(`   - ${err}`));

        if (!status.signerAuthorized) {
            console.error('\n⚠️  Your signer is not authorized. Run this on the oracle contract:');
            console.error(`   setAuthorizedUpdater(<your_signer_address>, true)`);
        }
        process.exit(1);
    }

    console.log('✅ Integration verified successfully!');
    console.log(`   - Ethos API: ${status.ethosApiHealthy ? '✅' : '❌'}`);
    console.log(`   - Contract: ${status.contractAccessible ? '✅' : '❌'}`);
    console.log(`   - Signer: ${status.signerAuthorized ? '✅' : '❌'}`);

    // Start the updater
    console.log('\n🚀 Starting reputation updater...');
    await updater.start();

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        updater.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nShutting down...');
        updater.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
