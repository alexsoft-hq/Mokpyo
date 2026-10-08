import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const baseUrl = process.env.VITE_BASE_URL || '/';
  const baseUrlWithoutTrailingSlash = baseUrl.replace(/\/$/, '');
  const apiProxyPath = baseUrl === '/' ? '/api' : `${baseUrl}api`;

  return {
    base: baseUrl,
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/mcp': { target: 'http://127.0.0.1:3001', changeOrigin: false },
        '/oauth/mcp': { target: 'http://127.0.0.1:3001', changeOrigin: false },
        '/.well-known': { target: 'http://127.0.0.1:3001', changeOrigin: false },
        [apiProxyPath]: {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          timeout: 300000,
          rewrite: baseUrlWithoutTrailingSlash === ''
            ? undefined
            : (path) => {
                console.log(`[Proxy] Original path: ${path}`);
                const newPath = path.replace(baseUrlWithoutTrailingSlash, '');
                console.log(`[Proxy] Rewritten path: ${newPath}`);
                return newPath;
              },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-tooltip', '@radix-ui/react-select', '@radix-ui/react-popover', '@radix-ui/react-slot'],
            'vendor-date': ['date-fns'],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          },
        },
      },
    },
  };
});
