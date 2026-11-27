import { render } from "preact";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import { App } from "./ui/App";
import { applyLang, initialLang } from "./ui/strings";
import "./ui/styles.css";

// Language first, so the very first render is already in the right language.
applyLang(initialLang(), false);
render(<App />, document.getElementById("app")!);
