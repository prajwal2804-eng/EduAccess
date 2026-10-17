import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BubblyProvider } from "./bubbly/BubblyProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BubblyProvider>
      <App />
    </BubblyProvider>
  </StrictMode>
);