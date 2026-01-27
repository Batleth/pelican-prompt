const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    icon: './build/icons/pelicanprompt',
    executableName: 'pelican-prompt',
    asar: true,
    appBundleId: 'com.pelicanprompt.app',
    appCategoryType: 'public.app-category.productivity',
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Batleth',
          name: 'prompt-pelican'
        },
        prerelease: false,
        draft: true // Set to true so you can check it before users see it
      }
    }
  ],
  makers: [
    // Mac DMG installer
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './build/icons/pelicanprompt.icns',
        format: 'ULFO'
      },
      platforms: ['darwin'],
    },
    // Mac ZIP (for auto-updates and distribution)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // Windows ZIP (portable version - works from macOS, no Wine needed)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
    // Windows installer (.exe)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'PelicanPrompt',
        authors: 'Pelican Prompt',
        description: 'A file-based prompt management application',
        setupIcon: './build/icons/pelicanprompt.ico',
      },
      platforms: ['win32'],
    },
    // Linux DEB package
    {
      name: '@electron-forge/maker-deb',
      config: {
        icon: './build/icons/pelicanprompt.png',
        options: {
          maintainer: 'Pelican Prompt',
          homepage: 'https://github.com/Batleth/pelican-prompt'
        }
      },
      platforms: ['linux'],
    },
    // Linux RPM package
    {
      name: '@electron-forge/maker-rpm',
      config: {
        icon: './build/icons/pelicanprompt.png',
        options: {
          maintainer: 'Pelican Prompt',
          homepage: 'https://github.com/Batleth/pelican-prompt'
        }
      },
      platforms: ['linux'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
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
            }
          ]
        }
      }
    }
  ],
};
