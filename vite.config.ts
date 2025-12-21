import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://commerce.zoho.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, '/storefront/api/v1'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              const domainName = env.VITE_DOMAIN_NAME || 'plera.zohoecommerce.com';
              proxyReq.setHeader('X-Zoho-Domain', domainName);
              proxyReq.setHeader('domain-name', domainName);
              proxyReq.setHeader('Origin', `https://${domainName}`);
            });
          },
        },
      },
    },
  }
})
