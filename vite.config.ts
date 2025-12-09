import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load all env variables
    const env = loadEnv(mode, '.', '');

    // Filter out all keys starting with GEMINI_API_KEY_
    // This creates a pool of keys: ['key1', 'key2', 'key3'...]
    const apiKeys = Object.keys(env)
      .filter(key => key.startsWith('GEMINI_API_KEY'))
      .map(key => env[key]);

    // Agar koi specific keys nahi mili, toh fallback API_KEY use karega
    if (apiKeys.length === 0 && env.API_KEY) {
      apiKeys.push(env.API_KEY);
    }
    if (apiKeys.length === 0 && env.GEMINI_API_KEY) {
      apiKeys.push(env.GEMINI_API_KEY);
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Hum saari keys ko ek Array banakar bhej rahe hain
        'process.env.GEMINI_KEYS_POOL': JSON.stringify(apiKeys),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
