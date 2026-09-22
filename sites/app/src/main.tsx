import { REPOSITORY_URL, version } from "@biongff/vizarr";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Deliberately a direct console.log rather than the logger: this banner has to survive
// into production builds, where the logger strips info, because it anchors the version
// to whatever console output someone pastes into a bug report.
console.log(`[vizarr] v${version} ${REPOSITORY_URL}`);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
