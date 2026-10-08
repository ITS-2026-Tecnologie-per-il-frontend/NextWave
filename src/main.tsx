import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { BrowserRouter } from "react-router-dom";
import { migrateLegacyPageLink } from "./config/routes.ts";
import "./styles/index.css";

const root = document.getElementById("app");
if (!root) throw new Error("Elemento principale dell’app mancante.");
migrateLegacyPageLink();
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
