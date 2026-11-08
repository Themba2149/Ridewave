import { MapPin, Star } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { usePlaceSearch } from '../../features/rides/api';
import type { PlaceValue, SavedLocation } from '../../features/rides/types';

type Option = { key: string; title: string; subtitle?: string; saved?: boolean; place: PlaceValue };
type Props = { label: string; value: PlaceValue | null; onChange: (p: PlaceValue | null) => void; saved?: SavedLocation[]; error?: string };

/** Place picker (combobox). In development it searches a fixed list of sample Johannesburg places. */
export function PlaceField({ label, value, onChange, saved = [], error }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDebounced(text), 200); return () => clearTimeout(t); }, [text]);
  const { data } = usePlaceSearch(debounced);

  const q = text.trim().toLowerCase();
  const savedOptions: Option[] = saved
    .filter((s) => !q || s.label.toLowerCase().includes(q) || s.address.toLowerCase().includes(q))
    .map((s) => ({ key: `s-${s.id}`, title: s.label, subtitle: s.address, saved: true, place: { address: s.address, lat: s.lat, lng: s.lng } }));
  const found: Option[] = (data?.places ?? [])
    .filter((p) => !savedOptions.some((s) => s.place.address === p.address))
    .map((p) => ({ key: p.id, title: p.name, subtitle: p.address, place: { address: p.address, lat: p.lat, lng: p.lng } }));
  const options = [...savedOptions, ...found];

  const choose = (o: Option) => { onChange(o.place); setText(''); setOpen(false); };

  if (value) {
    return (
      <div>
        <span className="text-sm font-medium">{label}</span>
        <div className="mt-1 flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-navy-900/25 bg-white px-3.5 py-2">
          <span className="flex items-center gap-2"><MapPin aria-hidden className="h-4 w-4 shrink-0" /><span>{value.address}</span></span>
          <button type="button" className="shrink-0 text-sm font-semibold underline" onClick={() => onChange(null)} aria-label={`Change ${label.toLowerCase()}`}>Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-invalid={!!error}
        aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off" value={text} placeholder="Search a place, e.g. Sandton"
        className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3.5 py-2.5 aria-[invalid=true]:border-danger"
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, options.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]!); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-navy-900/15 bg-white shadow-card">
          {options.length === 0 && <li className="px-3.5 py-3 text-sm text-slate-600">No sample places match. Try another name.</li>}
          {options.map((o, i) => (
            <li key={o.key} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              className={`cursor-pointer px-3.5 py-2.5 ${i === active ? 'bg-accent/25' : 'hover:bg-navy-900/5'}`}>
              <span className="flex items-center gap-2 font-medium">{o.saved && <Star aria-label="Saved place" className="h-4 w-4 text-warning" />}{o.title}</span>
              {o.subtitle && <span className="block text-xs text-slate-600">{o.subtitle}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      <p className="mt-1 text-xs text-slate-600">Development map: choose from sample Johannesburg places.</p>
    </div>
  );
}
