"use client";

import {
  Check,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Inbox,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  applyTablePipeline,
  nextSortState,
  sameTableView,
  type SortableValue,
  type TableFilterState,
  type TableSort,
} from "@/lib/data-table";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  /** What the cell shows. Formatting belongs here, comparing does not. */
  cell: (row: T) => React.ReactNode;
  /**
   * What the column sorts by. Omit to leave the column unsortable — which is
   * the right answer for an actions column. Return the raw value, never the
   * formatted string, so 10 sorts above 9.2 and a date sorts by its instant.
   */
  sortValue?: (row: T) => SortableValue;
  /** Column width, as a CSS value. Used as a minimum, not a cage. */
  width?: string;
  /**
   * Pins the column to the left edge while the rest scrolls sideways. Only
   * the run of sticky columns starting at the first one can pin: the offset of
   * each is the sum of the widths before it, and that sum is only knowable
   * from a `width` in px. A sticky column without one is left unpinned rather
   * than stacked at the wrong offset.
   */
  sticky?: boolean;
  align?: "left" | "center" | "right";
  /** Columns the viewer may hide. An actions column usually should not be. */
  hideable?: boolean;
  /** Present in the View menu but off until asked for. */
  defaultHidden?: boolean;
  /** Label for the View menu when the header is not plain text. */
  menuLabel?: string;
};

export type DataTableFilter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  /** The row's value(s) for this filter. */
  value: (row: T) => string | string[] | null | undefined;
  /** Adds a search box inside the popover, for long option lists. */
  searchable?: boolean;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Everything search should look at. Omit to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  /** Filters selected on arrival, for a screen that is really a queue. */
  initialFilters?: TableFilterState;
  /** Persists hidden columns under this key. Omit to keep them per-mount. */
  columnStorageKey?: string;
  /** false removes the View menu even when columns are hideable. */
  columnVisibility?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  /** false shows every row, for short lists like the team table. */
  pagination?: boolean;
  initialSort?: TableSort;
  loading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * The section heading above the card, e.g. "Registered Students". The
   * matching row count is appended, and it follows the search and filters, so
   * the heading always describes what is on screen rather than what was
   * fetched.
   */
  title?: React.ReactNode;
  /** Suppresses the count beside the title, for a list that is always whole. */
  showCount?: boolean;
  /** Buttons for the heading row, right-aligned: export, download, add. */
  actions?: React.ReactNode;
  /** Page-specific controls that belong beside the search box. */
  toolbarExtras?: React.ReactNode;
  /** A column pinned before the first one, for bulk-select checkboxes. */
  leadingColumn?: {
    header: React.ReactNode;
    cell: (row: T) => React.ReactNode;
    width?: string;
    sticky?: boolean;
  };
  rowClassName?: (row: T) => string | undefined;
  /** Narrower than this and the table scrolls sideways instead of squeezing. */
  minWidth?: number;
  caption?: string;
  /**
   * Reports what the viewer is currently looking at, for the few things the
   * table cannot own: a heading count, a server-side export that has to honour
   * the same filters, and a select-all that applies to the visible page.
   */
  onViewChange?: (view: DataTableView<T>) => void;
};

export type DataTableView<T> = {
  query: string;
  filters: TableFilterState;
  sort: TableSort | null;
  /** Rows on the current page, in display order. */
  rows: T[];
  /** Rows left after search and filters, across all pages. */
  filteredCount: number;
  page: number;
  pageCount: number;
};

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

const LEADING_COLUMN_ID = "__leading";

/**
 * The run of columns pinned to the left edge.
 *
 * Only a leading run can pin: a pinned column in the middle of scrolling ones
 * would cover them. The run stops at the first column that is not sticky.
 */
function stickyRun<T>(
  columns: DataTableColumn<T>[],
  leading: DataTableProps<T>["leadingColumn"],
): string[] {
  const ids: string[] = [];
  if (leading) {
    if (!leading.sticky) return ids;
    ids.push(LEADING_COLUMN_ID);
  }
  for (const column of columns) {
    if (!column.sticky) break;
    ids.push(column.id);
  }
  return ids;
}

/**
 * Where each pinned column sits, measured rather than derived.
 *
 * A column's declared `width` is a minimum that padding and content routinely
 * exceed, so accumulating the declared values puts every column after the
 * first at too small an offset and they overlap. Reading the rendered header
 * widths is the only honest source. Widths are used, not positions, because a
 * sticky cell's own offset already includes the shift being measured.
 */
