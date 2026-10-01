import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
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
  const [docType, setDocType] = useState<EmployeeDocumentType>('education');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<EmployeeDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDocs(await listEmployeeDocuments(employeeId));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const invalid = validateUpload(f, DOCUMENT_MIME_TYPES);
    if (invalid) { toast.error(invalid); return; }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Choose a file to upload'); return; }
    setUploading(true);
    const { error } = await uploadEmployeeDocument(employeeId, file, docType, title);
    setUploading(false);
    if (error) { toast.error(error); return; }
    toast.success('Document uploaded');
    setFile(null);
    setTitle('');
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
            <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-3">
              <div className="space-y-1.5">
                <Label>Document type</Label>
                <Select value={docType} onValueChange={v => setDocType(v as EmployeeDocumentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOCUMENT_TYPE_LABELS) as EmployeeDocumentType[]).map(t => (
                      <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="doc-title">Title</Label>
                <Input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. BSc Degree Certificate" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                <FileText size={14} /> {file ? 'Choose another file' : 'Choose file'}
              </Button>
              <span className="text-sm text-muted-foreground truncate max-w-full">
                {file ? `${file.name} · ${formatSize(file.size)}` : 'PDF, Word or image, up to 10 MB'}
              </span>
              <Button type="button" size="sm" className="sm:ml-auto" onClick={handleUpload} disabled={!file || uploading}>
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
              </Button>
              <input
                ref={inputRef} type="file" accept={DOCUMENT_MIME_TYPES.join(',')} className="hidden"
                onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
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
