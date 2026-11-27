import { useState } from "preact/hooks";
import { Dialog } from "../components/Dialog";
import { strings } from "../strings";

export interface ActionValues {
  date: string;
  text: string;
  date2: string;
}

/** A small form with up to: one date, one text, a second date. Mirrors the prototype's generic action window. */
export interface ActionConfig {
  title: string;
  info?: string;
  date?: { label: string; value: string };
  text?: { label: string; required?: boolean };
  date2?: { label: string; value: string };
  okLabel: string;
  onOk: (v: ActionValues) => void;
}

export function ActionDialog({ cfg, onClose }: { cfg: ActionConfig; onClose: () => void }) {
  const [v, setV] = useState<ActionValues>({ date: cfg.date?.value ?? "", text: "", date2: cfg.date2?.value ?? "" });
  const set = (k: keyof ActionValues) => (e: Event) => setV({ ...v, [k]: (e.target as HTMLInputElement).value });
  // Focus the field the user has to fill, otherwise the OK button.
  const focusText = !!cfg.text?.required;
  return (
    <Dialog title={cfg.title} info={cfg.info} onClose={onClose}>
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          cfg.onOk({ ...v, text: v.text.trim() });
        }}
      >
        {cfg.date && (
          <label class="f">
            {cfg.date.label}
            <input type="date" required value={v.date} onInput={set("date")} />
          </label>
        )}
        {cfg.text && (
          <label class="f">
            {cfg.text.label}
            <textarea rows={2} maxLength={400} required={cfg.text.required} data-autofocus={focusText || undefined} value={v.text} onInput={set("text")} />
          </label>
        )}
        {cfg.date2 && (
          <label class="f">
            {cfg.date2.label}
            <input type="date" value={v.date2} onInput={set("date2")} />
          </label>
        )}
        <div class="row end">
          <button type="button" class="btn" onClick={onClose}>{strings.dialog.cancel}</button>
          <button type="submit" class="btn primary" data-autofocus={!focusText || undefined}>{cfg.okLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
