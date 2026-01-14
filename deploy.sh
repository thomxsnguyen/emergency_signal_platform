#!/bin/bash
set -e

echo "Deploying Earthquake Platform..."

# Install dependencies
echo "Installing dependencies..."
cd server && npm install --production
cd ../client && npm install

# Build client
echo "Building client..."
npm run build

# Verify environment
cd ../server
[ -f ".env" ] || echo "Warning: .env file not found"

echo "Deployment complete!"
echo "Start: cd server && npm start"
