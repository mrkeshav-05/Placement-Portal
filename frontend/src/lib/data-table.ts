/**
 * The data pipeline behind every admin table.
 *
 * Kept free of React so the order of operations — search, then filters, then
 * sorting, then pagination — can be tested directly. Pagination running last
 * is what makes a search that leaves 12 of 100 rows say "Page 1 of 1".
 */

export type SortDirection = "asc" | "desc";

/** What a column compares by, as opposed to what it displays. */
export type SortableValue = string | number | boolean | Date | null | undefined;

export type TableSort = { columnId: string; direction: SortDirection };

/** Selected options per filter id. An absent or empty entry filters nothing. */
export type TableFilterState = Record<string, string[]>;

export type PipelineFilter<T> = {
  id: string;
  /** The row's value(s) for this filter, matched against the selected set. */
  value: (row: T) => string | string[] | null | undefined;
};

/** Null, undefined, and the empty string all mean "nothing recorded here". */
export function isEmptySortValue(value: SortableValue): boolean {
  return value === null || value === undefined || value === "";
}

const isEmpty = isEmptySortValue;

/**
 * Order two cell values of any supported kind, ascending.
 *
 * Empty values order last here, and `applyTablePipeline` keeps them last in a
 * descending sort too: a missing CGPA is not "the lowest", it is unknown, and
 * burying it keeps the top of the column meaningful either way.
 */
export function compareSortValues(a: SortableValue, b: SortableValue): number {
  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;

  if (a instanceof Date || b instanceof Date) {
    const left = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const right = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    if (Number.isNaN(left) || Number.isNaN(right)) return 0;
    return left === right ? 0 : left < right ? -1 : 1;
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return Number(Boolean(a)) - Number(Boolean(b));
  }

  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }

  // `numeric` keeps "Sem 2" before "Sem 10" and any digits inside a label in
  // human order rather than character order.
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Every whitespace-separated term must appear somewhere in the row's text, so
 * "isha cse" narrows rather than widening to everything matching either word.
 */
export function rowMatchesQuery(haystack: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = haystack.toLowerCase();
  return terms.every((term) => text.includes(term));
}

export function rowMatchesFilters<T>(
  row: T,
  filters: PipelineFilter<T>[],
  state: TableFilterState,
): boolean {
  // Filters combine with AND across ids and OR inside one id: Batch 2026 or
  // 2027, and Type Internship.
  return filters.every((filter) => {
    const selected = state[filter.id];
    if (!selected?.length) return true;

    const raw = filter.value(row);
    if (raw === null || raw === undefined) return false;
    const values = Array.isArray(raw) ? raw : [raw];
    return values.some((value) => selected.includes(value));
  });
}

export type PipelineInput<T> = {
  rows: T[];
  query?: string;
  /** Everything about a row that search should look at, already flattened. */
  searchText?: (row: T) => string;
  filters?: PipelineFilter<T>[];
  filterState?: TableFilterState;
  sort?: TableSort | null;
  sortValue?: (row: T, columnId: string) => SortableValue;
  /** 1-based. Clamped into range so a stale page cannot blank the table. */
  page?: number;
  /** 0 shows everything on one page. */
  pageSize?: number;
};

export type PipelineResult<T> = {
  rows: T[];
  /** Rows left after search and filters, before pagination. */
  filteredCount: number;
  pageCount: number;
  page: number;
};

/** What the table reports to a caller watching the view. */
export type TableViewSnapshot<T> = PipelineResult<T> & {
  query: string;
  filters: TableFilterState;
  sort: TableSort | null;
};

/**
 * Whether two view snapshots hold the same thing.
 *
 * This guards the table's view notification. Callers write the search mapper
 * inline, so the pipeline is rebuilt on every render and its result is a new
 * object each time; a caller that sets state from the notification would
 * re-render the table, produce another new object, be notified again, and never
 * settle. Comparing contents rather than object identity is what stops that.
 *
 * Rows are compared element by element, because the pipeline builds a fresh
 * array out of the same row objects: the array is always new while its contents
 * usually are not.
 */
export function sameTableView<T>(
  before: TableViewSnapshot<T> | null,
  after: TableViewSnapshot<T>,
): boolean {
  if (!before) return false;
  if (
    before.query !== after.query ||
    before.filters !== after.filters ||
    before.sort?.columnId !== after.sort?.columnId ||
    before.sort?.direction !== after.sort?.direction ||
    before.filteredCount !== after.filteredCount ||
    before.page !== after.page ||
    before.pageCount !== after.pageCount ||
    before.rows.length !== after.rows.length
  ) {
    return false;
  }
  return before.rows.every((row, index) => row === after.rows[index]);
}

export function applyTablePipeline<T>({
  rows,
  query = "",
  searchText,
  filters = [],
  filterState = {},
  sort = null,
  sortValue,
  page = 1,
  pageSize = 0,
}: PipelineInput<T>): PipelineResult<T> {
  let working = rows;

  if (query.trim() && searchText) {
    working = working.filter((row) => rowMatchesQuery(searchText(row), query));
  }

  if (filters.length) {
    working = working.filter((row) => rowMatchesFilters(row, filters, filterState));
  }

  if (sort && sortValue) {
    const factor = sort.direction === "asc" ? 1 : -1;
    // Decorated sort keeps equal rows in their original order, so re-sorting
    // a column does not shuffle rows that tie.
    working = working
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const a = sortValue(left.row, sort.columnId);
        const b = sortValue(right.row, sort.columnId);

        // Empty cells sink to the bottom in both directions, so the direction
        // factor is applied only when there is a real comparison to flip.
        if (isEmpty(a) || isEmpty(b)) {
          if (isEmpty(a) && isEmpty(b)) return left.index - right.index;
          return isEmpty(a) ? 1 : -1;
        }

        const compared = compareSortValues(a, b);
        return compared !== 0 ? compared * factor : left.index - right.index;
      })
      .map((entry) => entry.row);
  }

  const filteredCount = working.length;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(filteredCount / pageSize)) : 1;
  const safePage = Math.min(Math.max(1, page), pageCount);

  if (pageSize > 0) {
    const start = (safePage - 1) * pageSize;
    working = working.slice(start, start + pageSize);
  }

  return { rows: working, filteredCount, pageCount, page: safePage };
}

/** Unsorted → ascending → descending → unsorted, per the reference tables. */
export function nextSortState(current: TableSort | null, columnId: string): TableSort | null {
  if (current?.columnId !== columnId) return { columnId, direction: "asc" };
  if (current.direction === "asc") return { columnId, direction: "desc" };
  return null;
}
