import { defineConfig } from 'vite'

// IMPORTE USANDO await import() DINÂMICO
const honoConfig = async () => {
  const { default: build } = await import('@hono/vite-build/cloudflare-pages')
  const { default: devServer } = await import('@hono/vite-dev-server')
  const { default: adapter } = await import('@hono/vite-dev-server/cloudflare')

  return defineConfig({
    plugins: [
      build(),
      devServer({
        adapter,
        entry: 'src/index.tsx'
      })
    ],
    server: {
      port: 3000,
      host: true
    }
  })
}

export default honoConfig()