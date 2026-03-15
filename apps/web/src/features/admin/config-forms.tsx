'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';

const subjectSchema = z.object({
  name: z.string().min(2, 'Enter a subject name.'),
  courseCode: z.string().min(2, 'Enter a course code.'),
  keywords: z.string().min(3, 'Enter a few routing keywords.'),
  urlPatterns: z.string().min(3, 'Enter at least one URL pattern.'),
});

const categorySchema = z.object({
  name: z.string().min(2, 'Enter a category name.'),
  subject: z.string().min(2, 'Choose a subject.'),
  keywords: z.string().min(3, 'Enter default keywords.'),
  sortOrder: z.coerce.number().int().min(0),
});

const systemSettingsSchema = z.object({
  lowCreditThresholdSeconds: z.coerce.number().int().min(60),
  sessionIdleSeconds: z.coerce.number().int().min(60),
  liveModeDefault: z.enum(['disabled', 'confirm', 'enabled']),
  confidenceThresholds: z.string().min(5, 'Enter threshold values.'),
  allowedFileTypes: z.string().min(3, 'Enter allowed file types.'),
  maxUploadSizeMb: z.coerce.number().int().min(1),
  systemBanner: z.string().min(2, 'Enter a banner message.'),
  maintenanceMode: z.boolean(),
  allowNewRegistrations: z.boolean(),
  requireEmailVerification: z.boolean(),
  showDefaultCreditPackages: z.boolean(),
  extensionPairingExpiration: z.coerce.number().int().min(60),
  rateLimitDefaults: z.coerce.number().int().min(10),
  supportEmail: z.string().email('Enter a valid email.'),
  platformName: z.string().min(2, 'Enter a platform name.'),
});

