import { useMemo, useState } from "preact/hooks";
import type { Category, Claim, Group, Ymd } from "../domain/types";
import { GROUPS, HEALTH_CATEGORIES } from "../domain/types";
import {
  ALL_FILTER, PERIOD_PRESETS, buildReport, normKey, periodRange, statusOf, storeChoices, subcategoryChoices,
  type BreakdownRow, type PeriodPreset, type Report, type ReportFilter, type Totals,
} from "../domain/report";
import { claimReceived, claimRemaining } from "../domain/status";
import { formatDate } from "../domain/dates";
import { formatMoney } from "../domain/money";
import { buildReportCsv } from "../export/reportCsv";
import { download } from "./download";
import { kindLabel } from "./labels";
import { getLang, strings } from "./strings";

type Preset = PeriodPreset | "custom";

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat(getLang(), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}

const slug = (s: string) => normKey(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";

function rowName(dimension: Report["dimension"], r: BreakdownRow): string {
  switch (dimension) {
    case "group": return strings.groups[r.key as Group];
    case "category": return strings.categories[r.key as Category];
    case "store": return r.label || strings.noStore;
    case "subcategory": return r.label || strings.noSubcategory;
  }
}

function Tile({ k, v, n, tone = "" }: { k: string; v: string; n: string; tone?: string }) {
  return (
    <div class={`tile ${tone}`}>
      <span class="k">{k}</span>
      <span class="v">{v}</span>
      <span class="n">{n}</span>
    </div>
  );
}

interface Props {
  /** Current language, so memoised results follow a language change. */
  lang: string;
  claims: Claim[];
  today: Ymd;
  toast: (msg: string) => void;
}

export function HistoryView({ lang, claims, today, toast }: Props) {
  const H = strings.history;
  const [group, setGroup] = useState<Group | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [store, setStore] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [preset, setPreset] = useState<Preset>("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [newestFirst, setNewestFirst] = useState(true);

  const range = preset === "custom" ? custom : periodRange(preset, today);
  const filter: ReportFilter = { ...ALL_FILTER, group, category, store, subcategory, ...range };
  const report = useMemo(
    () => buildReport(claims, filter, today, newestFirst),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claims, group, category, store, subcategory, range.from, range.to, today, newestFirst],
  );
  const stores = useMemo(() => storeChoices(claims), [claims]);
  const subs = useMemo(
    () => subcategoryChoices(claims, group === "other" ? ["other"] : ["shopping"]),
    [claims, group],
  );
  const withoutStore = useMemo(
    () => claims.filter((c) => c.category === "item_return" && !c.cancelled && !c.store.trim()).length,
    [claims],
  );

  const changeGroup = (g: Group | "all") => {
    setGroup(g);
    setCategory("all");
    setStore("all");
    setSubcategory("all");
  };

  // What the report is about, for the printed header and the file names.
  const what =
    group === "health" ? (category === "all" ? strings.groups.health : strings.categories[category])
    : group === "shopping" ? (store === "all" ? strings.groups.shopping : stores.find((s) => s.key === store)?.label || strings.noStore)
    : group === "other" ? strings.groups.other
    : strings.allFamilies;
  const subtitle = [what, subcategory !== "all" ? subs.find((s) => s.key === subcategory)?.label || strings.noSubcategory : ""].filter(Boolean).join(" · ");
  const periodText = H.periodText(range.from, range.to);

  const exportCsv = () => {
    download(H.csvFile(slug(what), today), buildReportCsv(report, today), "text/csv;charset=utf-8");
    toast(strings.backup.exported);
  };
  const print = () => {
    // Chrome proposes the page title as the PDF file name.
    const previous = document.title;
    document.title = H.printTitle(subtitle, preset === "all" ? "" : periodText);
    const restore = () => { document.title = previous; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const t = report.totals;
  const showBreakdown = report.breakdown.length > 1;
  return (
    <section class="history" aria-labelledby="history-title" data-lang={lang}>
      <div class="print-only print-head">
        <h2>{H.printTitle(subtitle, "")}</h2>
        <p>{periodText} · {H.printedOn(formatDate(today))}</p>
      </div>
      <h2 id="history-title" class="no-print">{H.title}</h2>

      <div class="panel filters-panel no-print" role="group" aria-label={H.filtersLabel}>
        <div class="filter-grid">
          <label class="f">
            {H.family}
            <select value={group} onChange={(e) => changeGroup((e.target as HTMLSelectElement).value as Group | "all")}>
              <option value="all">{strings.allFamilies}</option>
              {GROUPS.map((g) => <option key={g} value={g}>{strings.groups[g]}</option>)}
            </select>
          </label>
          {group === "health" && (
            <label class="f">
              {H.type}
              <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as Category | "all")}>
                <option value="all">{H.allTypes}</option>
                {HEALTH_CATEGORIES.map((c) => <option key={c} value={c}>{strings.categories[c]}</option>)}
              </select>
            </label>
          )}
          {group === "shopping" && (
            <label class="f">
              {H.store}
              <select value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value)}>
                <option value="all">{H.allStores}</option>
                {stores.map((s) => <option key={s.key} value={s.key}>{s.label || strings.noStore}</option>)}
              </select>
            </label>
          )}
          {(group === "shopping" || group === "other") && (
            <label class="f">
              {H.subcategory}
              <select value={subcategory} onChange={(e) => setSubcategory((e.target as HTMLSelectElement).value)}>
                <option value="all">{H.allSubcategories}</option>
                {subs.map((s) => <option key={s.key} value={s.key}>{s.label || strings.noSubcategory}</option>)}
              </select>
            </label>
          )}
          <label class="f">
            {H.period}
            <select value={preset} onChange={(e) => setPreset((e.target as HTMLSelectElement).value as Preset)}>
              {PERIOD_PRESETS.map((p) => <option key={p} value={p}>{H.presets[p]}</option>)}
              <option value="custom">{H.presets.custom}</option>
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label class="f">{H.from}<input type="date" value={custom.from} max={custom.to || undefined} onInput={(e) => setCustom({ ...custom, from: (e.target as HTMLInputElement).value })} /></label>
              <label class="f">{H.to}<input type="date" value={custom.to} min={custom.from || undefined} onInput={(e) => setCustom({ ...custom, to: (e.target as HTMLInputElement).value })} /></label>
            </>
          )}
          <label class="f">
            {H.order}
            <select value={newestFirst ? "desc" : "asc"} onChange={(e) => setNewestFirst((e.target as HTMLSelectElement).value === "desc")}>
              <option value="desc">{H.newestFirst}</option>
              <option value="asc">{H.oldestFirst}</option>
            </select>
          </label>
        </div>
        <div class="row end">
          <button type="button" class="btn small" onClick={exportCsv} disabled={!report.claims.length}>{H.exportCsv}</button>
          <button type="button" class="btn small primary" onClick={print} disabled={!report.claims.length}>{H.print}</button>
        </div>
        <p class="hint">{H.cancelledNote}</p>
        {withoutStore > 0 && group !== "health" && group !== "other" && <p class="hint warn">{H.withoutStore(withoutStore)}</p>}
      </div>

      {!report.claims.length ? (
        <div class="empty">
          <p>{H.empty}</p>
          <p class="hint">{H.emptyHint}</p>
        </div>
      ) : (
        <>
          <div class="tiles history-tiles" role="group" aria-label={H.summary}>
            <Tile k={H.advanced} v={formatMoney(t.advanced)} n={H.advancedSub(t.count)} />
            <Tile k={H.refunded} v={formatMoney(t.received)} n={H.refundedSub} />
            <Tile k={H.pending} v={formatMoney(t.remaining)} n={H.pendingSub} />
            <Tile tone="main" k={H.realCost} v={formatMoney(t.outOfPocket)} n={H.realCostSub} />
          </div>

          {showBreakdown && <Breakdown report={report} />}

          <div class="timeline-wrap">
            <h3 class="section-title">{H.timeline}</h3>
            {report.months.map((m) => (
              <section class="month" key={m.month} aria-labelledby={`m-${m.month}`}>
                <header class="month-head">
                  <h4 id={`m-${m.month}`}>{H.monthTitle(monthLabel(m.month))}</h4>
                  <p class="meta">{H.monthTotal(m.count, m.advanced, m.outOfPocket)}</p>
                </header>
                <ol class="timeline">
                  {m.claims.map((c) => <TimelineItem key={c.id} c={c} today={today} />)}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Breakdown({ report }: { report: Report }) {
  const H = strings.history;
  const max = Math.max(...report.breakdown.map((b) => b.advanced), 1);
  const cells = (x: Totals) => (
    <>
      <td>{x.count}</td><td>{formatMoney(x.advanced)}</td><td>{formatMoney(x.received)}</td><td>{formatMoney(x.remaining)}</td><td>{formatMoney(x.outOfPocket)}</td>
    </>
  );
  return (
    <section class="panel breakdown">
      <h3 class="section-title">{H.breakdown[report.dimension]}</h3>
      <div class="tablewrap" tabIndex={0} role="region" aria-label={H.breakdown[report.dimension]}>
        <table>
          <thead>
            <tr>
              <th scope="col">{H.colName}</th><th scope="col">{H.colCount}</th><th scope="col">{H.colAdvanced}</th>
              <th scope="col">{H.colRefunded}</th><th scope="col">{H.colPending}</th><th scope="col">{H.colCost}</th>
            </tr>
          </thead>
          <tbody>
            {report.breakdown.map((b) => (
              <tr key={b.key}>
                <th scope="row">
                  <div class="name-cell">
                    <span>{rowName(report.dimension, b)}</span>
                    <span class="bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (b.advanced / max) * 100)}%` }} /></span>
                  </div>
                </th>
                {cells(b)}
              </tr>
            ))}
            <tr class="total-row">
              <th scope="row">{H.total}</th>{cells(report.totals)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimelineItem({ c, today }: { c: Claim; today: Ymd }) {
  const H = strings.history;
  const st = statusOf(c, today);
  const received = claimReceived(c);
  const remaining = claimRemaining(c, today);
  return (
    <li class="tl-item">
      <span class="tl-dot" aria-hidden="true" />
      <div class="tl-main">
        <div class="tl-top">
          <time dateTime={c.date} class="tl-date">{formatDate(c.date)}</time>
          <span class={`pill p-${st}`}>{strings.status[st]}</span>
        </div>
        <p class="tl-title">{c.label}</p>
        <p class="meta">{kindLabel(c)}{c.ref ? ` · ${c.ref}` : ""}</p>
        <dl class="tl-amounts">
          <div><dt>{H.paid}</dt><dd>{formatMoney(c.amount)}</dd></div>
          <div><dt>{H.refundedShort}</dt><dd>{formatMoney(received)}</dd></div>
          <div><dt>{H.toReceive}</dt><dd>{formatMoney(remaining)}</dd></div>
          <div class="cost"><dt>{H.cost}</dt><dd>{formatMoney(c.amount - received - remaining)}</dd></div>
        </dl>
      </div>
    </li>
  );
}
