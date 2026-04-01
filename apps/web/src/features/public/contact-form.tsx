'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { Button, Input, Textarea } from '@study-assistant/ui';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email address.'),
  organization: z.string().min(2, 'Enter your organization or school.'),
  message: z.string().min(20, 'Tell us a bit more so the support team has enough context.'),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const { pushToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: '',
      email: '',
      organization: '',
      message: '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    pushToast({
      tone: 'info',
      title: 'Form validated locally',
      description: `Support request prepared for ${values.organization}. Backend submission wiring lands with the API phase.`,
    });
    reset();
  });

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-8 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Contact support</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this form for onboarding questions, support requests, and admin demos.
        </p>
      </div>
      <form className="grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
        <FormField label="Full name" error={errors.fullName?.message}>
          <Input {...register('fullName')} placeholder="Alex Rivera" />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="alex@example.com" />
        </FormField>
        <FormField label="Organization" error={errors.organization?.message}>
          <Input {...register('organization')} placeholder="Northfield Academy" />
        </FormField>
        <div />
        <div className="md:col-span-2">
          <FormField
            label="Message"
            description="Include the subject area, expected user count, and any deployment constraints."
            error={errors.message?.message}
          >
            <Textarea {...register('message')} placeholder="We need subject-aware retrieval for..." />
          </FormField>
        </div>
        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Client-side validation is active. Secure submission wiring lands with the route handlers.
          </p>
          <Button type="submit" disabled={isSubmitting}>
            Send Request
          </Button>
        </div>
      </form>
    </div>
  );
}
