# Building Pelican Prompt

This guide explains how to build Pelican Prompt for Windows and macOS.

## Quick Start

**On macOS:**
```bash
# Build for Mac (DMG installer)
npm run make

# Build portable Windows version (ZIP)
npm run make -- --platform=win32
```

**On Windows:**
```bash
# Build Windows installer (.exe)
npm run make -- --config forge.config.windows.js
```

## Prerequisites

- Node.js 18+ and npm
- For Windows builds: Windows machine or cross-compilation setup
- For Mac builds: macOS machine (required for DMG creation)

## Build Commands

### Build for Current Platform

```bash
npm run make
```

This builds for your current operating system.

### Build for Specific Platforms

#### Build for macOS (on macOS)
```bash
npm run make -- --platform=darwin
```

Output files in:
- `out/make/dmg/x64/` - DMG installer (Pelican Prompt.dmg)
- `out/make/zip/darwin/x64/` - ZIP archive

#### Build for Windows

**From macOS - Portable ZIP only:**
```bash
npm run make -- --platform=win32
```

Output: `out/make/zip/win32/x64/pelican-prompt-win32-x64-1.0.0.zip`
- Portable version (no installation required)
- Extract and run `Pelican Prompt.exe`

**On Windows - Full installer:**
```bash
npm run make -- --config forge.config.windows.js
```

Output:
- `out/make/squirrel.windows/x64/Pelican Prompt Setup.exe` - Installer
- `out/make/zip/win32/x64/` - Portable ZIP version

> **Note:** The Windows installer (.exe) can only be built on Windows. The default config builds portable ZIP only to avoid Wine/Mono requirements on macOS.

## Icon Requirements

Ensure you have the following icon files in `build/icons/`:

- **pelicanprompt.icns** - macOS icon (512x512 or 1024x1024)
- **pelicanprompt.ico** - Windows icon (256x256 recommended)
- **pelicanprompt.png** - Linux icon (512x512)

You can create these from a single source image using tools like:
- Icon Composer (Mac)
- Image2Icon (Mac)
- Online converters (png2icons.com)

## Distribution

### macOS
Distribute the `.dmg` file. Users drag the app to Applications folder.

### Windows
Distribute the `Pelican Prompt Setup.exe` installer. Users run it to install.

Alternatively, distribute the ZIP for a portable version (no installation required).

## Development vs Production

- **Development**: `npm start` - Runs with hot reload
- **Package only**: `npm run package` - Creates app bundle without installers
- **Production build**: `npm run make` - Creates installers

## Troubleshooting

### macOS Code Signing
For distribution outside the App Store, you need:
1. Apple Developer account
2. Code signing certificate
3. Notarization

Add to `forge.config.js`:
```javascript
packagerConfig: {
  osxSign: {
    identity: 'Developer ID Application: Your Name (TEAMID)',
  },
  osxNotarize: {
    appleId: 'your@email.com',
    appleIdPassword: '@keychain:AC_PASSWORD',
  }
}
```

### Windows Code Signing
For production releases:
1. Obtain a code signing certificate
2. Add to `forge.config.js`:
```javascript
packagerConfig: {
  windowsSign: {
    certificateFile: './path/to/cert.pfx',
    certificatePassword: process.env.CERTIFICATE_PASSWORD
  }
}
```

### Cross-Platform Builds

**What you can build from macOS:**
- ✅ macOS DMG installer
- ✅ macOS ZIP
- ✅ Windows ZIP (portable)
- ❌ Windows installer (.exe) - requires Windows or Wine/Mono

**What you can build from Windows:**
- ✅ Windows installer (.exe)
- ✅ Windows ZIP (portable)
- ❌ macOS DMG - requires macOS

**Options for building Windows installer from macOS:**

1. **Install Wine and Mono** (complex, not recommended):
   ```bash
   brew install wine-stable
   brew install mono
   ```

2. **Use a Windows machine or VM** (recommended)

3. **Use GitHub Actions** (recommended for releases):
   Create `.github/workflows/build.yml` to build on both platforms automatically

4. **Use the portable ZIP** (easiest):
   The ZIP version works on Windows without installation

## File Sizes

Typical build sizes:
- macOS DMG: ~150-200 MB
- Windows Setup.exe: ~120-180 MB
- ZIP files: ~140-190 MB

## Testing Builds

1. Build for your platform
2. Install from the generated installer
3. Test all features:
   - Creating/selecting workspace
   - Creating/editing prompts
   - Creating/editing partials
   - Search functionality
   - Keyboard shortcuts
   - File operations

## Release Checklist

- [ ] Update version in `package.json`
- [ ] Test on target platforms
- [ ] Create icons for all platforms
- [ ] Build for each platform
- [ ] Test installers
- [ ] Create release notes
- [ ] Upload to distribution platform
