import { useState } from "preact/hooks";
import type { Category, Claim, RefundMode, Source, Ymd } from "../../domain/types";
import { CATEGORIES, DEFAULT_DELAY_DAYS, REFUND_MODES, SHOP_CATEGORY, SOURCES } from "../../domain/types";
import { blankItem, defaultClaimBy, defaultDue, defaultItems, isLocked, newId, type ClaimInput } from "../../domain/actions";
import { addDays } from "../../domain/dates";
import { toCents, toEuros } from "../../domain/money";
import { Dialog } from "../components/Dialog";
import { strings } from "../strings";


/** One editable refund line. Amounts stay as typed text until saving. */
interface Row {
  id: string;
  source: Source;
  expected: string;
  due: Ymd;
  /** The user changed the date: stop recomputing it from the source. */
  dueTouched: boolean;
  /** Something was already received on this line (editing). */
  hasReceipt: boolean;
  /** Received or refused: part of the history, cannot be removed. */
  locked: boolean;
}

const eurosText = (cents: number) => (cents ? String(toEuros(cents)) : "");

function rowsFor(category: Category, date: Ymd, amount: string): Row[] {
  return defaultItems(category, date, toCents(amount)).map((i) => ({
    id: i.id, source: i.source, expected: eurosText(i.expected), due: i.due, dueTouched: false, hasReceipt: false, locked: false,
  }));
}

interface Props {
  /** Expense to edit, or undefined for a new one. */
  claim?: Claim;
  today: Ymd;
  onSave: (input: ClaimInput) => void;
  onClose: () => void;
}

