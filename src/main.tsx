import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/rubik/hebrew-500.css";
import "@fontsource/rubik/hebrew-700.css";
import "@fontsource/rubik/latin-500.css";
import "@fontsource/rubik/latin-700.css";
import "@fontsource/assistant/hebrew-400.css";
import "@fontsource/assistant/hebrew-600.css";
import "@fontsource/assistant/hebrew-700.css";
import "@fontsource/assistant/latin-400.css";
import "@fontsource/assistant/latin-600.css";
import "@fontsource/assistant/latin-700.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
}
