// Contract addresses from environment variables
export const contracts = {
    bountyRegistry: process.env.NEXT_PUBLIC_BOUNTY_REGISTRY_ADDRESS as `0x${string}`,
    submissionManager: process.env.NEXT_PUBLIC_SUBMISSION_MANAGER_ADDRESS as `0x${string}`,
    paymentEscrow: process.env.NEXT_PUBLIC_PAYMENT_ESCROW_ADDRESS as `0x${string}`,
    reputationOracle: process.env.NEXT_PUBLIC_REPUTATION_ORACLE_ADDRESS as `0x${string}`,
    disputeResolver: process.env.NEXT_PUBLIC_DISPUTE_RESOLVER_ADDRESS as `0x${string}`,
    emergencyPause: process.env.NEXT_PUBLIC_EMERGENCY_PAUSE_ADDRESS as `0x${string}`,
} as const;

// Chain configuration
export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 84532;