export function ClaimForm({ claim, today, onSave, onClose }: Props) {
  const editing = !!claim;
  const [date, setDate] = useState(claim?.date ?? today);
  const [category, setCategory] = useState<Category>(claim?.category ?? CATEGORIES[0]);
  const [label, setLabel] = useState(claim?.label ?? "");
  const [amount, setAmount] = useState(claim ? eurosText(claim.amount) : "");
  const [ref, setRef] = useState(claim?.ref ?? "");
  const [notes, setNotes] = useState(claim?.notes ?? "");
  const [returnBy, setReturnBy] = useState(claim?.returnBy ?? "");
  const [returnedDate, setReturnedDate] = useState(claim?.returnedDate ?? "");
  const [tracking, setTracking] = useState(claim?.tracking ?? "");
  const [refundMode, setRefundMode] = useState<RefundMode>(claim?.refundMode ?? REFUND_MODES[0]);
  const [needsRequest, setNeedsRequest] = useState(claim?.needsRequest ?? false);
  const [claimBy, setClaimBy] = useState(claim?.claimBy ?? "");
  const [sentDate, setSentDate] = useState(claim?.sentDate ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    claim
      ? claim.items.map((i) => ({
          id: i.id, source: i.source, expected: eurosText(i.expected), due: i.due, dueTouched: true, hasReceipt: i.received != null, locked: isLocked(i),
        }))
      : rowsFor(CATEGORIES[0], today, ""),
  );
  const shop = category === SHOP_CATEGORY;

  const val = (f: (v: string) => void) => (e: Event) => f((e.target as HTMLInputElement).value);
  const setRow = (id: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const changeCategory = (c: Category) => {
    setCategory(c);
    // New expense: pre-fill the lines that fit the category. Editing keeps the user's lines.
    if (!editing) setRows(rowsFor(c, date, amount));
  };
  const changeAmount = (v: string) => {
    setAmount(v);
    // New return with its single Retailer line: the refund follows the price paid.
    if (shop && !editing && rows.length === 1) setRows([{ ...rows[0]!, expected: v }]);
  };
  const changeNeedsRequest = (checked: boolean) => {
    setNeedsRequest(checked);
    if (checked && !claimBy) setClaimBy(defaultClaimBy(date || today));
  };
  const changeSource = (r: Row, source: Source) => {
    const recompute = !r.dueTouched && !r.hasReceipt && !shop;
    setRow(r.id, { source, ...(recompute ? { due: addDays(date || today, DEFAULT_DELAY_DAYS[source]) } : {}) });
  };
  const addRow = () => {
    const i = blankItem("mutuelle", defaultDue("mutuelle", date || today, category));
    setRows([...rows, { id: newId(), source: i.source, expected: "", due: i.due, dueTouched: false, hasReceipt: false, locked: false }]);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (!label.trim()) return;
    onClose();
    onSave({
      date, label, category, amount: toCents(amount), ref, notes, returnBy, returnedDate, tracking, refundMode,
      needsRequest, claimBy, sentDate,
      items: rows.map((r) => ({ id: r.id, source: r.source, expected: toCents(r.expected), due: r.due })),
    });
  };

  return (
    <Dialog title={editing ? strings.form.editTitle : strings.form.newTitle} size="wide" onClose={onClose}>
      <form class="stack" onSubmit={submit}>
        <div class="grid2">
          <label class="f">{strings.form.date}<input type="date" required value={date} onInput={val(setDate)} /></label>
          <label class="f">
            {strings.form.category}
            <select value={category} onChange={val((v) => changeCategory(v as Category))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{strings.categories[c]}</option>)}
            </select>
          </label>
        </div>
        <label class="f">
          {strings.form.label}
          <input type="text" required maxLength={120} placeholder={strings.form.labelPlaceholder} data-autofocus value={label} onInput={val(setLabel)} />
        </label>
        <div class="grid2">
          <label class="f">{strings.form.amount}<input type="number" step="0.01" min="0" required inputMode="decimal" value={amount} onInput={val(changeAmount)} /></label>
          <label class="f">{strings.form.ref}<input type="text" maxLength={60} value={ref} onInput={val(setRef)} /></label>
        </div>

        {shop ? (
          <fieldset class="block">
            <legend>{strings.form.returnBlock}</legend>
            <div class="grid2">
              <label class="f">{strings.form.returnBy}<input type="date" value={returnBy} onInput={val(setReturnBy)} /></label>
              <label class="f">
                {strings.form.refundMode}
                <select value={refundMode} onChange={val((v) => setRefundMode(v as RefundMode))}>
                  {REFUND_MODES.map((m) => <option key={m} value={m}>{strings.refundModeOptions[m]}</option>)}
                </select>
              </label>
              <label class="f">{strings.form.returnedDate}<input type="date" value={returnedDate} onInput={val(setReturnedDate)} /></label>
              <label class="f">{strings.form.tracking}<input type="text" maxLength={60} value={tracking} onInput={val(setTracking)} /></label>
            </div>
            <p class="hint">{strings.form.returnHint}</p>
          </fieldset>
        ) : (
          <div class="block">
            <label class="chk">
              <input type="checkbox" checked={needsRequest} onChange={(e) => changeNeedsRequest((e.target as HTMLInputElement).checked)} />
              <span>{strings.form.needsRequest}</span>
            </label>
            {needsRequest && (
              <>
                <div class="grid2">
                  <label class="f">{strings.form.claimBy}<input type="date" value={claimBy} onInput={val(setClaimBy)} /></label>
                  <label class="f">{strings.form.sentDate}<input type="date" value={sentDate} onInput={val(setSentDate)} /></label>
                </div>
                <p class="hint">{strings.form.requestHint}</p>
              </>
            )}
          </div>
        )}

        <fieldset class="lines">
          <div class="row spread">
            <legend>{strings.form.refundsBlock}</legend>
            <button type="button" class="btn small" onClick={addRow}>{strings.form.addLine}</button>
          </div>
          {rows.map((r, k) => (
            <div class="exp-row" key={r.id} role="group" aria-label={strings.form.lineLabel(k + 1)}>
              <label class="f">
                {strings.form.source}
                <select value={r.source} onChange={val((v) => changeSource(r, v as Source))}>
                  {SOURCES.map((s) => <option key={s} value={s}>{strings.sources[s]}</option>)}
                </select>
              </label>
              <label class="f">
                {strings.form.expected}
                <input type="number" step="0.01" min="0" inputMode="decimal" value={r.expected} onInput={val((v) => setRow(r.id, { expected: v }))} />
              </label>
              <label class="f">
                {strings.form.due}
                <input type="date" value={r.due} onInput={val((v) => setRow(r.id, { due: v, dueTouched: true }))} />
              </label>
              {r.locked ? (
                <p class="hint rm" id={`locked-${r.id}`}>{strings.form.lockedLine}</p>
              ) : (
                <button type="button" class="btn small rm" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>
                  {strings.form.removeLine}
                </button>
              )}
            </div>
          ))}
          <p class="hint">{strings.form.refundsHint}</p>
        </fieldset>

        <label class="f">{strings.form.notes}<textarea rows={2} maxLength={400} value={notes} onInput={val(setNotes)} /></label>
        <div class="row end">
          <button type="button" class="btn" onClick={onClose}>{strings.dialog.cancel}</button>
          <button type="submit" class="btn primary">{strings.form.save}</button>
        </div>
      </form>
    </Dialog>
  );
}
