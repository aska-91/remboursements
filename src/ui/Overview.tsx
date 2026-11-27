import { useState } from "preact/hooks";
import type { Claim, Ymd } from "../domain/types";
import { SOURCES } from "../domain/types";
import { buildAlerts, type Alert } from "../domain/alerts";
import { remainingBySource, summary, yearlyTotals } from "../domain/totals";
import { formatMoney } from "../domain/money";
import type { ClaimActions } from "./claimActions";
import { strings } from "./strings";

const ALERTS_SHOWN = 6;

function Tile({ k, v, n, tone = "" }: { k: string; v: string; n: string; tone?: string }) {
  return (
    <div class={`tile ${tone}`}>
      <span class="k">{k}</span>
      <span class="v">{v}</span>
      <span class="n">{n}</span>
    </div>
  );
}

export function Tiles({ claims, today }: { claims: Claim[]; today: Ymd }) {
  const s = summary(claims, today);
  const todo = buildAlerts(claims, today).length;
  const o = strings.overview;
  return (
    <section class="tiles" aria-label={o.label}>
      <Tile tone="main" k={o.remaining} v={formatMoney(s.remaining)} n={o.remainingSub(s.remainingCount)} />
      <Tile tone={todo ? "late" : ""} k={o.toDo} v={String(todo)} n={o.toDoSub(s.atRisk)} />
      <Tile k={o.received} v={formatMoney(s.received)} n={o.receivedSub(s.advanced)} />
      <Tile k={o.outOfPocket} v={formatMoney(s.outOfPocket)} n={o.outOfPocketSub} />
    </section>
  );
}

/** Text and buttons of one to-do entry. */
function alertView(a: Alert, c: Claim, actions: ClaimActions): { text: string; buttons: [string, () => void][] } {
  const A = strings.alerts;
  const act = strings.actions;
  switch (a.kind) {
    case "return_overdue":
      return { text: A.returnOverdue(-a.days, c.label), buttons: [[act.markReturned, () => actions.markReturned(c)]] };
    case "return_soon":
      return { text: A.returnSoon(strings.inDays(a.days), c.label), buttons: [[act.markReturned, () => actions.markReturned(c)]] };
    case "request_overdue":
      return { text: A.requestOverdue(-a.days, c.label), buttons: [[act.markSent, () => actions.markSent(c)]] };
    case "request_soon":
      return { text: A.requestSoon(a.deadline, strings.inDays(a.days), c.label), buttons: [[act.markSent, () => actions.markSent(c)]] };
    case "item_late": {
      const i = c.items.find((x) => x.id === a.itemId)!;
      return {
        text: A.itemLate(strings.sources[a.source], -a.days, a.amount, c.label),
        buttons: [[act.chase, () => actions.chase(c, i)], [act.markReceived, () => actions.receive(c, i)]],
      };
    }
    case "item_gap": {
      const i = c.items.find((x) => x.id === a.itemId)!;
      return {
        text: A.itemGap(a.amount, strings.sources[a.source], c.label),
        buttons: [[act.chase, () => actions.chase(c, i)], [act.writeOff, () => actions.writeOff(c, i)]],
      };
    }
  }
}

export function ToDo({ claims, today, actions }: { claims: Claim[]; today: Ymd; actions: ClaimActions }) {
  const [showAll, setShowAll] = useState(false);
  const alerts = buildAlerts(claims, today);
  if (!alerts.length) return null;
  const byId = new Map(claims.map((c) => [c.id, c]));
  const shown = showAll ? alerts : alerts.slice(0, ALERTS_SHOWN);
  return (
    <section class="panel alerts" aria-labelledby="todo-title">
      <h2 id="todo-title">{strings.alerts.title(alerts.length)}</h2>
      <ul class="alert-list">
        {shown.map((a) => {
          const v = alertView(a, byId.get(a.claimId)!, actions);
          return (
            <li key={`${a.kind}-${a.claimId}-${"itemId" in a ? a.itemId : ""}`} class={`alert s${a.severity}`}>
              <span class="txt">{v.text}</span>
              <span class="btns">
                {v.buttons.map(([label, fn]) => (
                  <button key={label} type="button" class="btn small" onClick={fn}>{label}</button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {alerts.length > ALERTS_SHOWN && (
        <button type="button" class="btn small" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? strings.alerts.showLess : strings.alerts.showMore(alerts.length - ALERTS_SHOWN)}
        </button>
      )}
    </section>
  );
}

export function Sources({ claims, today }: { claims: Claim[]; today: Ymd }) {
  const totals = remainingBySource(claims, today);
  const max = Math.max(...SOURCES.map((s) => totals[s]));
  const rows = SOURCES.filter((s) => totals[s] > 0);
  return (
    <section class="panel sources" aria-labelledby="sources-title">
      <h2 id="sources-title">{strings.overview.bySource}</h2>
      {rows.length ? (
        <ul class="src-list">
          {rows.map((s) => (
            <li class="src" key={s}>
              <span>{strings.sources[s]}</span>
              <span class="bar" aria-hidden="true"><i style={{ width: `${Math.max(4, (totals[s] / max) * 100)}%` }} /></span>
              <span class="amt">{formatMoney(totals[s])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="meta">{strings.overview.nothingPending}</p>
      )}
    </section>
  );
}

export function YearTotals({ claims, today }: { claims: Claim[]; today: Ymd }) {
  const years = yearlyTotals(claims, today);
  const y = strings.yearly;
  return (
    <details class="panel yearly">
      <summary>{y.title}</summary>
      {years.length ? (
        <div class="tablewrap" tabIndex={0} role="region" aria-label={y.title}>
          <table>
            <thead>
              <tr>
                <th scope="col">{y.year}</th><th scope="col">{y.count}</th><th scope="col">{y.paid}</th>
                <th scope="col">{y.received}</th><th scope="col">{y.remaining}</th><th scope="col">{y.outOfPocket}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((r) => (
                <tr key={r.year}>
                  <th scope="row">{r.year}</th><td>{r.count}</td><td>{formatMoney(r.advanced)}</td>
                  <td>{formatMoney(r.received)}</td><td>{formatMoney(r.remaining)}</td><td>{formatMoney(r.outOfPocket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="meta">{y.empty}</p>
      )}
    </details>
  );
}
