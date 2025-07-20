#!/bin/bash

# CI Check Script - Run all CI checks locally before pushing
# This helps catch issues before they fail in CI

set -e

echo "🔍 Running CI checks locally..."
echo ""

# Check Node version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm ci
echo ""

# Run linting
echo "🔍 Running ESLint..."
npm run lint:ci
echo "✅ Linting passed!"
echo ""

# Run type checking
echo "🔍 Running TypeScript type check..."
npm run typecheck
echo "✅ Type checking passed!"
echo ""

# Run tests with coverage
echo "🧪 Running tests with coverage..."
npm run test:ci
echo "✅ Tests passed!"
echo ""

# Build the application
echo "🏗️  Building application..."
npm run build
echo "✅ Build successful!"
echo ""

# Check for security vulnerabilities
echo "🔒 Running security audit..."
npm audit --production || true
echo ""

echo "✨ All CI checks passed! Safe to push."
echo ""
echo "💡 Tip: You can also run E2E tests with: npm run test:e2e"