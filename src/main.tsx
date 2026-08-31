import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { seedBrowserStorage } from "./dev/seeds";
import App from "./App";
import "./index.css";
import "./App.css";

seedBrowserStorage();


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
