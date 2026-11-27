import { useMemo, useState } from "preact/hooks";
import type { Category, Claim, Ymd } from "../domain/types";
import { CATEGORIES } from "../domain/types";
import { LIST_FILTERS, listClaims, matchesFilter, type ListFilter } from "../domain/list";
import type { ClaimActions } from "./claimActions";
import { ClaimCard } from "./ClaimCard";
import { strings } from "./strings";

const categoryLabel = (c: Category) => strings.categories[c];

interface Props {
  /** Current language: category names used by the search depend on it. */
  lang: string;
  claims: Claim[];
  today: Ymd;
  actions: ClaimActions;
  onAdd: () => void;
}

export function ClaimList({ lang, claims, today, actions, onAdd }: Props) {
  const [filter, setFilter] = useState<ListFilter>("in_progress");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const rows = useMemo(
    () => listClaims(claims, { filter, search, category, categoryLabel }, today),
    [claims, filter, search, category, today, lang],
  );
  const counts = useMemo(
    () => Object.fromEntries(LIST_FILTERS.map((f) => [f, claims.filter((c) => matchesFilter(c, f, today)).length])),
    [claims, today],
  );

  return (
    <section class="list-section" aria-label={strings.listLabel}>
      <div class="filters" role="search" aria-label={strings.filtersLabel}>
        <div class="seg">
          {LIST_FILTERS.map((f) => (
            <button key={f} type="button" class="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {strings.filters[f]}
              <span class="c">{counts[f]}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder={strings.searchPlaceholder} aria-label={strings.searchLabel} value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        <select aria-label={strings.categoryLabel} value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as Category | "all")}>
          <option value="all">{strings.allCategories}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{strings.categories[c]}</option>)}
        </select>
      </div>

      <div class="list" aria-live="polite">
        {rows.length ? (
          rows.map((c) => <ClaimCard key={c.id} c={c} today={today} actions={actions} />)
        ) : (
          <div class="empty">
            <p>{claims.length ? strings.emptyView : strings.emptyAll}</p>
            {!claims.length && <button type="button" class="btn primary" onClick={onAdd}>{strings.addFirst}</button>}
          </div>
        )}
      </div>
    </section>
  );
}
