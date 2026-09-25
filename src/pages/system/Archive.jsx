import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive as ArchiveIcon, Download, Eye, FilePlus2, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../../components/ui/KPICard';
import { Button, Input, Select, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../lib/format';
import { deleteSupabaseArchiveFile, getSupabaseArchiveContent, getSupabaseArchiveZip, listSupabaseArchiveFiles, supabaseArchiveEnabled, uploadSupabaseArchive } from '../../services/archiveApi';
import { zipFile } from '../../lib/zip';

const CATEGORIES = ['Policy & procedure', 'Manual & guide', 'Certificate', 'Agreement', 'Reference material', 'Other'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function listArchiveFiles() {
  if (!supabaseArchiveEnabled) return [];
  return listSupabaseArchiveFiles();
}

function readableSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function Archive() {
  const profile = useStore((state) => state.profile);
  const pushToast = useStore((state) => state.pushToast);
  const { can } = usePermissions();
  const canManage = can('archive.manage');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({ title: '', category: 'Other', description: '', file: null });
  const [formError, setFormError] = useState('');

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try { setFiles(await listArchiveFiles()); setLoadError(''); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const visibleFiles = useMemo(() => files.filter((file) => {
    const matchesCategory = !categoryFilter || file.category === categoryFilter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [file.title, file.fileName, file.category, file.description, file.createdBy].some((value) => String(value ?? '').toLowerCase().includes(term));
    return matchesCategory && matchesQuery;
  }), [files, categoryFilter, query]);

  function closeModal() {
    setModalOpen(false);
    setForm({ title: '', category: 'Other', description: '', file: null });
    setFormError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!canManage) return;
    if (!supabaseArchiveEnabled) { setFormError('File storage is unavailable. Please contact an administrator.'); return; }
    if (!form.file) { setFormError('Choose a file to archive.'); return; }
    if (form.file.size === 0) { setFormError('The selected file is empty.'); return; }
    if (form.file.size > MAX_FILE_SIZE) { setFormError('Files must be 25 MB or smaller.'); return; }
    const record = {
      id: newId(),
      title: form.title.trim() || form.file.name,
      category: form.category,
      description: form.description.trim(),
      fileName: form.file.name,
      mimeType: form.file.type || 'application/octet-stream',
      size: form.file.size,
      createdBy: profile?.fullName ?? 'User',
      createdAt: new Date().toISOString(),
    };
    try {
      const zip = await zipFile(form.file);
      await uploadSupabaseArchive({ file: form.file, zip, metadata: record });
      await refreshFiles();
      closeModal();
      pushToast('File added to the archive', 'success');
    } catch (error) { setFormError(error.message); }
  }

  async function openPreview(file) {
    try {
      const blob = await getSupabaseArchiveContent(file);
      setPreview({ ...file, url: URL.createObjectURL(blob) });
    } catch (error) { pushToast(error.message, 'error'); }
  }

  async function downloadFile(file) {
    try {
      const zip = await getSupabaseArchiveZip(file);
      const url = URL.createObjectURL(zip);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${file.title.replace(/[^\w.-]+/g, '_') || file.id}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { pushToast(error.message, 'error'); }
  }

  async function deleteFile(file) {
    if (!window.confirm(`Remove “${file.title}” from the archive?`)) return;
    try {
      await deleteSupabaseArchiveFile(file);
      if (preview?.id === file.id) setPreview(null);
      await refreshFiles();
      pushToast('File removed from the archive', 'success');
    } catch (error) { pushToast(error.message, 'error'); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Archive" subtitle="Store and find supporting files that are not managed as system records." actions={canManage && supabaseArchiveEnabled && <Button onClick={() => setModalOpen(true)}><FilePlus2 className="h-4 w-4" /> Add file</Button>} />
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <label className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input aria-label="Search archive" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search title, file, description…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select aria-label="Filter archive category" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
          <span className="ml-auto text-xs text-gray-500">{visibleFiles.length} file{visibleFiles.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? <p className="p-8 text-center text-sm text-gray-500">Loading archive…</p> : loadError ? <div className="p-8 text-center"><p role="alert" className="text-sm text-red-600">{loadError}</p><Button className="mt-3" variant="secondary" onClick={refreshFiles}>Try again</Button></div> : visibleFiles.length === 0 ? <div className="p-12 text-center"><ArchiveIcon className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm font-medium text-gray-600">{files.length ? 'No files match these filters.' : 'No archived files yet.'}</p></div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">{['File', 'Category', 'Description', 'Size', 'Added', 'Actions'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{visibleFiles.map((file) => <tr key={file.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-3"><div className="font-semibold text-gray-700">{file.title}</div><div className="max-w-56 truncate text-xs text-gray-400">{file.fileName}</div></td>
              <td className="px-4 py-3 text-gray-600">{file.category}</td><td className="max-w-xs px-4 py-3 text-gray-500">{file.description || '—'}</td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{readableSize(file.size)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-500"><div>{formatDate(file.createdAt)}</div><div className="text-xs">{file.createdBy}</div></td>
              <td className="px-4 py-3"><div className="flex items-center gap-1"><Button size="sm" variant="secondary" onClick={() => openPreview(file)} title="View file"><Eye className="h-3.5 w-3.5" /><span className="sr-only">View</span></Button><Button size="sm" variant="secondary" onClick={() => downloadFile(file)} title="Download file"><Download className="h-3.5 w-3.5" /><span className="sr-only">Download</span></Button>{canManage && <Button size="sm" variant="ghost" onClick={() => deleteFile(file)} title="Remove file"><Trash2 className="h-3.5 w-3.5 text-red-600" /><span className="sr-only">Remove</span></Button>}</div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={modalOpen} onClose={closeModal} title="Add file to archive">
        <form className="space-y-4" onSubmit={handleSave}>
          <Input label="Title (optional)" value={form.title} placeholder="Defaults to the file name" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          <Select label="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select>
          <Textarea label="Description (optional)" value={form.description} placeholder="What is this file for?" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <label className="block text-sm font-medium text-gray-700">File <span className="text-red-600">*</span> <span className="font-normal text-gray-400">(up to 25 MB)</span><input className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" type="file" required onChange={(event) => { setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null })); setFormError(''); }} /></label>
          {form.file && <p className="text-xs text-gray-500">Selected: {form.file.name} · {readableSize(form.file.size)}</p>}
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button><Button type="submit"><FilePlus2 className="h-4 w-4" /> Save file</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? 'View file'}>
        {preview && <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500"><span>{preview.fileName} · {readableSize(preview.size)}</span><Button size="sm" variant="secondary" onClick={() => downloadFile(preview)}><Download className="h-3.5 w-3.5" /> Download</Button></div>
          {preview.mimeType.startsWith('image/') ? <img className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain" src={preview.url} alt={preview.title} /> : preview.mimeType === 'application/pdf' ? <iframe className="h-[65vh] w-full rounded-lg border border-gray-200" src={preview.url} title={preview.title} /> : <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-600">Preview is not available for this file type. Download the file to open it.</div>}
          {preview.description && <p className="text-sm text-gray-600">{preview.description}</p>}
        </div>}
      </Modal>
    </div>
  );
}
