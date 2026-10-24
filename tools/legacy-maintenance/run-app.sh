#!/bin/bash

echo "=========================================="
echo "   Remo Pro - Local Server Start"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed! Please install it from https://nodejs.org/"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules not found. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies."
        exit 1
    fi
fi

echo "[INFO] Starting the server..."
echo "[INFO] You can access the system at http://localhost:3000"
echo "[INFO] Press Ctrl+C to stop the server."

# Run the application
npm run dev
