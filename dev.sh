#!/bin/bash

# Development script for Push Live Results
# Usage: ./dev.sh

set -e

echo "🔧 Push Live Results - Local Development"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env.local exists
if [ ! -f "app/.env.local" ]; then
    echo -e "${YELLOW}⚠️  app/.env.local not found${NC}"
    echo "Copy app/.env.example to app/.env.local and fill in your Firebase config"
    exit 1
fi

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Check for Firebase emulator or warn
if command -v firebase &> /dev/null; then
    echo "Choose development mode:"
    echo "1. Firebase Emulators (recommended - full local stack)"
    echo "2. Frontend only (requires deployed functions)"
    echo ""
    read -p "Enter choice (1 or 2): " choice
    echo ""
    
    case $choice in
        1)
            echo "🔥 Starting Firebase Emulators..."
            echo ""
            echo -e "${YELLOW}Note: This will start emulators for Functions, Firestore, and Auth${NC}"
            echo -e "${YELLOW}In another terminal, run: cd app && npm run dev${NC}"
            echo ""
            firebase emulators:start
            ;;
        2)
            echo "🚀 Starting frontend development server..."
            echo ""
            cd app
            npm run dev
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${YELLOW}⚠️  Firebase CLI not found${NC}"
    echo "Starting frontend only..."
    echo ""
    cd app
    npm run dev
fi
