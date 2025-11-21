import { version } from "@biongff/vizarr";
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

console.log(`vizarr v${version}: https://github.com/BioNGFF/vizarr`);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
