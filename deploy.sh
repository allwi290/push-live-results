#!/bin/bash

# Deploy script for Push Live Results
# Usage: ./deploy.sh [hosting|functions|all]

set -e  # Exit on error

TARGET=${1:-all}

echo "🚀 Push Live Results Deployment"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found${NC}"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Firebase${NC}"
    echo "Run: firebase login"
    exit 1
fi

echo -e "${GREEN}✓ Firebase CLI ready${NC}"
echo ""

deploy_frontend() {
    echo "📦 Building frontend..."
    cd app
    npm run build
    cd ..
    echo -e "${GREEN}✓ Frontend built${NC}"
    echo ""
    
    echo "🚀 Deploying frontend to Firebase Hosting..."
    firebase deploy --only hosting
    echo -e "${GREEN}✓ Frontend deployed${NC}"
    echo ""
}

deploy_functions() {
    echo "📦 Building functions..."
    cd functions
    npm run build
    cd ..
    echo -e "${GREEN}✓ Functions built${NC}"
    echo ""
    
    echo "🚀 Deploying functions to Firebase..."
    firebase deploy --only functions
    echo -e "${GREEN}✓ Functions deployed${NC}"
    echo ""
}

case $TARGET in
    hosting)
        deploy_frontend
        ;;
    functions)
        deploy_functions
        ;;
    all)
        deploy_frontend
        deploy_functions
        ;;
    *)
        echo -e "${RED}❌ Invalid target: $TARGET${NC}"
        echo "Usage: ./deploy.sh [hosting|functions|all]"
        exit 1
        ;;
esac

echo "================================"
echo -e "${GREEN}✨ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check Firebase Console for deployment status"
echo "2. Test the deployed app"
echo "3. Monitor Functions logs for any errors"
echo ""
