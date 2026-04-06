'use client';

import type {
  AdminPaymentPackageCreateRequest,
  AdminPaymentPackageSummary,
  AdminPaymentPackageUpdateRequest,
} from '@study-assistant/shared-types';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';

import { FormField } from '@/components/forms/form-field';
import { formatPaymentPackageDurationLabel } from '@/lib/payments/package-display';
import { useToast } from '@/components/providers/toast-provider';

interface AdminPaymentPackageManagerProps {
  packages: AdminPaymentPackageSummary[];
}

interface PackageDraft {
  code?: string;
  name: string;
  description: string;
  minutesToCredit: string;
  amountDisplay: string;
  isActive: boolean;
  sortOrder: string;
}

function buildPackageDraft(paymentPackage: AdminPaymentPackageSummary): PackageDraft {
  return {
    name: paymentPackage.name,
    description: paymentPackage.description,
    minutesToCredit: String(paymentPackage.minutesToCredit),
    amountDisplay: paymentPackage.amountDisplay,
    isActive: paymentPackage.isActive,
    sortOrder: String(paymentPackage.sortOrder),
  };
}

const emptyPackageDraft: PackageDraft = {
  code: '',
  name: '',
  description: '',
  minutesToCredit: '60',
  amountDisplay: '4.99',
  isActive: true,
  sortOrder: '0',
};

function readJson<T>(response: Response) {
  return response.json() as Promise<T & { error?: string }>;
}

function readDurationLabel(minutesToCredit: string) {
  const parsedMinutes = Number.parseInt(minutesToCredit, 10);

  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return 'Enter minutes to preview the credited study time.';
  }

  return `${formatPaymentPackageDurationLabel(parsedMinutes * 60)} of active study time`;
}

