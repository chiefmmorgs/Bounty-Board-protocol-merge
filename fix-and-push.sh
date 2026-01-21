#!/bin/bash
# Run from bounty-board-monorepo folder

set -e

echo "📁 Adding fixed files..."
git add .

echo "💾 Committing fixes..."
git commit -m "Fix BigInt literals for Vercel build compatibility"

echo "🚀 Pushing fixes to GitHub..."
git push -f origin main

echo ""
echo "✅ Done! Go to Vercel and click REDEPLOY!"
