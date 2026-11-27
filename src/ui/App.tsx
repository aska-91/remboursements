import { useEffect, useMemo, useState } from "preact/hooks";
import * as A from "../domain/actions";
import { openStorage, type OpenedStorage } from "../storage/startup";
import { makeClaimActions, type DialogSpec } from "./claimActions";
import { ClaimList } from "./ClaimList";
import { ActionDialog } from "./dialogs/ActionDialog";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { ReceiptDialog } from "./dialogs/ReceiptDialog";
import { Toast, useToast } from "./components/Toast";
import { useAppData } from "./useAppData";
import { strings } from "./strings";

export function App() {
  const [opened, setOpened] = useState<OpenedStorage | null>(null);
  useEffect(() => {
    void openStorage().then(setOpened);
  }, []);
  if (!opened) return <main class="wrap"><p>{strings.loading}</p></main>;
  return <Main opened={opened} />;
}

function Main({ opened }: { opened: OpenedStorage }) {
  const data = useAppData(opened);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [toastMsg, toast] = useToast();
  const actions = useMemo(() => makeClaimActions(data, setDialog, toast), [data]);
  const close = () => setDialog(null);

  return (
    <>
      <div class="wrap">
        <header class="app-header">
          <div>
            <h1>{strings.appName}</h1>
            <p class="sub">{strings.tagline}</p>
          </div>
        </header>
        {!data.persistent && <p class="banner bad" role="alert">{strings.storageNotPersistent}</p>}
        {data.saveError && <p class="banner bad" role="alert">{strings.saveFailed}</p>}
        {data.migrated > 0 && <p class="banner" role="status">{strings.migrated(data.migrated)}</p>}
        <main>
          <ClaimList claims={data.doc.claims} today={data.today} actions={actions} />
        </main>
      </div>

      {dialog?.kind === "action" && <ActionDialog cfg={dialog.cfg} onClose={close} />}
      {dialog?.kind === "confirm" && <ConfirmDialog cfg={dialog.cfg} onClose={close} />}
      {dialog?.kind === "receipt" && (() => {
        const c = data.doc.claims.find((x) => x.id === dialog.claimId);
        const i = c?.items.find((x) => x.id === dialog.itemId);
        if (!c || !i) return null;
        return (
          <ReceiptDialog claim={c} item={i} today={data.today} onClose={close}
            onOk={(amount, date, writeOff) => {
              data.updateClaim(c.id, (x, now) => A.recordReceipt(x, i.id, amount, date, writeOff, now));
              toast(strings.toast.received);
            }} />
        );
      })()}
      <Toast msg={toastMsg} />
    </>
  );
}
