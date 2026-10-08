import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installUnauthorizedInterceptor } from "./lib/api/http";

installUnauthorizedInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