export function AdminPaymentPackageManager({ packages }: AdminPaymentPackageManagerProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>(() =>
    Object.fromEntries(packages.map((paymentPackage) => [paymentPackage.id, buildPackageDraft(paymentPackage)])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newPackageDraft, setNewPackageDraft] = useState<PackageDraft>({ ...emptyPackageDraft });
  const [createPending, setCreatePending] = useState(false);

  useEffect(() => {
    setDrafts(Object.fromEntries(packages.map((paymentPackage) => [paymentPackage.id, buildPackageDraft(paymentPackage)])));
  }, [packages]);

  function updateDraft(packageId: string, partial: Partial<PackageDraft>) {
    setDrafts((current) => {
      const original = packages.find((entry) => entry.id === packageId);
      const existingDraft = current[packageId] ?? (original ? buildPackageDraft(original) : null);

      if (!existingDraft) {
        return current;
      }

      return {
        ...current,
        [packageId]: {
          ...existingDraft,
          ...partial,
        },
      };
    });
  }

  function resetDraft(packageId: string) {
    const original = packages.find((paymentPackage) => paymentPackage.id === packageId);
    if (!original) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [packageId]: buildPackageDraft(original),
    }));
  }

  function validateDraft(draft: PackageDraft, options?: { requireCode?: boolean }) {
    const priceMajor = Number.parseFloat(draft.amountDisplay);
    const minutesToCredit = Number.parseInt(draft.minutesToCredit, 10);
    const sortOrder = Number.parseInt(draft.sortOrder, 10);
    const normalizedCode = draft.code?.trim() ?? '';

    if (options?.requireCode && normalizedCode.length === 0) {
      throw new Error('Maglagay ng package code o internal slug.');
    }

    if (!draft.name.trim()) {
      throw new Error('Maglagay ng package name.');
    }

    if (!Number.isFinite(priceMajor) || priceMajor <= 0) {
      throw new Error('Maglagay ng valid positive amount.');
    }

    if (!Number.isFinite(minutesToCredit) || minutesToCredit <= 0) {
      throw new Error('Maglagay ng positive number of minutes.');
    }

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      throw new Error('Sort order must be zero or higher.');
    }

    return {
      code: normalizedCode || undefined,
      name: draft.name.trim(),
      description: draft.description.trim(),
      minutesToCredit,
      priceMajor,
      isActive: draft.isActive,
      sortOrder,
    };
  }

  async function sendPackageMutation(
    url: string,
    options: RequestInit,
    success: { title: string; description: string },
    failureTitle: string,
  ) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const payload = await readJson<{ message: string }>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? failureTitle);
    }

    pushToast({
      tone: 'success',
      title: success.title,
      description: payload.message || success.description,
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Packages</CardTitle>
        <CardDescription>
          I-edit mo rito ang presyo at duration ng bawat package. Ang susunod na bagong checkout session o PayMongo QR ang
          gagamit ng latest saved amount. Ang mga checkout na naka-open na bago ang save ay hindi magbabago.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/20 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Create New Package</h3>
              <p className="text-xs text-muted-foreground">
                Fixed to `PHP` for your PayMongo flow. Once created, puwede mo na rin siyang i-edit o i-hide dito.
              </p>
            </div>
            <Badge>PHP</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Package code" description="Internal slug like one-hour or weekend-pass.">
              <Input
                value={newPackageDraft.code ?? ''}
                onChange={(event) => setNewPackageDraft((current) => ({ ...current, code: event.target.value }))}
                disabled={createPending}
                placeholder="weekend-pass"
              />
            </FormField>
            <FormField label="Package name">
              <Input
                value={newPackageDraft.name}
                onChange={(event) => setNewPackageDraft((current) => ({ ...current, name: event.target.value }))}
                disabled={createPending}
                placeholder="Weekend Pass"
              />
            </FormField>
            <FormField label="Price (PHP)">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={newPackageDraft.amountDisplay}
                onChange={(event) => setNewPackageDraft((current) => ({ ...current, amountDisplay: event.target.value }))}
                disabled={createPending}
              />
            </FormField>
            <FormField label="Credit duration (minutes)">
              <Input
                type="number"
                min={1}
                step={1}
                value={newPackageDraft.minutesToCredit}
                onChange={(event) => setNewPackageDraft((current) => ({ ...current, minutesToCredit: event.target.value }))}
                disabled={createPending}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Visible client label: {readDurationLabel(newPackageDraft.minutesToCredit)}.
              </p>
            </FormField>
            <FormField label="Sort order">
              <Input
                type="number"
                min={0}
                value={newPackageDraft.sortOrder}
                onChange={(event) => setNewPackageDraft((current) => ({ ...current, sortOrder: event.target.value }))}
                disabled={createPending}
              />
            </FormField>
            <div className="flex items-center rounded-2xl border border-border/40 bg-background/40 px-4 py-3">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-background"
                  checked={newPackageDraft.isActive}
                  onChange={(event) => setNewPackageDraft((current) => ({ ...current, isActive: event.target.checked }))}
                  disabled={createPending}
                />
                Show this package immediately on the buy-credits page
              </label>
            </div>
            <div className="md:col-span-2">
              <FormField label="Description">
                <Textarea
                  value={newPackageDraft.description}
                  onChange={(event) => setNewPackageDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-[96px]"
                  disabled={createPending}
                  placeholder="Limited-time top-up package"
                />
              </FormField>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={createPending}
              onClick={() => setNewPackageDraft({ ...emptyPackageDraft })}
            >
              Reset New Form
            </Button>
            <Button
              size="sm"
              disabled={createPending}
              onClick={() => {
                let payload: AdminPaymentPackageCreateRequest;

                try {
                  payload = validateDraft(newPackageDraft);
                } catch (error) {
                  pushToast({
                    tone: 'warning',
                    title: 'Cannot create package',
                    description: error instanceof Error ? error.message : 'Invalid package details.',
                  });
                  return;
                }

                startTransition(() => {
                  void (async () => {
                    setCreatePending(true);

                    try {
                      await sendPackageMutation(
                        '/api/admin/payment-packages',
                        {
                          method: 'POST',
                          body: JSON.stringify(payload),
                        },
                        {
                          title: 'Package created',
                          description: 'Payment package created successfully.',
                        },
                        'Failed to create payment package.',
                      );
                      setNewPackageDraft({ ...emptyPackageDraft });
                    } catch (error) {
                      pushToast({
                        tone: 'danger',
                        title: 'Create failed',
                        description: error instanceof Error ? error.message : 'Unknown error.',
                      });
                    } finally {
                      setCreatePending(false);
                    }
                  })();
                });
              }}
            >
              {createPending ? 'Creating...' : 'Create Package'}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {packages.map((paymentPackage) => {
            const draft = drafts[paymentPackage.id];

            if (!paymentPackage || !draft) {
              return null;
            }

            const isDirty =
              draft.name !== paymentPackage.name ||
              draft.description !== paymentPackage.description ||
              draft.amountDisplay !== paymentPackage.amountDisplay ||
              draft.minutesToCredit !== String(paymentPackage.minutesToCredit) ||
              draft.isActive !== paymentPackage.isActive ||
              draft.sortOrder !== String(paymentPackage.sortOrder);

            return (
              <div key={paymentPackage.id} className="rounded-2xl border border-border/50 bg-background/70 p-5 shadow-soft-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{paymentPackage.code}</h3>
                  <Badge tone={draft.isActive ? 'success' : 'warning'}>
                    {draft.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                  <Badge>{paymentPackage.currency}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Next checkout preview: {paymentPackage.currency} {draft.amountDisplay || '0.00'} for{' '}
                  {readDurationLabel(draft.minutesToCredit).toLowerCase()}.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Package name">
                    <Input
                      value={draft.name}
                      onChange={(event) => updateDraft(paymentPackage.id, { name: event.target.value })}
                      disabled={pendingId === paymentPackage.id}
                    />
                  </FormField>
                  <FormField label="Sort order">
                    <Input
                      type="number"
                      min={0}
                      value={draft.sortOrder}
                      onChange={(event) => updateDraft(paymentPackage.id, { sortOrder: event.target.value })}
                      disabled={pendingId === paymentPackage.id}
                    />
                  </FormField>
                  <FormField label={`Price (${paymentPackage.currency})`} description="Enter peso value like 4.99 or 49.00.">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.amountDisplay}
                      onChange={(event) => updateDraft(paymentPackage.id, { amountDisplay: event.target.value })}
                      disabled={pendingId === paymentPackage.id}
                    />
                  </FormField>
                  <FormField label="Credit duration (minutes)" description="Saved as seconds in the wallet package table.">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={draft.minutesToCredit}
                      onChange={(event) => updateDraft(paymentPackage.id, { minutesToCredit: event.target.value })}
                      disabled={pendingId === paymentPackage.id}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Visible client label: {readDurationLabel(draft.minutesToCredit)}.
                    </p>
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Description">
                      <Textarea
                        value={draft.description}
                        onChange={(event) => updateDraft(paymentPackage.id, { description: event.target.value })}
                        className="min-h-[96px]"
                        disabled={pendingId === paymentPackage.id}
                      />
                    </FormField>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/40 bg-surface/30 px-4 py-3">
                  <label className="flex items-center gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-background"
                      checked={draft.isActive}
                      onChange={(event) => updateDraft(paymentPackage.id, { isActive: event.target.checked })}
                      disabled={pendingId === paymentPackage.id}
                    />
                    Show this package on the buy-credits page
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingId === paymentPackage.id || !isDirty}
                      onClick={() => resetDraft(paymentPackage.id)}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      disabled={pendingId === paymentPackage.id || !isDirty}
                      onClick={() => {
                        let payload: AdminPaymentPackageUpdateRequest;

                        try {
                          payload = validateDraft(draft);
                        } catch (error) {
                          pushToast({
                            tone: 'warning',
                            title: 'Cannot save package',
                            description: error instanceof Error ? error.message : 'Invalid package details.',
                          });
                          return;
                        }

                        startTransition(() => {
                          void (async () => {
                            setPendingId(paymentPackage.id);

                            try {
                              await sendPackageMutation(
                                `/api/admin/payment-packages/${paymentPackage.id}`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify(payload),
                                },
                                {
                                  title: 'Package updated',
                                  description: 'Payment package updated successfully.',
                                },
                                'Failed to update payment package.',
                              );
                            } catch (error) {
                              pushToast({
                                tone: 'danger',
                                title: 'Save failed',
                                description: error instanceof Error ? error.message : 'Unknown error.',
                              });
                            } finally {
                              setPendingId(null);
                            }
                          })();
                        });
                      }}
                    >
                      {pendingId === paymentPackage.id ? 'Saving...' : 'Save Package'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingId === paymentPackage.id}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Delete package "${paymentPackage.code}"? This only works when it has no payment history. Use Hide for old packages that were already sold.`,
                        );

                        if (!confirmed) {
                          return;
                        }

                        startTransition(() => {
                          void (async () => {
                            setPendingId(paymentPackage.id);

                            try {
                              await sendPackageMutation(
                                `/api/admin/payment-packages/${paymentPackage.id}`,
                                {
                                  method: 'DELETE',
                                  body: JSON.stringify({}),
                                },
                                {
                                  title: 'Package deleted',
                                  description: 'Payment package deleted successfully.',
                                },
                                'Failed to delete payment package.',
                              );
                            } catch (error) {
                              pushToast({
                                tone: 'danger',
                                title: 'Delete failed',
                                description: error instanceof Error ? error.message : 'Unknown error.',
                              });
                            } finally {
                              setPendingId(null);
                            }
                          })();
                        });
                      }}
                    >
                      {pendingId === paymentPackage.id ? 'Working...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
