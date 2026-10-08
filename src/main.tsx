import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { installUnauthorizedInterceptor } from "./lib/api/http";

installUnauthorizedInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
