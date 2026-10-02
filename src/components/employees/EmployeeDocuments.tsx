import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DOCUMENT_MIME_TYPES, deleteEmployeeDocument, getEmployeeFileUrls, listEmployeeDocuments,
  uploadEmployeeDocument, validateUpload,
} from '@/db/api';
import { DOCUMENT_TYPE_LABELS } from '@/types/types';
import type { EmployeeDocument, EmployeeDocumentType } from '@/types/types';

const formatSize = (bytes: number | null) => {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

// One pending upload row (like the allowance rows on the salary form)
interface UploadRow { key: string; docType: EmployeeDocumentType; title: string; file: File | null }
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');
const newRow = (file: File | null = null, docType: EmployeeDocumentType = 'education'): UploadRow => ({
  key: crypto.randomUUID(), docType, file, title: file ? stripExt(file.name) : '',
});

interface Props {
  employeeId: string;
  /** Employees manage their own documents; Admin/HR manage everyone's */
  canEdit: boolean;
  description?: string;
}

/** Educational certificates, service letters and other documents for one employee */
const EmployeeDocuments: React.FC<Props> = ({ employeeId, canEdit, description }) => {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<EmployeeDocument | null>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);
  const rowInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setDocs(await listEmployeeDocuments(employeeId));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const updateRow = (key: string, patch: Partial<UploadRow>) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows(rs => rs.filter(r => r.key !== key));

  // Accept only allowed files; report the rest
  const acceptFiles = (files: FileList | null): File[] => {
    const ok: File[] = [];
    for (const f of Array.from(files ?? [])) {
      const invalid = validateUpload(f, DOCUMENT_MIME_TYPES);
      if (invalid) toast.error(`${f.name}: ${invalid}`); else ok.push(f);
    }
    return ok;
  };

  // "Choose files": one new row per selected file (empty rows are replaced)
  const addFiles = (files: FileList | null) => {
    const ok = acceptFiles(files);
    if (ok.length) setRows(rs => [...rs.filter(r => r.file || r.title.trim()), ...ok.map(f => newRow(f))]);
  };

  const pickForRow = (key: string, files: FileList | null) => {
    const [f] = acceptFiles(files);
    if (!f) return;
    setRows(rs => rs.map(r => (r.key === key ? { ...r, file: f, title: r.title.trim() ? r.title : stripExt(f.name) } : r)));
  };

  const readyRows = rows.filter(r => r.file);

  // Upload every row that has a file; failed rows stay so they can be retried
  const handleUploadAll = async () => {
    if (!readyRows.length) { toast.error('Choose at least one file to upload'); return; }
    setUploading(true);
    const failed = new Set<string>();
    let done = 0;
    for (const r of readyRows) {
      const { error } = await uploadEmployeeDocument(employeeId, r.file as File, r.docType, r.title);
      if (error) { failed.add(r.key); toast.error(`${(r.file as File).name}: ${error}`); } else done += 1;
    }
    setUploading(false);
    setRows(rs => rs.filter(r => !r.file || failed.has(r.key)));
    if (done) toast.success(`${done} document${done === 1 ? '' : 's'} uploaded`);
    load();
  };

  const open = async (doc: EmployeeDocument) => {
    // Open the tab synchronously (inside the click) so pop-up blockers allow it, then point it at the file
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    const urls = await getEmployeeFileUrls([doc.file_path], 300);
    const url = urls[doc.file_path];
    if (!url) { tab?.close(); toast.error('Could not open this document'); return; }
    if (tab) tab.location.href = url; else window.location.assign(url);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await deleteEmployeeDocument(toDelete);
    if (error) { toast.error(error); return; }
    toast.success('Document removed');
    setToDelete(null);
    load();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip size={16} className="text-primary" /> Documents
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {description ?? 'Educational certificates, service letters and other supporting documents.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Upload documents</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => multiInputRef.current?.click()} disabled={uploading}>
                  <FileText size={13} /> Choose files
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRows(rs => [...rs, newRow()])} disabled={uploading}>
                  <Plus size={13} /> Add document
                </Button>
              </div>
              <input
                ref={multiInputRef} type="file" multiple accept={DOCUMENT_MIME_TYPES.join(',')} className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Use "Choose files" to pick several files at once, or "Add document" to add them one by one. PDF, Word or image, up to 10 MB each.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.key} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end rounded-lg border border-border bg-card p-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={r.docType} onValueChange={v => updateRow(r.key, { docType: v as EmployeeDocumentType })} disabled={uploading}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DOCUMENT_TYPE_LABELS) as EmployeeDocumentType[]).map(t => (
                            <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs" htmlFor={`title-${r.key}`}>Title</Label>
                      <Input id={`title-${r.key}`} className="h-9" value={r.title} onChange={e => updateRow(r.key, { title: e.target.value })}
                        placeholder="e.g. BSc Degree Certificate" disabled={uploading} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">File</Label>
                      <Button type="button" variant="outline" className="h-9 w-full justify-start font-normal" disabled={uploading}
                        onClick={() => rowInputs.current[r.key]?.click()}>
                        <FileText size={14} className="shrink-0" />
                        <span className="truncate">{r.file ? `${r.file.name} · ${formatSize(r.file.size)}` : 'Choose file…'}</span>
                      </Button>
                      <input
                        ref={el => { rowInputs.current[r.key] = el; }} type="file" accept={DOCUMENT_MIME_TYPES.join(',')} className="hidden"
                        onChange={e => { pickForRow(r.key, e.target.files); e.target.value = ''; }}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" title="Remove row"
                      onClick={() => removeRow(r.key)} disabled={uploading}>
                      <X size={15} />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <Button type="button" size="sm" onClick={handleUploadAll} disabled={!readyRows.length || uploading}>
                    <Upload size={14} />
                    {uploading ? 'Uploading…' : `Upload ${readyRows.length} document${readyRows.length === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="h-16 rounded-lg bg-muted animate-pulse" />
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {docs.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {DOCUMENT_TYPE_LABELS[d.doc_type]} · {d.file_name}{d.size_bytes ? ` · ${formatSize(d.size_bytes)}` : ''} · {new Date(d.created_at).toLocaleDateString('en-LK')}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Open" onClick={() => open(d)}>
                  <Download size={15} />
                </Button>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remove" onClick={() => setToDelete(d)}>
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={toDelete !== null} onOpenChange={o => { if (!o) setToDelete(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toDelete?.title}</strong> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default EmployeeDocuments;
