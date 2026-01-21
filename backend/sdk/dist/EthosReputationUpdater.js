"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthosReputationUpdater = void 0;
const EthosService_1 = require("./services/EthosService");
const ethers_1 = require("ethers");
/**
 * Ethos Reputation Updater Service
 * REQUIRED background service for keeping on-chain reputation in sync with Ethos
 */
class EthosReputationUpdater {
    constructor(config) {
        this.isRunning = false;
        // Validate required configuration
        if (!config.ethosApiKey) {
            throw new Error('Ethos API key is REQUIRED - cannot operate without it');
        }
        if (!config.signerPrivateKey) {
            throw new Error('Signer private key is REQUIRED for reputation updates');
        }
        this.ethosService = new EthosService_1.EthosService({
            apiKey: config.ethosApiKey,
        });
        this.signerWallet = new ethers_1.ethers.Wallet(config.signerPrivateKey, config.provider);
        this.reputationOracleContract = new ethers_1.ethers.Contract(config.reputationOracleAddress, config.reputationOracleABI, this.signerWallet);
        this.updateInterval = config.updateIntervalMs || 3600000; // Default: 1 hour
    }
    /**
     * Start automatic reputation updates
     * REQUIRED to keep on-chain data in sync with Ethos
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Updater is already running');
        }
        console.log('Starting Ethos reputation updater...');
        // Verify Ethos API is accessible
        const health = await this.ethosService.healthCheck();
        if (!health.healthy) {
            throw new Error(`Ethos API is not healthy: ${health.error}`);
        }
        this.isRunning = true;
        // Start update loop
        this.runUpdateLoop();
    }
    /**
     * Stop automatic updates
     */
    stop() {
        this.isRunning = false;
        console.log('Stopped Ethos reputation updater');
    }
    /**
     * Update reputation for a single user
     * REQUIRED for individual updates
     */
    async updateUserReputation(userAddress) {
        try {
            // 1. Fetch Ethos score
            const ethosData = await this.ethosService.getScore(userAddress);
            // 2. Calculate platform reputation scores
            const platformScores = this.ethosService.calculatePlatformReputation(ethosData);
            // 3. Generate signature
            const signature = await this.ethosService.generateReputationSignature(userAddress, platformScores.qualityScore, platformScores.reliabilityScore, platformScores.professionalismScore, this.signerWallet.privateKey);
            // 4. Submit on-chain update
            const tx = await this.reputationOracleContract.updateReputation(userAddress, platformScores.qualityScore, platformScores.reliabilityScore, platformScores.professionalismScore, signature);
            const receipt = await tx.wait();
            console.log(`Updated reputation for ${userAddress}: ${platformScores.overallScore}`);
            return {
                success: true,
                txHash: receipt.hash,
            };
        }
        catch (error) {
            console.error(`Failed to update reputation for ${userAddress}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    /**
     * Batch update reputations for multiple users
     * REQUIRED for efficient bulk updates
     */
    async batchUpdateReputations(userAddresses) {
        console.log(`Batch updating ${userAddresses.length} users...`);
        // Fetch all Ethos scores in batch
        const ethosScores = await this.ethosService.batchGetScores(userAddresses);
        const results = [];
        let successful = 0;
        let failed = 0;
        for (const address of userAddresses) {
            const ethosData = ethosScores.get(address);
            if (!ethosData) {
                results.push({
                    address,
                    success: false,
                    error: 'No Ethos data found',
                });
                failed++;
                continue;
            }
            const result = await this.updateUserReputation(address);
            results.push({
                address,
                success: result.success,
                error: result.error,
            });
            if (result.success) {
                successful++;
            }
            else {
                failed++;
            }
            // Rate limiting
            await this.sleep(1000);
        }
        console.log(`Batch update complete: ${successful} successful, ${failed} failed`);
        return { successful, failed, results };
    }
    /**
     * Get users who need reputation updates
     * REQUIRED for identifying stale data
     */
    async getUsersNeedingUpdate() {
        // Query users with outdated reputation (>24 hours old)
        const cutoffTime = Math.floor(Date.now() / 1000) - 86400;
        // This would query the subgraph or contract
        // For now, return empty array (implement based on your indexing)
        return [];
    }
    /**
     * Main update loop
     * REQUIRED background process
     */
    async runUpdateLoop() {
        while (this.isRunning) {
            try {
                console.log('Running reputation update cycle...');
                // Get users needing updates
                const usersToUpdate = await this.getUsersNeedingUpdate();
                if (usersToUpdate.length > 0) {
                    await this.batchUpdateReputations(usersToUpdate);
                }
                else {
                    console.log('No users need reputation updates');
                }
                // Wait for next cycle
                await this.sleep(this.updateInterval);
            }
            catch (error) {
                console.error('Error in update loop:', error);
                // Continue running despite errors
                await this.sleep(60000); // Wait 1 minute before retry
            }
        }
    }
    /**
     * Verify Ethos integration is working
     * REQUIRED health check
     */
    async verifyIntegration() {
        const errors = [];
        // Check Ethos API
        const ethosHealth = await this.ethosService.healthCheck();
        if (!ethosHealth.healthy) {
            errors.push(`Ethos API unhealthy: ${ethosHealth.error}`);
        }
        // Check contract access
        let contractAccessible = false;
        try {
            await this.reputationOracleContract.eventSchemaVersion();
            contractAccessible = true;
        }
        catch (error) {
            errors.push('Cannot access ReputationOracle contract');
        }
        // Check signer authorization
        let signerAuthorized = false;
        try {
            const signerAddress = await this.signerWallet.getAddress();
            signerAuthorized = await this.reputationOracleContract.authorizedUpdaters(signerAddress);
            if (!signerAuthorized) {
                errors.push('Signer is not an authorized updater');
            }
        }
        catch (error) {
            errors.push('Cannot verify signer authorization');
        }
        return {
            ethosApiHealthy: ethosHealth.healthy,
            contractAccessible,
            signerAuthorized,
            errors,
        };
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.EthosReputationUpdater = EthosReputationUpdater;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXRob3NSZXB1dGF0aW9uVXBkYXRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9FdGhvc1JlcHV0YXRpb25VcGRhdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDBEQUE0RTtBQUM1RSxtQ0FBZ0M7QUFFaEM7OztHQUdHO0FBQ0gsTUFBYSxzQkFBc0I7SUFPL0IsWUFBWSxNQU9YO1FBVE8sY0FBUyxHQUFZLEtBQUssQ0FBQztRQVUvQixrQ0FBa0M7UUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSwyQkFBWSxDQUFDO1lBQ2pDLE1BQU0sRUFBRSxNQUFNLENBQUMsV0FBVztTQUM3QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksZUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRWhGLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLGVBQU0sQ0FBQyxRQUFRLENBQy9DLE1BQU0sQ0FBQyx1QkFBdUIsRUFDOUIsTUFBTSxDQUFDLG1CQUFtQixFQUMxQixJQUFJLENBQUMsWUFBWSxDQUNwQixDQUFDO1FBRUYsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLElBQUksT0FBTyxDQUFDLENBQUMsa0JBQWtCO0lBQ2hGLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsS0FBSztRQUNQLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pC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fSBmcm9tICcuL3NlcnZpY2VzL0V0aG9zU2VydmljZSc7XHJcbmltcG9ydCB7IGV0aGVycyB9IGZyb20gJ2V0aGVycyc7XHJcblxyXG4vKipcclxuICogRXRob3MgUmVwdXRhdGlvbiBVcGRhdGVyIFNlcnZpY2VcclxuICogUkVRVUlSRUQgYmFja2dyb3VuZCBzZXJ2aWNlIGZvciBrZWVwaW5nIG9uLWNoYWluIHJlcHV0YXRpb24gaW4gc3luYyB3aXRoIEV0aG9zXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXRob3NSZXB1dGF0aW9uVXBkYXRlciB7XHJcbiAgICBwcml2YXRlIGV0aG9zU2VydmljZTogRXRob3NTZXJ2aWNlO1xyXG4gICAgcHJpdmF0ZSByZXB1dGF0aW9uT3JhY2xlQ29udHJhY3Q6IGV0aGVycy5Db250cmFjdDtcclxuICAgIHByaXZhdGUgc2lnbmVyV2FsbGV0OiBldGhlcnMuV2FsbGV0O1xyXG4gICAgcHJpdmF0ZSB1cGRhdGVJbnRlcnZhbDogbnVtYmVyO1xyXG4gICAgcHJpdmF0ZSBpc1J1bm5pbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IHtcclxuICAgICAgICBldGhvc0FwaUtleTogc3RyaW5nO1xyXG4gICAgICAgIHJlcHV0YXRpb25PcmFjbGVBZGRyZXNzOiBzdHJpbmc7XHJcbiAgICAgICAgcmVwdXRhdGlvbk9yYWNsZUFCSTogYW55W107XHJcbiAgICAgICAgc2lnbmVyUHJpdmF0ZUtleTogc3RyaW5nO1xyXG4gICAgICAgIHByb3ZpZGVyOiBldGhlcnMuUHJvdmlkZXI7XHJcbiAgICAgICAgdXBkYXRlSW50ZXJ2YWxNcz86IG51bWJlcjtcclxuICAgIH0pIHtcclxuICAgICAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBjb25maWd1cmF0aW9uXHJcbiAgICAgICAgaWYgKCFjb25maWcuZXRob3NBcGlLZXkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFdGhvcyBBUEkga2V5IGlzIFJFUVVJUkVEIC0gY2Fubm90IG9wZXJhdGUgd2l0aG91dCBpdCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNvbmZpZy5zaWduZXJQcml2YXRlS2V5KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU2lnbmVyIHByaXZhdGUga2V5IGlzIFJFUVVJUkVEIGZvciByZXB1dGF0aW9uIHVwZGF0ZXMnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuZXRob3NTZXJ2aWNlID0gbmV3IEV0aG9zU2VydmljZSh7XHJcbiAgICAgICAgICAgIGFwaUtleTogY29uZmlnLmV0aG9zQXBpS2V5LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnNpZ25lcldhbGxldCA9IG5ldyBldGhlcnMuV2FsbGV0KGNvbmZpZy5zaWduZXJQcml2YXRlS2V5LCBjb25maWcucHJvdmlkZXIpO1xyXG5cclxuICAgICAgICB0aGlzLnJlcHV0YXRpb25PcmFjbGVDb250cmFjdCA9IG5ldyBldGhlcnMuQ29udHJhY3QoXHJcbiAgICAgICAgICAgIGNvbmZpZy5yZXB1dGF0aW9uT3JhY2xlQWRkcmVzcyxcclxuICAgICAgICAgICAgY29uZmlnLnJlcHV0YXRpb25PcmFjbGVBQkksXHJcbiAgICAgICAgICAgIHRoaXMuc2lnbmVyV2FsbGV0XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IGNvbmZpZy51cGRhdGVJbnRlcnZhbE1zIHx8IDM2MDAwMDA7IC8vIERlZmF1bHQ6IDEgaG91clxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU3RhcnQgYXV0b21hdGljIHJlcHV0YXRpb24gdXBkYXRlc1xyXG4gICAgICogUkVRVUlSRUQgdG8ga2VlcCBvbi1jaGFpbiBkYXRhIGluIHN5bmMgd2l0aCBFdGhvc1xyXG4gICAgICovXHJcbiAgICBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBpZiAodGhpcy5pc1J1bm5pbmcpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVcGRhdGVyIGlzIGFscmVhZHkgcnVubmluZycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coJ1N0YXJ0aW5nIEV0aG9zIHJlcHV0YXRpb24gdXBkYXRlci4uLicpO1xyXG5cclxuICAgICAgICAvLyBWZXJpZnkgRXRob3MgQVBJIGlzIGFjY2Vzc2libGVcclxuICAgICAgICBjb25zdCBoZWFsdGggPSBhd2FpdCB0aGlzLmV0aG9zU2VydmljZS5oZWFsdGhDaGVjaygpO1xyXG4gICAgICAgIGlmICghaGVhbHRoLmhlYWx0aHkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdGhvcyBBUEkgaXMgbm90IGhlYWx0aHk6ICR7aGVhbHRoLmVycm9yfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5pc1J1bm5pbmcgPSB0cnVlO1xyXG5cclxuICAgICAgICAvLyBTdGFydCB1cGRhdGUgbG9vcFxyXG4gICAgICAgIHRoaXMucnVuVXBkYXRlTG9vcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU3RvcCBhdXRvbWF0aWMgdXBkYXRlc1xyXG4gICAgICovXHJcbiAgICBzdG9wKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuaXNSdW5uaW5nID0gZmFsc2U7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1N0b3BwZWQgRXRob3MgcmVwdXRhdGlvbiB1cGRhdGVyJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVcGRhdGUgcmVwdXRhdGlvbiBmb3IgYSBzaW5nbGUgdXNlclxyXG4gICAgICogUkVRVUlSRUQgZm9yIGluZGl2aWR1YWwgdXBkYXRlc1xyXG4gICAgICovXHJcbiAgICBhc3luYyB1cGRhdGVVc2VyUmVwdXRhdGlvbih1c2VyQWRkcmVzczogc3RyaW5nKTogUHJvbWlzZTx7XHJcbiAgICAgICAgc3VjY2VzczogYm9vbGVhbjtcclxuICAgICAgICB0eEhhc2g/OiBzdHJpbmc7XHJcbiAgICAgICAgZXJyb3I/OiBzdHJpbmc7XHJcbiAgICB9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gMS4gRmV0Y2ggRXRob3Mgc2NvcmVcclxuICAgICAgICAgICAgY29uc3QgZXRob3NEYXRhID0gYXdhaXQgdGhpcy5ldGhvc1NlcnZpY2UuZ2V0U2NvcmUodXNlckFkZHJlc3MpO1xyXG5cclxuICAgICAgICAgICAgLy8gMi4gQ2FsY3VsYXRlIHBsYXRmb3JtIHJlcHV0YXRpb24gc2NvcmVzXHJcbiAgICAgICAgICAgIGNvbnN0IHBsYXRmb3JtU2NvcmVzID0gdGhpcy5ldGhvc1NlcnZpY2UuY2FsY3VsYXRlUGxhdGZvcm1SZXB1dGF0aW9uKGV0aG9zRGF0YSk7XHJcblxyXG4gICAgICAgICAgICAvLyAzLiBHZW5lcmF0ZSBzaWduYXR1cmVcclxuICAgICAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gYXdhaXQgdGhpcy5ldGhvc1NlcnZpY2UuZ2VuZXJhdGVSZXB1dGF0aW9uU2lnbmF0dXJlKFxyXG4gICAgICAgICAgICAgICAgdXNlckFkZHJlc3MsXHJcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybVNjb3Jlcy5xdWFsaXR5U2NvcmUsXHJcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybVNjb3Jlcy5yZWxpYWJpbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1TY29yZXMucHJvZmVzc2lvbmFsaXNtU2NvcmUsXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNpZ25lcldhbGxldC5wcml2YXRlS2V5XHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAvLyA0LiBTdWJtaXQgb24tY2hhaW4gdXBkYXRlXHJcbiAgICAgICAgICAgIGNvbnN0IHR4ID0gYXdhaXQgdGhpcy5yZXB1dGF0aW9uT3JhY2xlQ29udHJhY3QudXBkYXRlUmVwdXRhdGlvbihcclxuICAgICAgICAgICAgICAgIHVzZXJBZGRyZXNzLFxyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1TY29yZXMucXVhbGl0eVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1TY29yZXMucmVsaWFiaWxpdHlTY29yZSxcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtU2NvcmVzLnByb2Zlc3Npb25hbGlzbVNjb3JlLFxyXG4gICAgICAgICAgICAgICAgc2lnbmF0dXJlXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZWNlaXB0ID0gYXdhaXQgdHgud2FpdCgpO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0ZWQgcmVwdXRhdGlvbiBmb3IgJHt1c2VyQWRkcmVzc306ICR7cGxhdGZvcm1TY29yZXMub3ZlcmFsbFNjb3JlfWApO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB0eEhhc2g6IHJlY2VpcHQuaGFzaCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIHJlcHV0YXRpb24gZm9yICR7dXNlckFkZHJlc3N9OmAsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEJhdGNoIHVwZGF0ZSByZXB1dGF0aW9ucyBmb3IgbXVsdGlwbGUgdXNlcnNcclxuICAgICAqIFJFUVVJUkVEIGZvciBlZmZpY2llbnQgYnVsayB1cGRhdGVzXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGJhdGNoVXBkYXRlUmVwdXRhdGlvbnModXNlckFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPHtcclxuICAgICAgICBzdWNjZXNzZnVsOiBudW1iZXI7XHJcbiAgICAgICAgZmFpbGVkOiBudW1iZXI7XHJcbiAgICAgICAgcmVzdWx0czogQXJyYXk8eyBhZGRyZXNzOiBzdHJpbmc7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+O1xyXG4gICAgfT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBCYXRjaCB1cGRhdGluZyAke3VzZXJBZGRyZXNzZXMubGVuZ3RofSB1c2Vycy4uLmApO1xyXG5cclxuICAgICAgICAvLyBGZXRjaCBhbGwgRXRob3Mgc2NvcmVzIGluIGJhdGNoXHJcbiAgICAgICAgY29uc3QgZXRob3NTY29yZXMgPSBhd2FpdCB0aGlzLmV0aG9zU2VydmljZS5iYXRjaEdldFNjb3Jlcyh1c2VyQWRkcmVzc2VzKTtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xyXG4gICAgICAgIGxldCBzdWNjZXNzZnVsID0gMDtcclxuICAgICAgICBsZXQgZmFpbGVkID0gMDtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBhZGRyZXNzIG9mIHVzZXJBZGRyZXNzZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZXRob3NEYXRhID0gZXRob3NTY29yZXMuZ2V0KGFkZHJlc3MpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFldGhvc0RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkcmVzcyxcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ05vIEV0aG9zIGRhdGEgZm91bmQnLFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBmYWlsZWQrKztcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnVwZGF0ZVVzZXJSZXB1dGF0aW9uKGFkZHJlc3MpO1xyXG4gICAgICAgICAgICByZXN1bHRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgYWRkcmVzcyxcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3NmdWwrKztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZhaWxlZCsrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBSYXRlIGxpbWl0aW5nXHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgQmF0Y2ggdXBkYXRlIGNvbXBsZXRlOiAke3N1Y2Nlc3NmdWx9IHN1Y2Nlc3NmdWwsICR7ZmFpbGVkfSBmYWlsZWRgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2Vzc2Z1bCwgZmFpbGVkLCByZXN1bHRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdXNlcnMgd2hvIG5lZWQgcmVwdXRhdGlvbiB1cGRhdGVzXHJcbiAgICAgKiBSRVFVSVJFRCBmb3IgaWRlbnRpZnlpbmcgc3RhbGUgZGF0YVxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRVc2Vyc05lZWRpbmdVcGRhdGUoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xyXG4gICAgICAgIC8vIFF1ZXJ5IHVzZXJzIHdpdGggb3V0ZGF0ZWQgcmVwdXRhdGlvbiAoPjI0IGhvdXJzIG9sZClcclxuICAgICAgICBjb25zdCBjdXRvZmZUaW1lID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgLSA4NjQwMDtcclxuXHJcbiAgICAgICAgLy8gVGhpcyB3b3VsZCBxdWVyeSB0aGUgc3ViZ3JhcGggb3IgY29udHJhY3RcclxuICAgICAgICAvLyBGb3Igbm93LCByZXR1cm4gZW1wdHkgYXJyYXkgKGltcGxlbWVudCBiYXNlZCBvbiB5b3VyIGluZGV4aW5nKVxyXG4gICAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIE1haW4gdXBkYXRlIGxvb3BcclxuICAgICAqIFJFUVVJUkVEIGJhY2tncm91bmQgcHJvY2Vzc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIHJ1blVwZGF0ZUxvb3AoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgd2hpbGUgKHRoaXMuaXNSdW5uaW5nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUnVubmluZyByZXB1dGF0aW9uIHVwZGF0ZSBjeWNsZS4uLicpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEdldCB1c2VycyBuZWVkaW5nIHVwZGF0ZXNcclxuICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJzVG9VcGRhdGUgPSBhd2FpdCB0aGlzLmdldFVzZXJzTmVlZGluZ1VwZGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh1c2Vyc1RvVXBkYXRlLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmJhdGNoVXBkYXRlUmVwdXRhdGlvbnModXNlcnNUb1VwZGF0ZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdObyB1c2VycyBuZWVkIHJlcHV0YXRpb24gdXBkYXRlcycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIFdhaXQgZm9yIG5leHQgY3ljbGVcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAodGhpcy51cGRhdGVJbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbiB1cGRhdGUgbG9vcDonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAvLyBDb250aW51ZSBydW5uaW5nIGRlc3BpdGUgZXJyb3JzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDYwMDAwKTsgLy8gV2FpdCAxIG1pbnV0ZSBiZWZvcmUgcmV0cnlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFZlcmlmeSBFdGhvcyBpbnRlZ3JhdGlvbiBpcyB3b3JraW5nXHJcbiAgICAgKiBSRVFVSVJFRCBoZWFsdGggY2hlY2tcclxuICAgICAqL1xyXG4gICAgYXN5bmMgdmVyaWZ5SW50ZWdyYXRpb24oKTogUHJvbWlzZTx7XHJcbiAgICAgICAgZXRob3NBcGlIZWFsdGh5OiBib29sZWFuO1xyXG4gICAgICAgIGNvbnRyYWN0QWNjZXNzaWJsZTogYm9vbGVhbjtcclxuICAgICAgICBzaWduZXJBdXRob3JpemVkOiBib29sZWFuO1xyXG4gICAgICAgIGVycm9yczogc3RyaW5nW107XHJcbiAgICB9PiB7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgICAgICAvLyBDaGVjayBFdGhvcyBBUElcclxuICAgICAgICBjb25zdCBldGhvc0hlYWx0aCA9IGF3YWl0IHRoaXMuZXRob3NTZXJ2aWNlLmhlYWx0aENoZWNrKCk7XHJcbiAgICAgICAgaWYgKCFldGhvc0hlYWx0aC5oZWFsdGh5KSB7XHJcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGBFdGhvcyBBUEkgdW5oZWFsdGh5OiAke2V0aG9zSGVhbHRoLmVycm9yfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgY29udHJhY3QgYWNjZXNzXHJcbiAgICAgICAgbGV0IGNvbnRyYWN0QWNjZXNzaWJsZSA9IGZhbHNlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVwdXRhdGlvbk9yYWNsZUNvbnRyYWN0LmV2ZW50U2NoZW1hVmVyc2lvbigpO1xyXG4gICAgICAgICAgICBjb250cmFjdEFjY2Vzc2libGUgPSB0cnVlO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKCdDYW5ub3QgYWNjZXNzIFJlcHV0YXRpb25PcmFjbGUgY29udHJhY3QnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIENoZWNrIHNpZ25lciBhdXRob3JpemF0aW9uXHJcbiAgICAgICAgbGV0IHNpZ25lckF1dGhvcml6ZWQgPSBmYWxzZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzaWduZXJBZGRyZXNzID0gYXdhaXQgdGhpcy5zaWduZXJXYWxsZXQuZ2V0QWRkcmVzcygpO1xyXG4gICAgICAgICAgICBzaWduZXJBdXRob3JpemVkID0gYXdhaXQgdGhpcy5yZXB1dGF0aW9uT3JhY2xlQ29udHJhY3QuYXV0aG9yaXplZFVwZGF0ZXJzKHNpZ25lckFkZHJlc3MpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFzaWduZXJBdXRob3JpemVkKSB7XHJcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCgnU2lnbmVyIGlzIG5vdCBhbiBhdXRob3JpemVkIHVwZGF0ZXInKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKCdDYW5ub3QgdmVyaWZ5IHNpZ25lciBhdXRob3JpemF0aW9uJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBldGhvc0FwaUhlYWx0aHk6IGV0aG9zSGVhbHRoLmhlYWx0aHksXHJcbiAgICAgICAgICAgIGNvbnRyYWN0QWNjZXNzaWJsZSxcclxuICAgICAgICAgICAgc2lnbmVyQXV0aG9yaXplZCxcclxuICAgICAgICAgICAgZXJyb3JzLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzbGVlcChtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==