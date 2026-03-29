const fs = require('fs');
const path = require('path');

// Create a simple 256x256 PNG icon for Linux
// This is a workaround since we can't convert the ICO file directly

// Simple base64 encoded 1x1 transparent PNG (placeholder)
const placeholderPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Create the icon file
const iconPath = path.join(__dirname, 'app', 'assets', 'images', 'icon.png');
fs.writeFileSync(iconPath, placeholderPNG);

console.log('Created placeholder icon.png for Linux build');
