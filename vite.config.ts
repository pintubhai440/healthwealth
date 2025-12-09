import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load all env variables
    const env = loadEnv(mode, '.', '');

    // 🛠️ HACK: Collect all keys starting with GEMINI_API_KEY_
    // Example: GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
    const apiKeys = Object.keys(env)
      .filter(key => key.startsWith('GEMINI_API_KEY'))
      .map(key => env[key]);

    // Fallback: Agar numbering nahi ki hai, toh normal key utha lo
    if (apiKeys.length === 0 && env.GEMINI_API_KEY) {
      apiKeys.push(env.GEMINI_API_KEY);
    }
    // Agar API_KEY naam se hai toh wo bhi le lo
    if (apiKeys.length === 0 && env.API_KEY) {
      apiKeys.push(env.API_KEY);
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Hum keys ka 'Pool' bana kar bhej rahe hain
        'process.env.GEMINI_KEYS_POOL': JSON.stringify(apiKeys),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
