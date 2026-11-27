import { Dialog } from "../components/Dialog";
import { strings } from "../strings";

export interface ConfirmConfig {
  title: string;
  message: string;
  okLabel: string;
  danger?: boolean;
  onOk: () => void;
}

/** Focus starts on Cancel, so Enter never confirms a destructive action by accident. */
export function ConfirmDialog({ cfg, onClose }: { cfg: ConfirmConfig; onClose: () => void }) {
  return (
    <Dialog title={cfg.title} onClose={onClose}>
      <p>{cfg.message}</p>
      <div class="row end">
        <button type="button" class="btn" data-autofocus onClick={onClose}>{strings.dialog.cancel}</button>
        <button type="button" class={`btn primary${cfg.danger ? " danger-fill" : ""}`} onClick={() => { onClose(); cfg.onOk(); }}>
          {cfg.okLabel}
        </button>
      </div>
    </Dialog>
  );
}
