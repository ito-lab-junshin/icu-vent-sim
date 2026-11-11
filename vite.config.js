import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では https://ito-lab-junshin.github.io/icu-vent-sim/ で公開するため base を指定
export default defineConfig({
  plugins: [react()],
  base: '/icu-vent-sim/',
});
