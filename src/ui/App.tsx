import { strings } from "./strings";

export function App() {
  return (
    <main class="container">
      <h1>{strings.appName}</h1>
      <p>{strings.placeholder}</p>
    </main>
  );
}
