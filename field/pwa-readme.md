# MedResponse Field - PWA Installation Guide

## What is a PWA?
Progressive Web App (PWA) allows you to install the MedResponse Field app on your device like a native app, without going through app stores.

## Installation Instructions

### iPhone / iPad (Safari)
1. Open the app in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. The app icon will appear on your home screen

### Android (Chrome)
1. Open the app in Chrome
2. Tap the **menu** (three dots) or look for an **"Install"** popup
3. Tap **"Add to Home screen"** or **"Install"**
4. Follow the prompts
5. The app icon will appear on your home screen

### Desktop (Chrome/Edge)
1. Open the app in Chrome or Edge
2. Look for an **install icon** in the address bar (looks like a computer with a down arrow)
3. Click **"Install"**
4. The app will open in its own window

## Features

### Offline Support
- The app works without internet connection
- Data is saved locally and syncs when connection is restored
- Red "Offline" banner appears when connection is lost

### Background Sync
- When you come back online, all data automatically syncs to the hospital
- No need to manually "send" data

### Install Button
- If you don't install immediately, a download button appears in the top right
- Tap it anytime to install the app

## Troubleshooting

### "Add to Home Screen" not appearing (iOS)
- Make sure you're using Safari (not Chrome on iOS)
- Try refreshing the page first
- Check that the page fully loaded

### Install button not showing (Android/Desktop)
- The browser decides when to show install prompts
- Try using the browser menu → "Add to Home screen"
- Make sure you're visiting the page over HTTPS (required for PWA)

### App not working offline
- First visit must be online (to download the app)
- Wait for the page to fully load before going offline
- Try reinstalling if issues persist

## Benefits of Installing

✅ **Works offline** - Use in areas with no signal
✅ **Full screen** - No browser address bar taking up space
✅ **Quick access** - Launch from home screen like native app
✅ **Push notifications** - Get alerts for critical updates (coming soon)
✅ **Auto-update** - Always have the latest version

## Technical Details

- **Cache Strategy**: Cache-first for static assets, Network-first for API calls
- **Storage**: Uses browser Cache API and IndexedDB
- **Background Sync**: Automatically queues and syncs data when online
- **Theme Color**: Red (#dc2626) matches emergency theme

## Support

For technical support or issues with the PWA, contact the IT department.
