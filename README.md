# Bounty Board Protocol 
Production-ready decentralized bounty board platform with Ethos Network reputation integration, AI-powered matching, and a modern Next.js frontend.

<<<<<<< Updated upstream
What It Can Do
Decentralized Bounties: Create, fund, and complete tasks in a trustless environment using smart contracts on Base Sepolia.
Reputation Integration: Seamlessly integrates with Ethos Network to verify user reputation (0-2000 score), ensuring high-quality interactions.
AI-Powered Matching: Utilizes AI services to match developers with bounties that fit their skill sets and reliability scores.
Secure Escrow: Automated payment handling ensures that funds are safe and only released upon valid submission verification.
Modern Interface: A responsive Next.js frontend with Privy authentication for easy wallet and email login.
=======
## What It Can Do

- **Decentralized Bounties**: Create, fund, and complete tasks in a trustless environment using smart contracts on Base Sepolia.
- **Reputation Integration**: Seamlessly integrates with **Ethos Network** to verify user reputation (0-2000 score), ensuring high-quality interactions.
- **AI-Powered Matching**: Utilizes AI services to match developers with bounties that fit their skill sets and reliability scores.
- **Secure Escrow**: Automated payment handling ensures that funds are safe and only released upon valid submission verification.
- **Modern Interface**: A responsive Next.js frontend with Privy authentication for easy wallet and email login.

## 📦 Repository Structure
>>>>>>> Stashed changes


<<<<<<< Updated upstream

<pre>
Repository Structure

backend/
├── contracts/        Solidity smart contracts
├── script/           Deployment scripts
├── test/             Foundry tests
├── sdk/              TypeScript SDK
├── subgraph/         The Graph indexer
├── deployments/      Deployed contract addresses

frontend/
├── src/              App source code
├── public/           Static assets

README.md
</pre>


## 🛠️ Prerequisites

=======
## 🛠️ Prerequisites

>>>>>>> Stashed changes
Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Foundry** (for smart contract development)
- **Git**

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/chiefmmorgs/Bounty-Board-protocol-merge.git
cd Bounty-Board-protocol-merge
```

### 2. Frontend Setup (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 3. Backend Setup (Smart Contracts)

```bash
cd backend
forge install
forge build
forge test
```
<<<<<<< Updated upstream




=======
>>>>>>> Stashed changes
