# Icon Creation Guide

## Current Issue
The build fails because the SealCircle.png is too small (2305 bytes) and doesn't have the proper dimensions for electron-builder.

## Solution Options

### Option 1: Use Online Converter
1. Go to https://convertio.co/png-ico/
2. Convert SealCircle.ico to PNG with proper dimensions
3. Create multiple sizes (16x16, 32x32, 64x64, 128x128, 256x256, 512x512)
4. Save as icon.png for Linux/macOS

### Option 2: Use ImageMagick (if installed)
```bash
# Convert ICO to PNG with proper size
magick app/assets/images/SealCircle.ico -resize 256x256 app/assets/images/icon.png

# Create multiple sizes for electron-builder
magick app/assets/images/SealCircle.ico -resize 512x512 app/assets/images/icon512.png
magick app/assets/images/SealCircle.ico -resize 256x256 app/assets/images/icon256.png
magick app/assets/images/SealCircle.ico -resize 128x128 app/assets/images/icon128.png
```

### Option 3: Use the existing ICO file only (temporary fix)
Remove icon references for Linux/macOS and let electron-builder use default icons.

## Required Icon Sizes for electron-builder
- Windows: .ico file with multiple sizes (already have SealCircle.ico)
- macOS: .icns file or .png with 512x512 minimum
- Linux: .png with 256x256 minimum

## Temporary Fix Applied
Removed icon references for Linux/macOS to allow builds to proceed without custom icons.
