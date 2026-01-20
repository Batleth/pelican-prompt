// forge.config.windows.js
// Use this config when building on Windows to get the .exe installer
// Run: npm run make -- --config forge.config.windows.js

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    icon: './build/icons/pelicanprompt',
    executableName: 'Pelican Prompt',
    asar: true,
    appBundleId: 'com.pelicanprompt.app',
    appCategoryType: 'public.app-category.productivity',
  },
  rebuildConfig: {},
  makers: [
    // Windows installer (only works on Windows)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'PelicanPrompt',
        authors: 'Pelican Prompt',
        description: 'A file-based prompt management application',
        setupIcon: './build/icons/pelicanprompt.ico',
      },
    },
    // Windows ZIP (portable version)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/search/index.html',
              js: './src/renderer/search/renderer.ts',
              name: 'search_window',
              preload: {
                js: './src/preload.ts'
              }
            },
            {
              html: './src/renderer/editor/index.html',
              js: './src/renderer/editor/renderer.ts',
              name: 'editor_window',
              preload: {
                js: './src/preload.ts'
              }
            },
            {
              html: './src/renderer/partials/index.html',
              js: './src/renderer/partials/renderer.ts',
              name: 'partials_window',
              preload: {
                js: './src/preload.ts'
              }
            }
          ]
        }
      }
    }
  ],
};
