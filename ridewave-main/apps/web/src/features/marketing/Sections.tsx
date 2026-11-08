import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import type { Step } from './content';

export function SectionHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {intro && <p className="mt-3 text-lg text-navy-900/75">{intro}</p>}
    </div>
  );
}

export function PageHero({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <section className="bg-navy-900 text-ink">
      <div className="container-page py-16 sm:py-20">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">{intro}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title}>
          <Card className="h-full">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 font-bold text-accent" aria-hidden>{i + 1}</span>
              <s.icon aria-hidden className="h-6 w-6 text-navy-900/70" />
            </div>
            <h3 className="mt-4 text-lg font-bold"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
            <p className="mt-2 text-navy-900/75">{s.text}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3"><Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" /><span>{t}</span></li>
      ))}
    </ul>
  );
}

export function FinalCta({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="bg-navy-900 text-ink">
      <div className="container-page section text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </section>
  );
}
