
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Import BlockSuite styles
import "@blocksuite/editor/dist/style.css";

// Import the dev tools and initialize them conditionally
try {
  if (import.meta.env.VITE_TEMPO === "true") {
    const { TempoDevtools } = require("tempo-devtools");
    TempoDevtools.init();
  }
} catch (e) {
  console.warn("Failed to initialize Tempo devtools", e);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
