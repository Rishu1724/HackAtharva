# Assets Folder

This folder should contain app assets like icons, splash screen, etc.

## Required Assets

### 1. icon.png
- Size: 1024x1024 px
- Format: PNG with transparency
- Purpose: App icon for iOS and Android
- Content: Your app logo/icon

### 2. adaptive-icon.png
- Size: 1024x1024 px
- Format: PNG with transparency
- Purpose: Android adaptive icon
- Content: Same as icon.png (or centered version)

### 3. splash.png
- Size: 1242x2436 px (or larger)
- Format: PNG
- Purpose: Launch/splash screen
- Content: App logo with app name

### 4. favicon.png
- Size: 48x48 px
- Format: PNG
- Purpose: Web app favicon
- Content: Simplified app icon

## Quick Setup

For hackathon/testing purposes, you can:

1. Use placeholder images from Expo:
   ```bash
   # Icons will use Expo defaults if not present
   ```

2. Or create simple icons:
   - Use Canva or Figma
   - Design a simple logo (shield + bus icon)
   - Export in required sizes
   - Place in this assets folder

3. Or use these free icon generators:
   - https://www.appicon.co/
   - https://makeappicon.com/
   - https://easyappicon.com/

## Color Scheme Suggestion

Primary: #6200ee (Purple)
Secondary: #03dac6 (Teal)
Accent: #f44336 (Red for SOS)

## Notes

- App will work without custom assets (uses Expo defaults)
- For production/demo, create custom branded assets
- Ensure all images are optimized (compressed)
