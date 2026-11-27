import { useState } from "preact/hooks";
import type { Claim, Item, Ymd } from "../../domain/types";
import { gapAfterReceipt, suggestedReceipt } from "../../domain/actions";
import { gap } from "../../domain/status";
import { toCents, toEuros } from "../../domain/money";
import { Dialog } from "../components/Dialog";
import { strings } from "../strings";

interface Props {
  claim: Claim;
  item: Item;
  today: Ymd;
  onOk: (amount: number, date: Ymd, writeOff: boolean) => void;
  onClose: () => void;
}

/** Records a payment. If the amount is short, offers to accept the rest as out-of-pocket. */
export function ReceiptDialog({ claim, item, today, onOk, onClose }: Props) {
  const topUp = item.received != null;
  const [amount, setAmount] = useState(String(toEuros(suggestedReceipt(item))));
  const [date, setDate] = useState(today);
  const [writeOff, setWriteOff] = useState(false);
  const missing = gapAfterReceipt(item, toCents(amount));
  const d = strings.dialog;
  const source = strings.sources[item.source];
  return (
    <Dialog
      title={topUp ? d.topUpTitle : d.receivedTitle}
      info={topUp ? d.topUpInfo(claim.label, source, gap(item)) : d.receivedInfo(claim.label, source, item.expected)}
      onClose={onClose}
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          onOk(toCents(amount), date, missing > 0 && writeOff);
        }}
      >
        <div class="grid2">
          <label class="f">
            {d.amountReceived}
            <input type="number" step="0.01" min="0.01" required inputMode="decimal" data-autofocus value={amount}
              onFocus={(e) => (e.target as HTMLInputElement).select()}
              onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
          </label>
          <label class="f">
            {d.receivedDate}
            <input type="date" required value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
          </label>
        </div>
        {missing > 0 && (
          <>
            <p class="hint warn" role="status">{d.stillMissing(missing)}</p>
            <label class="chk">
              <input type="checkbox" checked={writeOff} onChange={(e) => setWriteOff((e.target as HTMLInputElement).checked)} />
              <span>{d.writeOffCheckbox}</span>
            </label>
          </>
        )}
        <div class="row end">
          <button type="button" class="btn" onClick={onClose}>{d.cancel}</button>
          <button type="submit" class="btn primary">{d.ok}</button>
        </div>
      </form>
    </Dialog>
  );
}