function useStickyOffsets(
  stickyIds: string[],
  deps: readonly unknown[],
): [Record<string, number>, React.RefObject<HTMLTableElement | null>] {
  const tableRef = useRef<HTMLTableElement>(null);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const key = stickyIds.join("|");

  useEffect(() => {
    const table = tableRef.current;
    if (!table || !key) {
      setOffsets((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    function measure() {
      const next: Record<string, number> = {};
      let cursor = 0;
      for (const id of key.split("|")) {
        const cell = table!.querySelector<HTMLElement>(`thead [data-column-id="${id}"]`);
        if (!cell) break;
        next[id] = cursor;
        cursor += cell.getBoundingClientRect().width;
      }
      setOffsets((current) => {
        const ids = Object.keys(next);
        const same =
          ids.length === Object.keys(current).length &&
          ids.every((id) => Math.abs((current[id] ?? -1) - next[id]) < 0.5);
        return same ? current : next;
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  return [offsets, tableRef];
}

const COLUMN_PREFERENCE_EVENT = "tnp:table-columns";

function preferenceKey(storageKey: string) {
  return `tnp.table.${storageKey}.hidden`;
}

function subscribeToColumnPreference(onChange: () => void) {
  window.addEventListener(COLUMN_PREFERENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLUMN_PREFERENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Which columns this viewer has hidden.
 *
 * Read through an external store rather than an effect, the way the theme is,
 * so the server and the first client paint agree and a saved preference does
 * not arrive as a second render.
 */
function useHiddenColumns(
  storageKey: string | undefined,
  defaults: string[],
): [string[], (id: string) => void] {
  const [local, setLocal] = useState(defaults);

  const stored = useSyncExternalStore(
    subscribeToColumnPreference,
    () => (storageKey ? window.localStorage.getItem(preferenceKey(storageKey)) : null),
    () => null,
  );

  const hidden = useMemo(() => {
    if (!storageKey) return local;
    if (stored === null) return defaults;
    try {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : defaults;
    } catch {
      // A corrupt preference is not worth failing a page over.
      return defaults;
    }
  }, [storageKey, stored, local, defaults]);

  const toggle = useCallback(
    (id: string) => {
      const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];

      if (!storageKey) {
        setLocal(next);
        return;
      }

      try {
        window.localStorage.setItem(preferenceKey(storageKey), JSON.stringify(next));
      } catch {
        // Private browsing and full quotas both land here; the table still works.
      }
      window.dispatchEvent(new Event(COLUMN_PREFERENCE_EVENT));
    },
    [hidden, storageKey],
  );

  return [hidden, toggle];
}

/** Closes a popover on an outside pointer press or Escape. */
function useDismiss(active: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, onDismiss]);

  return ref;
}

function FilterMenu<T>({
  filter,
  selected,
  onChange,
}: {
  filter: DataTableFilter<T>;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  const menuId = useId();

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? filter.options.filter((option) => option.label.toLowerCase().includes(term))
      : filter.options;
  }, [filter.options, query]);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="dt-menu" ref={ref}>
      <button
        type="button"
        className={selected.length ? "dt-filter-button active" : "dt-filter-button"}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus />
        {filter.label}
        {selected.length ? <b>{selected.length}</b> : null}
      </button>

      {open ? (
        <div className="dt-popover" id={menuId} role="group" aria-label={filter.label}>
          {filter.searchable !== false ? (
            <label className="dt-popover-search">
              <Search />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${filter.label.toLowerCase()}...`}
                aria-label={`Search ${filter.label} options`}
              />
            </label>
          ) : null}

          <div className="dt-popover-list">
            {options.map((option) => (
              <label key={option.value} className="dt-check">
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
            {!options.length ? <p className="dt-popover-empty">No options match.</p> : null}
          </div>

          {selected.length ? (
            <button type="button" className="dt-popover-clear" onClick={() => onChange([])}>
              Clear {filter.label.toLowerCase()}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rows-per-page control, styled like every other picker on the table rather
 * than left as a native `<select>`. A native select's popup is drawn by the
 * OS, not the page — on macOS it renders with the system's own highlight
 * colour, which fights this table's own dropdowns instead of matching them.
 * It opens upward: this control always sits at the bottom of the card, so a
 * downward popover would usually run past the viewport.
 */
function RowsPerPageMenu({
  value,
  options,
  onChange,
  id,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  const menuId = useId();

  return (
    <div className="dt-menu" ref={ref}>
      <label htmlFor={id}>Rows per page</label>
      <button
        type="button"
        id={id}
        className="dt-rows-button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {value}
        <ChevronDown />
      </button>

      {open ? (
        <div
          className="dt-popover align-top align-end"
          id={menuId}
          role="listbox"
          aria-label="Rows per page"
        >
          <div className="dt-popover-list">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={option === value ? "dt-option active" : "dt-option"}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
                {option === value ? <Check /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnMenu({
  columns,
  hidden,
  onToggle,
}: {
  columns: { id: string; label: string }[];
  hidden: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  const menuId = useId();
  const visibleCount = columns.length - hidden.length;

  return (
    <div className="dt-menu" ref={ref}>
      <button
        type="button"
        className="dt-view-button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 />
        View
      </button>

      {open ? (
        <div className="dt-popover align-end" id={menuId} role="group" aria-label="Toggle columns">
          <p className="dt-popover-title">Toggle columns</p>
          <div className="dt-popover-list">
            {columns.map((column) => {
              const isVisible = !hidden.includes(column.id);
              // One column has to stay, otherwise the table is a blank box.
              const isLastVisible = isVisible && visibleCount === 1;
              return (
                <label key={column.id} className="dt-check">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={isLastVisible}
                    onChange={() => onToggle(column.id)}
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The one table used across the admin portal.
 *
 * It owns presentation and the search/filter/sort/paginate pipeline, and
 * nothing about any page: what a cell contains, what an action does, and
 * where the data came from all stay with the caller.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = "Search...",
  filters = [],
  initialFilters,
  columnStorageKey,
  columnVisibility = true,
  pageSize: initialPageSize = 20,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  pagination = true,
  initialSort,
  loading = false,
  emptyIcon,
  emptyTitle = "No results found",
  emptyDescription = "Try changing your search or filters.",
  title,
  showCount = true,
  actions,
  toolbarExtras,
  leadingColumn,
  rowClassName,
  minWidth,
  caption,
  onViewChange,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState<TableFilterState>(initialFilters ?? {});
  const [sort, setSort] = useState<TableSort | null>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const defaultHidden = useMemo(
    () => columns.filter((column) => column.defaultHidden).map((column) => column.id),
    [columns],
  );
  const [hiddenColumns, toggleColumn] = useHiddenColumns(columnStorageKey, defaultHidden);

  const hideableColumns = useMemo(
    () =>
      columns
        .filter((column) => column.hideable !== false)
        .map((column) => ({
          id: column.id,
          label:
            column.menuLabel ?? (typeof column.header === "string" ? column.header : column.id),
        })),
    [columns],
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumns.includes(column.id)),
    [columns, hiddenColumns],
  );

  const activeFilterCount = Object.values(filterState).reduce(
    (total, values) => total + values.length,
    0,
  );

  const sortValue = useCallback(
    (row: T, columnId: string) => columns.find((column) => column.id === columnId)?.sortValue?.(row),
    [columns],
  );

  const result = useMemo(
    () =>
      applyTablePipeline({
        rows: data,
        query,
        searchText,
        filters,
        filterState,
        sort,
        sortValue,
        page,
        pageSize: pagination ? pageSize : 0,
      }),
    // `filters` is rebuilt by the caller on each render; its ids and options
    // are what matter, and they are stable for a given data set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, query, searchText, filterState, sort, sortValue, page, pageSize, pagination],
  );

  // Held in a ref so a caller passing an inline arrow cannot turn this into a
  // render loop.
  const viewListener = useRef(onViewChange);
  useEffect(() => {
    viewListener.current = onViewChange;
  }, [onViewChange]);

  // Callers write `searchText` inline, so the pipeline above is rebuilt on
  // every render and `result` is a new object each time. A caller that sets
  // state from this callback therefore re-renders us, producing another new
  // object, which would notify again and never settle. So the guard compares
  // what the view contains rather than the object containing it, and a render
  // that changed nothing notifies nobody.
  const notifiedView = useRef<DataTableView<T> | null>(null);
  useEffect(() => {
    const view: DataTableView<T> = {
      query,
      filters: filterState,
      sort,
      rows: result.rows,
      filteredCount: result.filteredCount,
      page: result.page,
      pageCount: result.pageCount,
    };
    if (sameTableView(notifiedView.current, view)) return;
    notifiedView.current = view;
    viewListener.current?.(view);
  }, [query, filterState, sort, result]);

  const columnCount = visibleColumns.length + (leadingColumn ? 1 : 0);
  const showToolbar = Boolean(searchText || filters.length || toolbarExtras ||
    (columnVisibility && hideableColumns.length > 1));

  // Recomputed from the visible set, so hiding a pinned column re-pins the
  // ones behind it rather than leaving a gap at the left edge.
  const stickyIds = useMemo(
    () => stickyRun(visibleColumns, leadingColumn),
    [visibleColumns, leadingColumn],
  );
  const [stickyLeft, tableRef] = useStickyOffsets(stickyIds, [pageSize, result.rows.length]);

  function pinned(columnId: string) {
    const left = stickyLeft[columnId];
    return { className: left === undefined ? undefined : "dt-sticky", left };
  }
  const leadingPin = pinned(LEADING_COLUMN_ID);

  return (
    <div className="data-table">
      {title || actions ? (
        <div className="dt-header">
          {title ? (
            <h2 className="dt-title">
              {title}
              {showCount ? <span>({result.filteredCount})</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {actions ? <div className="dt-actions">{actions}</div> : null}
        </div>
      ) : null}

      <div className="dt-card">
      {showToolbar ? (
        <div className="dt-toolbar">
          {searchText ? (
            <label className="dt-search">
              <Search />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  // A narrower result set has fewer pages than the one being
                  // viewed, so searching returns to the first page.
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </label>
          ) : null}

          {filters.map((filter) => (
            <FilterMenu
              key={filter.id}
              filter={filter}
              selected={filterState[filter.id] ?? []}
              onChange={(values) => {
                setFilterState((previous) => ({ ...previous, [filter.id]: values }));
                setPage(1);
              }}
            />
          ))}

          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="dt-reset"
              onClick={() => {
                setFilterState({});
                setPage(1);
              }}
            >
              Reset
            </button>
          ) : null}

          {toolbarExtras}

          <div className="dt-toolbar-end">
            {columnVisibility && hideableColumns.length > 1 ? (
              <ColumnMenu
                columns={hideableColumns}
                hidden={hiddenColumns}
                onToggle={toggleColumn}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="dt-scroll">
        <table
          className="dt-table"
          ref={tableRef}
          style={minWidth ? { minWidth } : undefined}
        >
          {caption ? <caption className="dt-caption">{caption}</caption> : null}
          <thead>
            <tr>
              {leadingColumn ? (
                <th
                  scope="col"
                  data-column-id={LEADING_COLUMN_ID}
                  className={leadingPin.className}
                  style={{ width: leadingColumn.width ?? "44px", left: leadingPin.left }}
                >
                  {leadingColumn.header}
                </th>
              ) : null}

              {visibleColumns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                const ariaSort = !column.sortValue
                  ? undefined
                  : isSorted
                    ? sort!.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                const pin = pinned(column.id);

                return (
                  <th
                    key={column.id}
                    scope="col"
                    data-column-id={column.id}
                    aria-sort={ariaSort}
                    className={pin.className}
                    style={{ width: column.width, textAlign: column.align, left: pin.left }}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={isSorted ? "dt-sort active" : "dt-sort"}
                        onClick={() => setSort((current) => nextSortState(current, column.id))}
                        title={`Sort by ${
                          column.menuLabel ??
                          (typeof column.header === "string" ? column.header : column.id)
                        }`}
                      >
                        <span>{column.header}</span>
                        {isSorted ? (
                          <ChevronDown className={sort!.direction === "asc" ? "flip" : undefined} />
                        ) : (
                          <ChevronsUpDown />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // Skeletons keep the table the same height it will be, so the
              // page does not jump when the rows arrive.
              Array.from({ length: 5 }, (_, index) => (
                <tr key={`skeleton-${index}`} className="dt-skeleton-row">
                  {Array.from({ length: columnCount }, (_, cellIndex) => (
                    <td key={cellIndex}>
                      <span className="dt-skeleton" />
                    </td>
                  ))}
                </tr>
              ))
            ) : result.rows.length ? (
              result.rows.map((row) => (
                <tr key={getRowId(row)} className={rowClassName?.(row)}>
                  {leadingColumn ? (
                    <td className={leadingPin.className} style={{ left: leadingPin.left }}>
                      {leadingColumn.cell(row)}
                    </td>
                  ) : null}
                  {visibleColumns.map((column) => {
                    const pin = pinned(column.id);
                    return (
                      <td
                        key={column.id}
                        className={pin.className}
                        style={{ textAlign: column.align, left: pin.left }}
                      >
                        {column.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(1, columnCount)}>
                  <div className="admin-empty">
                    {emptyIcon ?? <Inbox />}
                    <h2>{emptyTitle}</h2>
                    <p>{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading ? (
        <div className="dt-pagination">
          <div className="dt-rows-per-page">
            <RowsPerPageMenu
              id={`${caption ?? "table"}-page-size`}
              value={pageSize}
              options={pageSizeOptions}
              onChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </div>

          <span className="dt-page-label">
            Page {result.page} of {result.pageCount}
            <small>
              {result.filteredCount} {result.filteredCount === 1 ? "row" : "rows"}
              {result.filteredCount !== data.length ? ` of ${data.length}` : ""}
            </small>
          </span>

          <div className="dt-page-buttons">
            <button
              type="button"
              aria-label="First page"
              title="First page"
              disabled={result.page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronFirst />
            </button>
            <button
              type="button"
              aria-label="Previous page"
              title="Previous page"
              disabled={result.page <= 1}
              onClick={() => setPage(Math.max(1, result.page - 1))}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              aria-label="Next page"
              title="Next page"
              disabled={result.page >= result.pageCount}
              onClick={() => setPage(Math.min(result.pageCount, result.page + 1))}
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              aria-label="Last page"
              title="Last page"
              disabled={result.page >= result.pageCount}
              onClick={() => setPage(result.pageCount)}
            >
              <ChevronLast />
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
