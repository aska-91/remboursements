import type { Claim, Item, Ymd } from "../domain/types";
import { claimReceived, claimRemaining, claimStatus, gap, isClosed, isShop, itemOpen, itemState } from "../domain/status";
import { daysBetween, formatDateTime } from "../domain/dates";
import { formatMoney } from "../domain/money";
import { lastCancelReason } from "../domain/actions";
import type { ClaimActions } from "./claimActions";
import { strings } from "./strings";

const S = strings;

function Btn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" class={`btn small${danger ? " danger" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

/** Amount line, date line and its emphasis for one refund line. */
function itemTexts(c: Claim, i: Item, today: Ymd): { num: string; when: string; tone: "" | "late" | "gap" } {
  const s = itemState(c, i, today);
  let num: string;
  let when: string;
  let tone: "" | "late" | "gap" = "";
  if (s === "received") {
    num = S.item.received(i.received!);
    when = S.item.receivedOn(i.receivedDate);
  } else if (s === "gap") {
    num = S.item.gap(i.received!, i.expected, gap(i));
    when = S.item.lastPayment(i.receivedDate);
    tone = "gap";
  } else if (s === "written_off") {
    num = S.item.writtenOff(i.received!, i.expected, gap(i));
    when = S.item.writtenOffWhen;
  } else if (s === "refused") {
    num = S.item.refused(i.expected);
    when = S.item.refusedReason(i.refusedReason);
  } else {
    num = S.item.expected(i.expected);
    if (isShop(c) && !c.returnedDate) when = S.item.afterReturn;
    else if (i.due) {
      const d = daysBetween(today, i.due);
      if (d < 0) {
        when = S.item.late(-d, i.due);
        tone = "late";
      } else when = d === 0 ? S.item.dueToday : S.item.due(i.due, d);
    } else when = S.item.noDue;
  }
  if ((s === "pending" || s === "late" || s === "gap") && i.lastChase) when += S.item.chased(i.lastChase);
  return { num, when, tone };
}

function ItemRow({ c, i, today, actions }: { c: Claim; i: Item; today: Ymd; actions: ClaimActions }) {
  const t = itemTexts(c, i, today);
  const s = itemState(c, i, today);
  const a = S.actions;
  const held = isShop(c) && !c.returnedDate && (s === "pending" || s === "late");
  return (
    <li class="item">
      <span class="who">{S.sources[i.source]}</span>
      <span class="num">{t.num}</span>
      <span class={`when ${t.tone}`}>{t.when}</span>
      <span class="acts">
        {held ? (
          <Btn label={a.refused} onClick={() => actions.refuse(c, i)} />
        ) : s === "pending" || s === "late" ? (
          <>
            <Btn label={a.markReceived} onClick={() => actions.receive(c, i)} />
            <Btn label={a.chase} onClick={() => actions.chase(c, i)} />
            <Btn label={a.refused} onClick={() => actions.refuse(c, i)} />
          </>
        ) : s === "gap" ? (
          <>
            <Btn label={a.topUp} onClick={() => actions.receive(c, i)} />
            <Btn label={a.chase} onClick={() => actions.chase(c, i)} />
            <Btn label={a.writeOff} onClick={() => actions.writeOff(c, i)} />
          </>
        ) : s === "received" ? (
          <Btn label={a.undo} onClick={() => actions.undoReceipt(c, i)} />
        ) : s === "written_off" ? (
          <Btn label={a.reopen} onClick={() => actions.reopenGap(c, i)} />
        ) : (
          <Btn label={a.reopen} onClick={() => actions.undoRefusal(c, i)} />
        )}
      </span>
    </li>
  );
}

function ShopSteps({ c, today, actions }: { c: Claim; today: Ymd; actions: ClaimActions }) {
  const d = c.returnBy ? daysBetween(today, c.returnBy) : null;
  const closedAll = !!c.returnedDate && c.items.length > 0 && !c.items.some((i) => itemOpen(c, i, today));
  const late = c.items.some((i) => itemState(c, i, today) === "late");
  const step1 = c.returnedDate ? "done" : d !== null && d < 0 ? "bad" : "cur";
  const step3 = closedAll ? "done" : late ? "bad" : c.returnedDate ? "cur" : "";
  return (
    <ol class="steps">
      <li class={`step ${step1}`}>
        <b>{S.shop.step1}</b>
        <span>{c.returnedDate ? S.shop.done : c.returnBy ? S.shop.returnBefore(c.returnBy, S.inDays(d!)) : S.shop.noDeadline}</span>
        {!c.returnedDate && !c.cancelled && <Btn label={S.actions.markReturned} onClick={() => actions.markReturned(c)} />}
      </li>
      <li class={`step ${c.returnedDate ? "done" : ""}`}>
        <b>{S.shop.step2}</b>
        <span>{c.returnedDate ? S.shop.returnedOn(c.returnedDate, c.tracking) : S.shop.toDo}</span>
      </li>
      <li class={`step ${step3}`}>
        <b>{S.shop.step3(S.refundModes[c.refundMode])}</b>
        <span>{closedAll ? S.shop.done : c.returnedDate ? S.shop.left(claimRemaining(c, today)) : S.shop.afterReturn}</span>
      </li>
    </ol>
  );
}

