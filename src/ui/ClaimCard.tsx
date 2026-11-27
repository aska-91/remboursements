import type { Claim, Item, Ymd } from "../domain/types";
import { claimReceived, claimRemaining, claimStatus, gap, isClosed, isShop, itemOpen, itemState } from "../domain/status";
import { daysBetween, formatDateTime } from "../domain/dates";
import { formatMoney } from "../domain/money";
import { lastCancelReason } from "../domain/actions";
import type { ClaimActions } from "./claimActions";
import { strings } from "./strings";


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
    num = strings.item.received(i.received!);
    when = strings.item.receivedOn(i.receivedDate);
  } else if (s === "gap") {
    num = strings.item.gap(i.received!, i.expected, gap(i));
    when = strings.item.lastPayment(i.receivedDate);
    tone = "gap";
  } else if (s === "written_off") {
    num = strings.item.writtenOff(i.received!, i.expected, gap(i));
    when = strings.item.writtenOffWhen;
  } else if (s === "refused") {
    num = strings.item.refused(i.expected);
    when = strings.item.refusedReason(i.refusedReason);
  } else {
    num = strings.item.expected(i.expected);
    if (isShop(c) && !c.returnedDate) when = strings.item.afterReturn;
    else if (i.due) {
      const d = daysBetween(today, i.due);
      if (d < 0) {
        when = strings.item.late(-d, i.due);
        tone = "late";
      } else when = d === 0 ? strings.item.dueToday : strings.item.due(i.due, d);
    } else when = strings.item.noDue;
  }
  if ((s === "pending" || s === "late" || s === "gap") && i.lastChase) when += strings.item.chased(i.lastChase);
  return { num, when, tone };
}

function ItemRow({ c, i, today, actions }: { c: Claim; i: Item; today: Ymd; actions: ClaimActions }) {
  const t = itemTexts(c, i, today);
  const s = itemState(c, i, today);
  const a = strings.actions;
  const held = isShop(c) && !c.returnedDate && (s === "pending" || s === "late");
  return (
    <li class="item">
      <span class="who">{strings.sources[i.source]}</span>
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
        <b>{strings.shop.step1}</b>
        <span>{c.returnedDate ? strings.shop.done : c.returnBy ? strings.shop.returnBefore(c.returnBy, strings.inDays(d!)) : strings.shop.noDeadline}</span>
        {!c.returnedDate && !c.cancelled && <Btn label={strings.actions.markReturned} onClick={() => actions.markReturned(c)} />}
      </li>
      <li class={`step ${c.returnedDate ? "done" : ""}`}>
        <b>{strings.shop.step2}</b>
        <span>{c.returnedDate ? strings.shop.returnedOn(c.returnedDate, c.tracking) : strings.shop.toDo}</span>
      </li>
      <li class={`step ${step3}`}>
        <b>{strings.shop.step3(strings.refundModes[c.refundMode])}</b>
        <span>{closedAll ? strings.shop.done : c.returnedDate ? strings.shop.left(claimRemaining(c, today)) : strings.shop.afterReturn}</span>
      </li>
    </ol>
  );
}

function RequestLine({ c, today, actions }: { c: Claim; today: Ymd; actions: ClaimActions }) {
  const d = c.claimBy ? daysBetween(today, c.claimBy) : null;
  const tone = c.sentDate ? "done" : d !== null && d < 0 ? "bad" : "";
  const text = c.sentDate
    ? strings.request.sent(c.sentDate)
    : c.claimBy
      ? strings.request.toSendBefore(c.claimBy, strings.inDays(d!))
      : strings.request.toSendNoDeadline;
  return (
    <div class={`reqline ${tone}`}>
      <span>{text}</span>
      {!c.sentDate && !c.cancelled && <Btn label={strings.actions.markSent} onClick={() => actions.markSent(c)} />}
    </div>
  );
}

function History({ c }: { c: Claim }) {
  const rows = [...c.log].sort((a, b) => b.t - a.t);
  return (
    <details class="log">
      <summary>{strings.card.history(c.log.length)}</summary>
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
        <p class="meta">{strings.card.noHistory}</p>
      )}
    </details>
  );
}

export function ClaimCard({ c, today, actions }: { c: Claim; today: Ymd; actions: ClaimActions }) {
  const st = claimStatus(c, today);
  const remaining = claimRemaining(c, today);
  const reason = c.cancelled ? lastCancelReason(c) : "";
  const a = strings.actions;
  const titleId = `claim-${c.id}`;
  return (
    <article class={`card s-${st}${c.archived ? " archived" : ""}`} aria-labelledby={titleId}>
      <div class="card-top">
        <div>
          <h3 class="title" id={titleId}>{c.label}</h3>
          <div class="meta">{strings.card.meta(strings.categories[c.category], c.date, c.ref)}</div>
          <div class="pills">
            <span class={`pill p-${st}`}>{strings.status[st]}</span>
            {c.archived && <span class="pill p-archived">{strings.archivedPill}</span>}
          </div>
        </div>
        <div class="money">
          <div class="meta">{strings.card.paid(c.amount)}</div>
          {c.cancelled ? (
            <b>{strings.card.cancelled}</b>
          ) : (
            <>
              <b>{formatMoney(remaining > 0 ? remaining : claimReceived(c))}</b>
              <div class="meta">{remaining > 0 ? strings.card.stillToReceive : strings.card.receivedTotal}</div>
            </>
          )}
        </div>
      </div>

      {reason && <p class="meta">{strings.card.cancelReason(reason)}</p>}
      {isShop(c) ? <ShopSteps c={c} today={today} actions={actions} /> : c.needsRequest && <RequestLine c={c} today={today} actions={actions} />}

      {!c.cancelled &&
        (c.items.length ? (
          <ul class="items" aria-label={strings.card.refundLines}>
            {c.items.map((i) => <ItemRow key={i.id} c={c} i={i} today={today} actions={actions} />)}
          </ul>
        ) : (
          <p class="meta">{strings.card.noItems}</p>
        ))}
      {c.notes && <p class="meta">{strings.card.note(c.notes)}</p>}

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
