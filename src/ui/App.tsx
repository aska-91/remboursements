import { useEffect, useState } from "preact/hooks";
import { openStorage, type OpenedStorage } from "../storage/startup";
import { strings } from "./strings";

export function App() {
  const [opened, setOpened] = useState<OpenedStorage | null>(null);
  useEffect(() => {
    void openStorage().then(setOpened);
  }, []);

  return (
    <main class="container">
      <h1>{strings.appName}</h1>
      {!opened ? (
        <p>{strings.loading}</p>
      ) : (
        <>
          {!opened.persistent && <p role="alert">{strings.notPersistent}</p>}
          {opened.migrated > 0 && <p role="status">{strings.migrated(opened.migrated)}</p>}
          <p data-testid="count">{strings.storedCount(opened.doc.claims.length)}</p>
          <p>{strings.placeholder}</p>
        </>
      )}
    </main>
  );
}
