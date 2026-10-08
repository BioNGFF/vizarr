import { REPOSITORY_URL, version } from "@biongff/vizarr";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Deliberately a direct console.log rather than the logger: the banner has to appear in
// production builds, and the logger's debug/info levels are compiled out of them.
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
