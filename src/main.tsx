import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const root = document.getElementById("app");
if (!root) throw new Error("Elemento principale dell’app mancante.");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
