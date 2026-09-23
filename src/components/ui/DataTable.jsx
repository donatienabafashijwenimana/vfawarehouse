import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { SearchInput, Pagination, EmptyState, Spinner } from './primitives';

/**
 * Reusable DataTable (spec §33): search, filter slots, sorting, pagination,
 * loading and empty states. Columns: [{ key, label, render?, sortable?, className? }]
 */
export function DataTable({
  columns,
  rows,
  loading = false,
  searchable = true,
  searchKeys,
  searchPlaceholder = 'Search…',
  filters,
  toolbarExtra,
  pageSize = 10,
  emptyHint,
  emptyAction,
  rowKey = (r) => r.id,
  onRowClick,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null); // { key, dir }
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let out = rows;
    if (query && searchable) {
      const q = query.toLowerCase();
      const keys = searchKeys ?? columns.map((c) => c.key);
      out = out.filter((r) =>
        keys.some((k) => {
          const v = typeof k === 'function' ? k(r) : r[k];
          return String(v ?? '').toLowerCase().includes(q);
        })
      );
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av == null) return 1;
        if (bv == null) return -1;
        const an = Number(av);
        const bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
          return sort.dir === 'asc' ? an - bn : bn - an;
        }
        return sort.dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return out;
  }, [rows, query, sort, columns, searchKeys, searchable]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key) {
    setSort((s) =>
      s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {(searchable || filters || toolbarExtra) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          {searchable && (
            <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder={searchPlaceholder} className="w-full sm:w-64" />
          )}
          {filters}
          <div className="ml-auto flex items-center gap-2">{toolbarExtra}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : paged.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No records found" hint={query ? 'Try a different search term or clear filters.' : emptyHint} action={emptyAction} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 font-semibold ${col.className ?? ''}`}>
                    {col.sortable === false ? (
                      col.label
                    ) : (
                      <button className="flex items-center gap-1 hover:text-gray-700" onClick={() => toggleSort(col.key)}>
                        {col.label}
                        {sort?.key === col.key ? (
                          sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-gray-50 last:border-0 hover:bg-green-50/40 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