function RequestLine({ c, today, actions }: { c: Claim; today: Ymd; actions: ClaimActions }) {
  const d = c.claimBy ? daysBetween(today, c.claimBy) : null;
  const tone = c.sentDate ? "done" : d !== null && d < 0 ? "bad" : "";
  const text = c.sentDate
    ? S.request.sent(c.sentDate)
    : c.claimBy
      ? S.request.toSendBefore(c.claimBy, S.inDays(d!))
      : S.request.toSendNoDeadline;
  return (
    <div class={`reqline ${tone}`}>
      <span>{text}</span>
      {!c.sentDate && !c.cancelled && <Btn label={S.actions.markSent} onClick={() => actions.markSent(c)} />}
    </div>
  );
}

function History({ c }: { c: Claim }) {
  const rows = [...c.log].sort((a, b) => b.t - a.t);
  return (
    <details class="log">
      <summary>{S.card.history(c.log.length)}</summary>
      {rows.length ? (
        <ul class="logrows">
          {rows.map((l, k) => (
            <li class="logrow" key={k}>
              <span class="t">{l.t ? formatDateTime(l.t) : ""}</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="meta">{S.card.noHistory}</p>
      )}
    </details>
  );
}

export function ClaimCard({ c, today, actions }: { c: Claim; today: Ymd; actions: ClaimActions }) {
  const st = claimStatus(c, today);
  const remaining = claimRemaining(c, today);
  const reason = c.cancelled ? lastCancelReason(c) : "";
  const a = S.actions;
  const titleId = `claim-${c.id}`;
  return (
    <article class={`card s-${st}${c.archived ? " archived" : ""}`} aria-labelledby={titleId}>
      <div class="card-top">
        <div>
          <h3 class="title" id={titleId}>{c.label}</h3>
          <div class="meta">{S.card.meta(S.categories[c.category], c.date, c.ref)}</div>
          <div class="pills">
            <span class={`pill p-${st}`}>{S.status[st]}</span>
            {c.archived && <span class="pill p-archived">{S.archivedPill}</span>}
          </div>
        </div>
        <div class="money">
          <div class="meta">{S.card.paid(c.amount)}</div>
          {c.cancelled ? (
            <b>{S.card.cancelled}</b>
          ) : (
            <>
              <b>{formatMoney(remaining > 0 ? remaining : claimReceived(c))}</b>
              <div class="meta">{remaining > 0 ? S.card.stillToReceive : S.card.receivedTotal}</div>
            </>
          )}
        </div>
      </div>

      {reason && <p class="meta">{S.card.cancelReason(reason)}</p>}
      {isShop(c) ? <ShopSteps c={c} today={today} actions={actions} /> : c.needsRequest && <RequestLine c={c} today={today} actions={actions} />}

      {!c.cancelled &&
        (c.items.length ? (
          <ul class="items" aria-label={S.card.refundLines}>
            {c.items.map((i) => <ItemRow key={i.id} c={c} i={i} today={today} actions={actions} />)}
          </ul>
        ) : (
          <p class="meta">{S.card.noItems}</p>
        ))}
      {c.notes && <p class="meta">{S.card.note(c.notes)}</p>}

      <History c={c} />

      <div class="card-actions">
        <Btn label={a.addNote} onClick={() => actions.addNote(c)} />
        {actions.edit && <Btn label={a.edit} onClick={() => actions.edit!(c)} />}
        {c.archived ? (
          <>
            <Btn label={a.unarchive} onClick={() => actions.unarchive(c)} />
            <Btn label={a.deleteForever} danger onClick={() => actions.deleteForever(c)} />
          </>
        ) : (
          <>
            {isClosed(c, today) && <Btn label={a.archive} onClick={() => actions.archive(c)} />}
            {c.cancelled ? (
              <Btn label={a.reinstate} onClick={() => actions.restore(c)} />
            ) : (
              <Btn label={a.cancelClaim} danger onClick={() => actions.cancel(c)} />
            )}
          </>
        )}
      </div>
    </article>
  );
}
