import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@jalali-js/react/date-picker.css";
import "./index.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Providers } from "./app/providers";

const savedTheme = localStorage.getItem("monai-theme");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (savedTheme === "dark" || (!savedTheme && systemDark)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<Providers><App /></Providers>);
