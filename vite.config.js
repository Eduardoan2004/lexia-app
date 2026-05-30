import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase SDK en su propio chunk
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Vistas de IA (las más pesadas) en su propio chunk
          'ia': [
            './src/views/AsistenteIA.js',
            './src/views/Configuracion.js',
            './src/services/modules.js',
          ],
          // Expedientes (módulo más grande) en su propio chunk
          'expedientes': [
            './src/views/Expedientes.js',
          ],
        }
      }
    }
  }
});
