import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Path alias: lets us write import X from "@/components/Button"
  // instead of "../../components/Button"
  // shadcn/ui requires this "@" alias to work
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
