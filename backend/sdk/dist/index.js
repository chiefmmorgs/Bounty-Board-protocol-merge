"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyBoardSDK = void 0;
const types_1 = require("./types");
const BountyService_1 = require("./services/BountyService");
const ReputationService_1 = require("./services/ReputationService");
const QueryService_1 = require("./services/QueryService");
// Import ABIs (these would be generated from contracts)
const BountyRegistry_json_1 = __importDefault(require("../abis/BountyRegistry.json"));
const ReputationOracle_json_1 = __importDefault(require("../abis/ReputationOracle.json"));
/**
 * BountyBoardSDK - Main SDK class
 * Provides access to all services with business logic
 * No UI components, only logic layer
 */
class BountyBoardSDK {
    constructor(config, signer) {
        this.config = config;
        this.signer = signer;
        // Initialize services
        this.bounty = new BountyService_1.BountyService(config, signer, BountyRegistry_json_1.default);
        this.reputation = new ReputationService_1.ReputationService(config, signer, ReputationOracle_json_1.default);
        if (config.subgraphUrl) {
            this.query = new QueryService_1.QueryService(config.subgraphUrl);
        }
        else {
            // Fallback to direct contract queries if no subgraph
            this.query = new QueryService_1.QueryService('');
        }
    }
    /**
     * Initialize SDK with configuration
     * Factory method with validation
     */
    static async initialize(config, signer) {
        // Validate configuration
        const validatedConfig = types_1.ConfigSchema.parse(config);
        // Verify signer is connected
        const address = await signer.getAddress();
        if (!address) {
            throw new Error('Signer not connected');
        }
        // Verify network
        const provider = signer.provider;
        if (!provider) {
            throw new Error('Signer has no provider');
        }
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== validatedConfig.chainId) {
            throw new Error(`Network mismatch: expected ${validatedConfig.chainId}, got ${network.chainId}`);
        }
        return new BountyBoardSDK(validatedConfig, signer);
    }
    /**
     * Get current user address
     * Utility method
     */
    async getCurrentUser() {
        return await this.signer.getAddress();
    }
    /**
     * Get current network
     * Utility method
     */
    async getNetwork() {
        const provider = this.signer.provider;
        if (!provider) {
            throw new Error('No provider available');
        }
        const network = await provider.getNetwork();
        return {
            chainId: Number(network.chainId),
            name: network.name,
        };
    }
    /**
     * Get configuration
     * Read-only access
     */
    getConfig() {
        return Object.freeze({ ...this.config });
    }
}
exports.BountyBoardSDK = BountyBoardSDK;
// Export all types and services
__exportStar(require("./types"), exports);
__exportStar(require("./services/BountyService"), exports);
__exportStar(require("./services/ReputationService"), exports);
__exportStar(require("./services/QueryService"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxtQ0FBK0M7QUFDL0MsNERBQXlEO0FBQ3pELG9FQUFpRTtBQUNqRSwwREFBdUQ7QUFFdkQsd0RBQXdEO0FBQ3hELHNGQUE0RDtBQUM1RCwwRkFBZ0U7QUFFaEU7Ozs7R0FJRztBQUNILE1BQWEsY0FBYztJQUt2QixZQUNZLE1BQWMsRUFDZCxNQUFjO1FBRGQsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUNkLFdBQU0sR0FBTixNQUFNLENBQVE7UUFFdEIsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSw2QkFBYSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsNkJBQWlCLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUkscUNBQWlCLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSwrQkFBbUIsQ0FBQyxDQUFDO1FBRTdFLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSwyQkFBWSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN0RCxDQUFDO2FBQU0sQ0FBQztZQUNKLHFEQUFxRDtZQUNyRCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksMkJBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUNuQixNQUFjLEVBQ2QsTUFBYztRQUVkLHlCQUF5QjtRQUN6QixNQUFNLGVBQWUsR0FBRyxvQkFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVuRCw2QkFBNkI7UUFDN0IsTUFBTSxPQUFPLEdBQUcsTUFBTSxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxpQkFBaUI7UUFDakIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNqQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDWixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzVDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEQsTUFBTSxJQUFJLEtBQUssQ0FDWCw4QkFBOEIsZUFBZSxDQUFDLE9BQU8sU0FBUyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQ2xGLENBQUM7UUFDTixDQUFDO1FBRUQsT0FBTyxJQUFJLGNBQWMsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxjQUFjO1FBQ2hCLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsVUFBVTtRQUNaLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDNUMsT0FBTztZQUNILE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNoQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7U0FDckIsQ0FBQztJQUNOLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTO1FBQ0wsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0o7QUF0RkQsd0NBc0ZDO0FBRUQsZ0NBQWdDO0FBQ2hDLDBDQUF3QjtBQUN4QiwyREFBeUM7QUFDekMsK0RBQTZDO0FBQzdDLDBEQUF3QyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV0aGVycywgU2lnbmVyIH0gZnJvbSAnZXRoZXJzJztcclxuaW1wb3J0IHsgQ29uZmlnLCBDb25maWdTY2hlbWEgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgQm91bnR5U2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvQm91bnR5U2VydmljZSc7XHJcbmltcG9ydCB7IFJlcHV0YXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9SZXB1dGF0aW9uU2VydmljZSc7XHJcbmltcG9ydCB7IFF1ZXJ5U2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvUXVlcnlTZXJ2aWNlJztcclxuXHJcbi8vIEltcG9ydCBBQklzICh0aGVzZSB3b3VsZCBiZSBnZW5lcmF0ZWQgZnJvbSBjb250cmFjdHMpXHJcbmltcG9ydCBCb3VudHlSZWdpc3RyeUFCSSBmcm9tICcuLi9hYmlzL0JvdW50eVJlZ2lzdHJ5Lmpzb24nO1xyXG5pbXBvcnQgUmVwdXRhdGlvbk9yYWNsZUFCSSBmcm9tICcuLi9hYmlzL1JlcHV0YXRpb25PcmFjbGUuanNvbic7XHJcblxyXG4vKipcclxuICogQm91bnR5Qm9hcmRTREsgLSBNYWluIFNESyBjbGFzc1xyXG4gKiBQcm92aWRlcyBhY2Nlc3MgdG8gYWxsIHNlcnZpY2VzIHdpdGggYnVzaW5lc3MgbG9naWNcclxuICogTm8gVUkgY29tcG9uZW50cywgb25seSBsb2dpYyBsYXllclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJvdW50eUJvYXJkU0RLIHtcclxuICAgIHB1YmxpYyBib3VudHk6IEJvdW50eVNlcnZpY2U7XHJcbiAgICBwdWJsaWMgcmVwdXRhdGlvbjogUmVwdXRhdGlvblNlcnZpY2U7XHJcbiAgICBwdWJsaWMgcXVlcnk6IFF1ZXJ5U2VydmljZTtcclxuXHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgIHByaXZhdGUgY29uZmlnOiBDb25maWcsXHJcbiAgICAgICAgcHJpdmF0ZSBzaWduZXI6IFNpZ25lclxyXG4gICAgKSB7XHJcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBzZXJ2aWNlc1xyXG4gICAgICAgIHRoaXMuYm91bnR5ID0gbmV3IEJvdW50eVNlcnZpY2UoY29uZmlnLCBzaWduZXIsIEJvdW50eVJlZ2lzdHJ5QUJJKTtcclxuICAgICAgICB0aGlzLnJlcHV0YXRpb24gPSBuZXcgUmVwdXRhdGlvblNlcnZpY2UoY29uZmlnLCBzaWduZXIsIFJlcHV0YXRpb25PcmFjbGVBQkkpO1xyXG5cclxuICAgICAgICBpZiAoY29uZmlnLnN1YmdyYXBoVXJsKSB7XHJcbiAgICAgICAgICAgIHRoaXMucXVlcnkgPSBuZXcgUXVlcnlTZXJ2aWNlKGNvbmZpZy5zdWJncmFwaFVybCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gZGlyZWN0IGNvbnRyYWN0IHF1ZXJpZXMgaWYgbm8gc3ViZ3JhcGhcclxuICAgICAgICAgICAgdGhpcy5xdWVyeSA9IG5ldyBRdWVyeVNlcnZpY2UoJycpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemUgU0RLIHdpdGggY29uZmlndXJhdGlvblxyXG4gICAgICogRmFjdG9yeSBtZXRob2Qgd2l0aCB2YWxpZGF0aW9uXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhc3luYyBpbml0aWFsaXplKFxyXG4gICAgICAgIGNvbmZpZzogQ29uZmlnLFxyXG4gICAgICAgIHNpZ25lcjogU2lnbmVyXHJcbiAgICApOiBQcm9taXNlPEJvdW50eUJvYXJkU0RLPiB7XHJcbiAgICAgICAgLy8gVmFsaWRhdGUgY29uZmlndXJhdGlvblxyXG4gICAgICAgIGNvbnN0IHZhbGlkYXRlZENvbmZpZyA9IENvbmZpZ1NjaGVtYS5wYXJzZShjb25maWcpO1xyXG5cclxuICAgICAgICAvLyBWZXJpZnkgc2lnbmVyIGlzIGNvbm5lY3RlZFxyXG4gICAgICAgIGNvbnN0IGFkZHJlc3MgPSBhd2FpdCBzaWduZXIuZ2V0QWRkcmVzcygpO1xyXG4gICAgICAgIGlmICghYWRkcmVzcykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NpZ25lciBub3QgY29ubmVjdGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBWZXJpZnkgbmV0d29ya1xyXG4gICAgICAgIGNvbnN0IHByb3ZpZGVyID0gc2lnbmVyLnByb3ZpZGVyO1xyXG4gICAgICAgIGlmICghcHJvdmlkZXIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTaWduZXIgaGFzIG5vIHByb3ZpZGVyJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBuZXR3b3JrID0gYXdhaXQgcHJvdmlkZXIuZ2V0TmV0d29yaygpO1xyXG4gICAgICAgIGlmIChOdW1iZXIobmV0d29yay5jaGFpbklkKSAhPT0gdmFsaWRhdGVkQ29uZmlnLmNoYWluSWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgICAgYE5ldHdvcmsgbWlzbWF0Y2g6IGV4cGVjdGVkICR7dmFsaWRhdGVkQ29uZmlnLmNoYWluSWR9LCBnb3QgJHtuZXR3b3JrLmNoYWluSWR9YFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBCb3VudHlCb2FyZFNESyh2YWxpZGF0ZWRDb25maWcsIHNpZ25lcik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgY3VycmVudCB1c2VyIGFkZHJlc3NcclxuICAgICAqIFV0aWxpdHkgbWV0aG9kXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldEN1cnJlbnRVc2VyKCk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc2lnbmVyLmdldEFkZHJlc3MoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBjdXJyZW50IG5ldHdvcmtcclxuICAgICAqIFV0aWxpdHkgbWV0aG9kXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldE5ldHdvcmsoKTogUHJvbWlzZTx7IGNoYWluSWQ6IG51bWJlcjsgbmFtZTogc3RyaW5nIH0+IHtcclxuICAgICAgICBjb25zdCBwcm92aWRlciA9IHRoaXMuc2lnbmVyLnByb3ZpZGVyO1xyXG4gICAgICAgIGlmICghcHJvdmlkZXIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBwcm92aWRlciBhdmFpbGFibGUnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IG5ldHdvcmsgPSBhd2FpdCBwcm92aWRlci5nZXROZXR3b3JrKCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY2hhaW5JZDogTnVtYmVyKG5ldHdvcmsuY2hhaW5JZCksXHJcbiAgICAgICAgICAgIG5hbWU6IG5ldHdvcmsubmFtZSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IGNvbmZpZ3VyYXRpb25cclxuICAgICAqIFJlYWQtb25seSBhY2Nlc3NcclxuICAgICAqL1xyXG4gICAgZ2V0Q29uZmlnKCk6IFJlYWRvbmx5PENvbmZpZz4ge1xyXG4gICAgICAgIHJldHVybiBPYmplY3QuZnJlZXplKHsgLi4udGhpcy5jb25maWcgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEV4cG9ydCBhbGwgdHlwZXMgYW5kIHNlcnZpY2VzXHJcbmV4cG9ydCAqIGZyb20gJy4vdHlwZXMnO1xyXG5leHBvcnQgKiBmcm9tICcuL3NlcnZpY2VzL0JvdW50eVNlcnZpY2UnO1xyXG5leHBvcnQgKiBmcm9tICcuL3NlcnZpY2VzL1JlcHV0YXRpb25TZXJ2aWNlJztcclxuZXhwb3J0ICogZnJvbSAnLi9zZXJ2aWNlcy9RdWVyeVNlcnZpY2UnO1xyXG4iXX0=