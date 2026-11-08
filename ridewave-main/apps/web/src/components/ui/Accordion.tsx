import { ChevronDown } from 'lucide-react';

export type AccordionItem = { question: string; answer: string };

/** Native <details> gives keyboard and screen-reader behaviour for free. */
export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <div className="divide-y divide-navy-900/10 rounded-xl2 border border-navy-900/10 bg-surface shadow-card">
      {items.map((item) => (
        <details key={item.question} className="group p-5">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-navy-900/80">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
