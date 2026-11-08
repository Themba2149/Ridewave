import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PlaceField } from '../../components/booking/PlaceField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAddSavedLocation, useDeleteSavedLocation, useSavedLocations } from '../rides/api';
import type { PlaceValue, SavedLocation } from '../rides/types';

export function SavedPlacesPage() {
  useDocumentTitle('Saved places');
  const { data, isLoading, error } = useSavedLocations();
  const add = useAddSavedLocation();
  const remove = useDeleteSavedLocation();
  const [label, setLabel] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<SavedLocation | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setFormError('Give the place a name, e.g. Home.');
    if (!place) return setFormError('Choose a location.');
    setFormError('');
    add.mutate({ label: label.trim(), ...place, isFavorite: favorite }, { onSuccess: () => { setLabel(''); setPlace(null); setFavorite(false); } });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Saved places</h1>
      <Card>
        <h2 className="text-lg font-bold">Add a place</h2>
        <form noValidate onSubmit={submit} className="mt-3 space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          {add.isError && <Alert tone="error">{add.error.message}</Alert>}
          <div>
            <label htmlFor="place-label" className="text-sm font-medium">Name</label>
            <input id="place-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={50} placeholder="Home, Work, Gym…" className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3.5" />
          </div>
          <PlaceField label="Location" value={place} onChange={setPlace} saved={[]} />
          <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-5 w-5" /> Mark as favourite</label>
          <Button type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Save place'}</Button>
        </form>
      </Card>

      {isLoading && <Skeleton className="h-32" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && data.length === 0 && <p className="text-navy-900/75">You have no saved places yet.</p>}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl2 border border-navy-900/10 bg-white p-4 shadow-card">
              <div><p className="flex items-center gap-2 font-semibold">{s.isFavorite && <Star aria-label="Favourite" className="h-4 w-4 text-warning" />}{s.label}</p><p className="text-sm text-navy-900/75">{s.address}</p></div>
              <button type="button" onClick={() => setToDelete(s)} aria-label={`Delete ${s.label}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-danger hover:bg-danger/10"><Trash2 aria-hidden className="h-5 w-5" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!toDelete} title="Delete this place?" confirmLabel="Delete" cancelLabel="Keep it" pending={remove.isPending}
        onCancel={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}>
        <p>{toDelete?.label} will be removed from your saved places.</p>
      </ConfirmDialog>
    </div>
  );
}
