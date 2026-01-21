#!/bin/bash
# Run this from: /mnt/c/Users/User/.gemini/antigravity/scratch/bounty-board-monorepo

set -e

SOURCE="../bounty-board-frontend"
DEST="./frontend"

echo "📁 Copying frontend files..."

cp "$SOURCE/package.json" "$DEST/"
cp "$SOURCE/package-lock.json" "$DEST/" 2>/dev/null || true
cp "$SOURCE/next.config.js" "$DEST/"
cp "$SOURCE/tsconfig.json" "$DEST/"
cp "$SOURCE/tailwind.config.ts" "$DEST/"
cp "$SOURCE/postcss.config.js" "$DEST/"
cp "$SOURCE/next-env.d.ts" "$DEST/"
cp "$SOURCE/.gitignore" "$DEST/"

echo "📂 Copying src folder..."
cp -r "$SOURCE/src" "$DEST/"

echo "✅ Files copied!"
echo ""
echo "📤 Pushing to GitHub..."
git add .
git commit -m "Add frontend source code"
git push

echo "🎉 Done! Set Root Directory to 'frontend' in Vercel and redeploy."
