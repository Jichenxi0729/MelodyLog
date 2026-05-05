import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        tailwindcss(),
        react(),
        // VitePWA({
        //   registerType: 'autoUpdate',
        //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        //   manifest: {
        //     name: 'MelodyLog',
        //     short_name: 'MelodyLog',
        //     description: '现代化的蓝色主题音乐记录器，支持歌手和专辑探索、封面自动获取。',
        //     theme_color: '#1e40af',
        //     background_color: '#ffffff',
        //     display: 'standalone',
        //     scope: '/',
        //     start_url: '/',
        //     icons: [
        //       {
        //         src: 'icon.svg',
        //         sizes: 'any',
        //         type: 'image/svg+xml',
        //         purpose: 'any'
        //       },
        //       {
        //         src: 'icon-192.png',
        //         sizes: '192x192',
        //         type: 'image/png'
        //       },
        //       {
        //         src: 'icon-512.png',
        //         sizes: '512x512',
        //         type: 'image/png'
        //       },
        //       {
        //         src: 'icon-512.png',
        //         sizes: '512x512',
        //         type: 'image/png',
        //         purpose: 'maskable'
        //       }
        //     ]
        //   },
        //   workbox: {
        //     globPatterns: ['**/*.{html,js,css,ico,png,svg}'],
        //     runtimeCaching: [
        //       {
        //         urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        //         handler: 'CacheFirst',
        //         options: {
        //           cacheName: 'google-fonts',
        //           expiration: {
        //             maxEntries: 10,
        //             expiration: {
        //               maxEntries: 100,
        //               maxAgeSeconds: 60 * 60 * 24 * 30
        //             }
        //           }
        //         }
        //       }
        //     ]
        //   },
        //   devOptions: {
        //     enabled: false
        //   }
        // })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
