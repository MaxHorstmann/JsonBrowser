#!/bin/bash

# Load Azure configuration and start development server
echo "Loading Azure configuration..."
node load-azure-config.js

# Extract the token from the output (get a fresh token)
TOKEN=$(az account get-access-token --resource "https://management.azure.com/" --query accessToken --output tsv 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo ""
    echo "🚀 Starting development server with Azure token..."
    VITE_AZURE_TOKEN="$TOKEN" npm run dev
else
    echo ""
    echo "⚠️  Could not get Azure token. Starting dev server without it..."
    npm run dev
fi
