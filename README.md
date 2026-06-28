# PDF Shelf

A premium installable Progressive Web App for reading multiple PDFs beautifully.

## Features

- **Multi-tab PDF reading** — open as many PDFs as you want simultaneously
- **Folder-style tabs** — elegant tab UI with close animations
- **Swipe navigation** — swipe left/right to flip pages on touch devices
- **Pinch to zoom** — native pinch zoom gesture support
- **Drag & drop** — drop PDF files directly into the app
- **Keyboard shortcuts** — full keyboard control (see Settings)
- **Offline support** — works without internet once installed
- **Installable PWA** — install on Windows, macOS, Android, iOS, Linux
- **No backend** — everything runs locally, no files leave your device
- **Local storage** — remembers your page position and zoom level

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open PDF | `Ctrl/Cmd + O` |
| Next page | `→` or `Space` |
| Previous page | `←` or `Shift+Space` |
| Zoom in | `Ctrl/Cmd + +` |
| Zoom out | `Ctrl/Cmd + -` |
| Reset zoom | `Ctrl/Cmd + 0` |
| Close PDF | `Shift + Delete` |
| Close dialog | `Escape` |

## Deploy

Static files only — deploy to any host:

- **Vercel**: `vercel deploy`
- **Netlify**: drag the folder into Netlify dashboard
- **GitHub Pages**: push to a repo, enable Pages in Settings

## File Structure

```
pdf_shelf/
├── index.html          # App shell + HTML
├── styles.css          # All styles
├── app.js              # All JavaScript logic
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline caching
├── favicon.svg         # SVG icon
├── apple-touch-icon.png
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── maskable-192.png
│   └── maskable-512.png
└── README.md
```

## Tech Stack

- Vanilla HTML/CSS/JS (ES6+)
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- Service Worker for offline support
- Web App Manifest for PWA install
- Inter font from Google Fonts

## Design

Inspired by Apple Books, Adobe Acrobat, and Arc Browser. Uses a warm bookshelf color palette:

- Background: `#161311`
- Surface: `#221D18`
- Accent Gold: `#F0AC3B`
- Accent Teal: `#5C8E87`