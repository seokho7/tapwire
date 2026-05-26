import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

const saved = localStorage.getItem("tapwire.theme") as "dark" | "light" | null;
if (saved) document.documentElement.setAttribute("data-theme", saved);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
