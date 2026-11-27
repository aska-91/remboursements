import { useMemo, useState } from "preact/hooks";
import type { Category, Claim, Ymd } from "../domain/types";
import { CATEGORIES } from "../domain/types";
import { LIST_FILTERS, listClaims, matchesFilter, type ListFilter } from "../domain/list";
import type { ClaimActions } from "./claimActions";
import { ClaimCard } from "./ClaimCard";
import { strings } from "./strings";

const S = strings;
const categoryLabel = (c: Category) => S.categories[c];

export function ClaimList({ claims, today, actions }: { claims: Claim[]; today: Ymd; actions: ClaimActions }) {
  const [filter, setFilter] = useState<ListFilter>("in_progress");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const rows = useMemo(
    () => listClaims(claims, { filter, search, category, categoryLabel }, today),
    [claims, filter, search, category, today],
  );
  const counts = useMemo(
    () => Object.fromEntries(LIST_FILTERS.map((f) => [f, claims.filter((c) => matchesFilter(c, f, today)).length])),
    [claims, today],
  );

  return (
    <section class="list-section" aria-label={S.listLabel}>
      <div class="filters" role="search" aria-label={S.filtersLabel}>
        <div class="seg">
          {LIST_FILTERS.map((f) => (
            <button key={f} type="button" class="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {S.filters[f]}
              <span class="c">{counts[f]}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder={S.searchPlaceholder} aria-label={S.searchLabel} value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        <select aria-label={S.categoryLabel} value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as Category | "all")}>
          <option value="all">{S.allCategories}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{S.categories[c]}</option>)}
        </select>
      </div>

      <div class="list" aria-live="polite">
        {rows.length ? (
          rows.map((c) => <ClaimCard key={c.id} c={c} today={today} actions={actions} />)
        ) : (
          <div class="empty">
            <p>{claims.length ? S.emptyView : S.emptyAll}</p>
          </div>
        )}
      </div>
    </section>
  );
}