export function AdminSubjectForm() {
  const { pushToast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof subjectSchema>>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: 'Physics',
      courseCode: 'PHY-201',
      keywords: 'momentum, kinematics, force',
      urlPatterns: '/physics/*, /lms/phy-201/*',
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject configuration</CardTitle>
        <CardDescription>Manage course code hints, keyword routing, and URL patterns for subject detection.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={handleSubmit((values) =>
            pushToast({
              tone: 'success',
              title: 'Subject rules validated',
              description: `Ready to save ${values.name} with course code ${values.courseCode}.`,
            }),
          )}
        >
          <FormField label="Subject name" error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Course code" error={errors.courseCode?.message}>
            <Input {...register('courseCode')} />
          </FormField>
          <FormField label="Keywords" error={errors.keywords?.message}>
            <Textarea {...register('keywords')} className="min-h-[110px]" />
          </FormField>
          <FormField label="URL patterns" error={errors.urlPatterns?.message}>
            <Textarea {...register('urlPatterns')} className="min-h-[110px]" />
          </FormField>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="secondary">Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AdminCategoryForm() {
  const { pushToast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: 'Midterm',
      subject: 'Physics',
      keywords: 'midterm, unit exam, reviewer',
      sortOrder: 20,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category configuration</CardTitle>
        <CardDescription>Use categories to refine retrieval scope beyond the subject root folder.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={handleSubmit((values) =>
            pushToast({
              tone: 'success',
              title: 'Category validated',
              description: `Category ${values.name} is ready to be assigned to ${values.subject}.`,
            }),
          )}
        >
          <FormField label="Category name" error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Subject" error={errors.subject?.message}>
            <Input {...register('subject')} />
          </FormField>
          <FormField label="Default keywords" error={errors.keywords?.message}>
            <Textarea {...register('keywords')} className="min-h-[110px]" />
          </FormField>
          <FormField label="Sort order" error={errors.sortOrder?.message}>
            <Input type="number" {...register('sortOrder')} />
          </FormField>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="secondary">Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AdminSystemSettingsForm() {
  const { pushToast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof systemSettingsSchema>>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      lowCreditThresholdSeconds: 900,
      sessionIdleSeconds: 300,
      liveModeDefault: 'confirm',
      confidenceThresholds: 'high=0.80, medium=0.65',
      allowedFileTypes: 'pdf, docx, pptx, txt, md, csv, jpg, png, webp, zip',
      maxUploadSizeMb: 100,
      systemBanner: 'Scheduled maintenance every Sunday at 02:00 UTC.',
      maintenanceMode: false,
      allowNewRegistrations: true,
      requireEmailVerification: true,
      showDefaultCreditPackages: true,
      extensionPairingExpiration: 600,
      rateLimitDefaults: 120,
      supportEmail: 'support@study-assistant.com',
      platformName: 'Codex AI',
    },
  });

  return (
    <form
      className="space-y-8 pb-32"
      onSubmit={handleSubmit((values) =>
        pushToast({
          tone: 'success',
          title: 'Settings saved',
          description: `System configuration updated for ${values.platformName}.`,
        }),
      )}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Platform Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Controls</CardTitle>
            <CardDescription>Core identity and platform-wide behavior toggles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Platform Name" error={errors.platformName?.message as string}>
              <Input {...register('platformName')} />
            </FormField>
            <FormField label="Support Email" error={errors.supportEmail?.message as string}>
              <Input type="email" {...register('supportEmail')} />
            </FormField>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Locks out all non-admin traffic.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded border-border bg-background" {...register('maintenanceMode')} />
            </div>
          </CardContent>
        </Card>

        {/* Security & Access */}
        <Card>
          <CardHeader>
            <CardTitle>Security & Access</CardTitle>
            <CardDescription>Rules for new users and API limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Allow New Registrations</p>
                <p className="text-xs text-muted-foreground">Toggle open public signups.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded border-border bg-background" {...register('allowNewRegistrations')} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Require Email Verification</p>
                <p className="text-xs text-muted-foreground">Must verify email before using credits.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded border-border bg-background" {...register('requireEmailVerification')} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField label="Extension Pairing Expiry (s)" error={errors.extensionPairingExpiration?.message as string}>
                <Input type="number" {...register('extensionPairingExpiration')} />
              </FormField>
              <FormField label="Default Rate Limit (/hr)" error={errors.rateLimitDefaults?.message as string}>
                <Input type="number" {...register('rateLimitDefaults')} />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Billing & Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Usage</CardTitle>
            <CardDescription>Defaults for wallets, sessions, and packages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Low credit threshold (s)" error={errors.lowCreditThresholdSeconds?.message as string}>
                <Input type="number" {...register('lowCreditThresholdSeconds')} />
              </FormField>
              <FormField label="Session idle threshold (s)" error={errors.sessionIdleSeconds?.message as string}>
                <Input type="number" {...register('sessionIdleSeconds')} />
              </FormField>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Show Default Credit Packages</p>
                <p className="text-xs text-muted-foreground">Display standard Stripe pricing on public pages.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded border-border bg-background" {...register('showDefaultCreditPackages')} />
            </div>
          </CardContent>
        </Card>

        {/* Ingestion & AI */}
        <Card>
          <CardHeader>
            <CardTitle>Ingestion & Search</CardTitle>
            <CardDescription>File upload constraints and retrieval thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Max upload size (MB)" error={errors.maxUploadSizeMb?.message as string}>
                <Input type="number" {...register('maxUploadSizeMb')} />
              </FormField>
              <FormField label="Live Search Default">
                <select className="h-11 w-full rounded-2xl border border-input bg-background/60 px-4 text-sm" {...register('liveModeDefault')}>
                  <option value="disabled">Disabled</option>
                  <option value="confirm">Confirm first</option>
                  <option value="enabled">Enabled automatically</option>
                </select>
              </FormField>
            </div>
            <FormField label="Allowed file types" error={errors.allowedFileTypes?.message as string}>
              <Input {...register('allowedFileTypes')} />
            </FormField>
            <FormField label="Confidence score mapping" error={errors.confidenceThresholds?.message as string}>
              <Input {...register('confidenceThresholds')} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      {/* System Banner */}
      <Card>
        <CardHeader>
          <CardTitle>System Banner</CardTitle>
          <CardDescription>Show a global announcement across the portal and extension.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormField label="Banner Message (Markdown supported)" error={errors.systemBanner?.message as string}>
            <Textarea {...register('systemBanner')} placeholder="Leave blank to disable banner." className="min-h-[110px]" />
          </FormField>
        </CardContent>
      </Card>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-end gap-4 border-t border-border/70 bg-surface/85 px-6 py-4 shadow-[0_-18px_50px_-34px_rgba(8,22,28,0.35)] backdrop-blur lg:left-[280px]">
        <p className="mr-auto text-sm text-muted-foreground hidden sm:block">You have unsaved changes</p>
        <Button type="button" variant="secondary" onClick={() => pushToast({ title: 'Reverted to defaults' })}>
          Reset Defaults
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
