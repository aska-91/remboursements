import { useEffect, useMemo, useState } from "preact/hooks";
import * as A from "../domain/actions";
import { openStorage, type OpenedStorage } from "../storage/startup";
import { makeClaimActions, type DialogSpec } from "./claimActions";
import { BackupMenu } from "./BackupMenu";
import { ClaimList } from "./ClaimList";
import { Sources, Tiles, ToDo, YearTotals } from "./Overview";
import { ActionDialog } from "./dialogs/ActionDialog";
import { ClaimForm } from "./dialogs/ClaimForm";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { ReceiptDialog } from "./dialogs/ReceiptDialog";
import { Toast, useToast } from "./components/Toast";
import { useAppData } from "./useAppData";
import { applyLang, getLang, LANGS, strings, type Lang } from "./strings";

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
  const [lang, setLangState] = useState<Lang>(getLang());
  const changeLang = (l: Lang) => {
    applyLang(l);
    setLangState(l);
  };
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
          <div class="row">
            <label class="lang">
              <span class="sr-only">{strings.languageLabel}</span>
              <select value={lang} aria-label={strings.languageLabel} onChange={(e) => changeLang((e.target as HTMLSelectElement).value as Lang)}>
                {LANGS.map((l) => <option key={l} value={l} lang={l}>{l === "en" ? "English" : "Français"}</option>)}
              </select>
            </label>
            <BackupMenu data={data} toast={toast} confirm={(cfg) => setDialog({ kind: "confirm", cfg })} />
            <button type="button" class="btn primary" onClick={() => setDialog({ kind: "form" })}>{strings.newExpense}</button>
          </div>
        </header>
        {!data.persistent && <p class="banner bad" role="alert">{strings.storageNotPersistent}</p>}
        {data.saveError && <p class="banner bad" role="alert">{strings.saveFailed}</p>}
        {data.migrated > 0 && <p class="banner" role="status">{strings.migrated(data.migrated)}</p>}
        {/* Phone: overview above the list. Desktop: overview in a side column. */}
        <div class="layout">
          <aside class="side">
            <Tiles claims={data.doc.claims} today={data.today} />
            <ToDo claims={data.doc.claims} today={data.today} actions={actions} />
            <Sources claims={data.doc.claims} today={data.today} />
            <YearTotals claims={data.doc.claims} today={data.today} />
          </aside>
          <main class="main">
            <ClaimList lang={lang} claims={data.doc.claims} today={data.today} actions={actions} onAdd={() => setDialog({ kind: "form" })} />
          </main>
        </div>
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
      {dialog?.kind === "form" && (() => {
        const editing = dialog.claimId ? data.doc.claims.find((x) => x.id === dialog.claimId) : undefined;
        if (dialog.claimId && !editing) return null;
        return (
          <ClaimForm claim={editing} today={data.today} onClose={close}
            onSave={(input) => {
              if (editing) {
                data.updateClaim(editing.id, (x, now) => A.editClaim(x, input, now));
                toast(strings.toast.edited);
              } else {
                // New expenses go first, as in the prototype.
                data.updateDoc((d, now) => ({ ...d, claims: [A.createClaim(input, now), ...d.claims] }));
                toast(strings.toast.added);
              }
            }} />
        );
      })()}
      <Toast msg={toastMsg} />
    </>
  );
}
