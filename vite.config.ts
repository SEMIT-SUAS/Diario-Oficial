// vite.config.ts - VERSÃO FINAL COM PROXY FORTE
import { defineConfig } from 'vite'

const honoConfig = async () => {
  const { default: build } = await import('@hono/vite-build/cloudflare-pages')
  const { default: devServer } = await import('@hono/vite-dev-server')
  const { default: adapter } = await import('@hono/vite-dev-server/cloudflare')

  return defineConfig({
    plugins: [
      build(),
      devServer({
        adapter,
        entry: 'src/index.tsx',
        // ✅ Excluir TUDO que começa com /api
        exclude: ['/api/*', '/api/**/*']
      })
    ],
    server: {
      port: 3000,
      host: true,
      // ✅ Proxy AGGRESSIVO para PostgreSQL
      proxy: {
        '^/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            console.log(`🔄 Vite Proxy: ${path} -> http://localhost:3001${path}`);
            return path;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`📤 Proxy Request: ${req.method} ${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log(`📥 Proxy Response: ${proxyRes.statusCode} ${req.url}`);
            });
          }
        }
      }
    }
  })
}

export default honoConfig()