import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { TextAreaField, TextField } from '../../components/forms/TextField';
import { Accordion } from '../../components/ui/Accordion';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';
import { contactSchema, type ContactValues } from '../../lib/validators';
import { faqs } from './content';
import { PageHero, SectionHeading } from './Sections';

export function ContactPage() {
  useDocumentTitle('Contact & Help');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });
  const send = useMutation({
    mutationFn: (v: ContactValues) => apiFetch<{ message: string }>('/support/contact', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => reset(),
  });

  return (
    <>
      <PageHero title="Contact and help" intro="Send us a message, or check the common questions below." />
      <section className="section"><div className="container-page grid gap-10 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-bold">Send a message</h2>
          <form noValidate onSubmit={handleSubmit((v) => send.mutate(v))} className="mt-5 space-y-4">
            {send.isSuccess && <Alert tone="success">{send.data.message}</Alert>}
            {send.isError && <Alert tone="error">{send.error.message}</Alert>}
            <TextField label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
            <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <TextField label="Subject" error={errors.subject?.message} {...register('subject')} />
            <TextAreaField label="Message" error={errors.message?.message} {...register('message')} />
            <Button type="submit" disabled={send.isPending} className="w-full">{send.isPending ? 'Sending…' : 'Send message'}</Button>
          </form>
        </Card>
        <div>
          <SectionHeading title="Help" intro="Support: support@ridewave.example (placeholder address; messages from this form are stored as support tickets)." />
          <div className="mt-6"><Accordion items={faqs} /></div>
        </div>
      </div></section>
    </>
  );
}
