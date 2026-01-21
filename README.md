# Bounty Board Protocol - Full Stack Monorepo

Production-ready decentralized bounty board platform with Ethos Network reputation integration, AI-powered matching, and a modern Next.js frontend.

## 📦 Repository Structure

```
├── backend/          # Smart contracts, SDK, and backend services
│   ├── contracts/    # Solidity smart contracts
│   ├── script/       # Deployment scripts
│   ├── test/         # Foundry tests
│   ├── sdk/          # TypeScript SDK
│   ├── subgraph/     # The Graph indexer
│   └── deployments/  # Deployed contract addresses
├── frontend/         # Next.js web application
│   ├── src/          # App source code
│   └── public/       # Static assets
└── README.md
```

## 🚀 Quick Start

### Backend (Smart Contracts)

```bash
cd backend

# Install Foundry dependencies
forge install

# Compile contracts
forge build

# Run tests
forge test
```

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

## 🌐 Deployment

### Frontend (Vercel)

Deploy the frontend to Vercel with these settings:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |

Required environment variables on Vercel:
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_BOUNTY_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_SUBMISSION_MANAGER_ADDRESS`
- `NEXT_PUBLIC_PAYMENT_ESCROW_ADDRESS`
- `NEXT_PUBLIC_REPUTATION_ORACLE_ADDRESS`
- `NEXT_PUBLIC_DISPUTE_RESOLVER_ADDRESS`
- `NEXT_PUBLIC_EMERGENCY_PAUSE_ADDRESS`

### Backend (Base Sepolia)

Smart contracts are deployed to Base Sepolia. See `backend/deployments/` for addresses.

## 📚 Documentation

- [Ethos Integration](./backend/ETHOS_INTEGRATION.md) - Ethos Network integration guide
- [AI Matching](./backend/AI_MATCHING.md) - AI services documentation
- [Deployment Guide](./backend/DEPLOYMENT.md) - Contract deployment instructions

## 🔗 Links

- **Ethos Network**: https://ethos.network
- **Base Sepolia**: Chain ID 84532

## 📄 License

MIT
