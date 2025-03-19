import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Add this block of code for SWC plugin



  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: process.env.TEMPO === "true" ? true : undefined,
    },
    plugins: [
// Add the tempo plugin
      mode === 'development' && componentTagger(), // Add the component tagger plugin for Lovable
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
