import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import type { DriverDocument } from '../admin/types';

export const DOC_TYPES: Array<[string, string]> = [['DRIVERS_LICENCE', 'Driver’s licence'], ['ID_DOCUMENT', 'ID document'], ['PROOF_OF_ADDRESS', 'Proof of address'], ['VEHICLE_REGISTRATION', 'Vehicle registration'], ['VEHICLE_INSURANCE', 'Vehicle insurance'], ['PROFILE_PHOTO', 'Profile photo']];
export const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = /\.(pdf|png|jpe?g)$/i;
const tone = (s: string) => (s === 'ACCEPTED' ? 'success' : s === 'REJECTED' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral';

/** Browser-side checks are a convenience only. The server re-checks size and the real file type. */
export function validateFile(file: File | undefined): string {
  if (!file) return 'Choose a file to upload.';
  if (!ALLOWED.test(file.name)) return 'Only PDF, PNG or JPEG files are accepted.';
  if (file.size > MAX_BYTES) return 'That file is larger than 5 MB.';
  if (file.size === 0) return 'That file is empty.';
  return '';
}

export function DriverDocumentsPage() {
  useDocumentTitle('Documents');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['driver-documents'], queryFn: async () => (await apiFetch<{ items: DriverDocument[] }>('/drivers/me/documents')).items });
  const [type, setType] = useState('DRIVERS_LICENCE');
  const [problem, setProblem] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (form: FormData) => apiFetch('/drivers/me/documents', { method: 'POST', body: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-documents'] }); if (fileRef.current) fileRef.current.value = ''; },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    const msg = validateFile(file);
    setProblem(msg);
    if (msg || !file) return;
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    upload.mutate(form);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Documents</h1>
      <Alert tone="info">Your files are stored privately and can be opened only by you and RideWave administrators. In this demonstration an administrator reviews them by hand; nothing is verified automatically.</Alert>
      <Card>
        <h2 className="text-lg font-bold">Upload a document</h2>
        <form noValidate onSubmit={submit} className="mt-3 space-y-4">
          {upload.isError && <Alert tone="error">{upload.error.message}</Alert>}
          {upload.isSuccess && <Alert tone="success">Uploaded. An administrator will review it.</Alert>}
          <div>
            <label htmlFor="doc-type" className="text-sm font-medium">Document type</label>
            <select id="doc-type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3">{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div>
            <label htmlFor="doc-file" className="text-sm font-medium">File (PDF, PNG or JPEG, up to 5 MB)</label>
            <input id="doc-file" ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" aria-invalid={!!problem} className="mt-1 block w-full text-sm" onChange={() => setProblem('')} />
            {problem && <p role="alert" className="mt-1 text-sm text-danger">{problem}</p>}
          </div>
          <Button type="submit" disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload'}</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Your documents</h2>
        {list.isLoading && <Skeleton className="mt-3 h-24" />}
        {list.error && <div className="mt-3"><Alert tone="error">{list.error.message}</Alert></div>}
        {list.data && list.data.length === 0 && <p className="mt-2 text-navy-900/75">You have not uploaded anything yet.</p>}
        <ul className="mt-2 divide-y divide-navy-900/10">
          {list.data?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-medium">{DOC_TYPES.find(([v]) => v === d.type)?.[1] ?? d.type} <Badge tone={tone(d.status)}>{d.status}</Badge></p>
                <p className="text-xs text-navy-900/70">{d.originalName} · {formatDateTime(d.createdAt)}</p>{d.reviewNote && <p className="text-xs">Reviewer note: {d.reviewNote}</p>}</div>
              <a className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-900/25 px-3 text-sm font-semibold hover:bg-navy-900/5" href={`/api/v1/drivers/me/documents/${d.id}/download`}>Download<span className="sr-only"> {d.originalName}</span></a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
