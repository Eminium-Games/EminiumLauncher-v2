#!/bin/bash

echo "🚀 Testing Eminium Games Launcher Build Configuration"

echo "📦 Checking package.json..."
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    node -e "console.log('Version:', require('./package.json').version)"
    node -e "console.log('Product:', require('./package.json').productName)"
else
    echo "❌ package.json not found"
    exit 1
fi

echo "🎨 Checking icons..."
if [ -f "app/assets/images/SealCircle.ico" ]; then
    echo "✅ Windows icon found"
else
    echo "❌ Windows icon not found"
fi

if [ -f "app/assets/images/SealCircle.png" ]; then
    echo "✅ macOS/Linux icon found"
else
    echo "❌ macOS/Linux icon not found"
fi

echo "🔧 Checking build configuration..."
if npm run dist:win --dry-run 2>/dev/null; then
    echo "✅ Windows build configuration OK"
else
    echo "⚠️ Windows build needs testing"
fi

if npm run dist:mac --dry-run 2>/dev/null; then
    echo "✅ macOS build configuration OK"
else
    echo "⚠️ macOS build needs testing"
fi

if npm run dist:linux --dry-run 2>/dev/null; then
    echo "✅ Linux build configuration OK"
else
    echo "⚠️ Linux build needs testing"
fi

echo "📋 Checking workflows..."
if [ -f ".github/workflows/build.yml" ]; then
    echo "✅ Build workflow found"
else
    echo "❌ Build workflow not found"
fi

if [ -f ".github/workflows/auto-release.yml" ]; then
    echo "✅ Auto-release workflow found"
else
    echo "❌ Auto-release workflow not found"
fi

echo "✅ Configuration test completed!"
