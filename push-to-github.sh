#!/bin/bash
# Run from bounty-board-monorepo folder

set -e

echo "🔧 Initializing git..."
git init

echo "📡 Adding remote..."
git remote add origin https://github.com/chiefmmorgs/Bounty-Board-protocol-merge.git

echo "📁 Adding files..."
git add .

echo "💾 Committing..."
git commit -m "Add complete frontend source code"

echo "🚀 Pushing to GitHub..."
git branch -M main
git push -f origin main

echo ""
echo "✅ Done! Now go to Vercel:"
echo "   1. Set Root Directory to: frontend"
echo "   2. Add environment variables"
echo "   3. Redeploy"
