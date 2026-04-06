'use client';

import type { AdminPaymentPackageSummary } from '@study-assistant/shared-types';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';

interface AdminPaymentPackageManagerProps {
  packages: AdminPaymentPackageSummary[];
}

interface PackageDraft {
  name: string;
  description: string;
  minutesToCredit: string;
  amountDisplay: string;
  isActive: boolean;
  sortOrder: string;
}

function createDraft(paymentPackage: AdminPaymentPackageSummary): PackageDraft {
  return {
    name: paymentPackage.name,
    description: paymentPackage.description,
    minutesToCredit: String(paymentPackage.minutesToCredit),
    amountDisplay: paymentPackage.amountDisplay,
    isActive: paymentPackage.isActive,
    sortOrder: String(paymentPackage.sortOrder),
  };
}

function readJson<T>(response: Response) {
  return response.json() as Promise<T & { error?: string }>;
}

export function AdminPaymentPackageManager({ packages }: AdminPaymentPackageManagerProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>(() =>
    Object.fromEntries(packages.map((paymentPackage) => [paymentPackage.id, createDraft(paymentPackage)])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(packages.map((paymentPackage) => [paymentPackage.id, createDraft(paymentPackage)])));
  }, [packages]);

  function updateDraft(packageId: string, partial: Partial<PackageDraft>) {
    setDrafts((current) => {
      const original = packages.find((entry) => entry.id === packageId);
      const existingDraft = current[packageId] ?? (original ? createDraft(original) : null);

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
      [packageId]: createDraft(original),
    }));
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
        <div className="grid gap-4 xl:grid-cols-2">
          {packages.map((paymentPackage) => {
            const draft = drafts[paymentPackage.id];

            if (!paymentPackage || !draft) {
              return null;
            }

            const priceMajor = Number.parseFloat(draft.amountDisplay);
            const minutesToCredit = Number.parseInt(draft.minutesToCredit, 10);
            const sortOrder = Number.parseInt(draft.sortOrder, 10);
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
                  {draft.minutesToCredit || '0'} minutes.
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
                        if (!draft.name.trim()) {
                          pushToast({
                            tone: 'warning',
                            title: 'Package name required',
                            description: 'Maglagay ng package name bago mag-save.',
                          });
                          return;
                        }

                        if (!Number.isFinite(priceMajor) || priceMajor <= 0) {
                          pushToast({
                            tone: 'warning',
                            title: 'Invalid price',
                            description: 'Maglagay ng valid positive amount.',
                          });
                          return;
                        }

                        if (!Number.isFinite(minutesToCredit) || minutesToCredit <= 0) {
                          pushToast({
                            tone: 'warning',
                            title: 'Invalid duration',
                            description: 'Maglagay ng positive number of minutes.',
                          });
                          return;
                        }

                        if (!Number.isFinite(sortOrder) || sortOrder < 0) {
                          pushToast({
                            tone: 'warning',
                            title: 'Invalid sort order',
                            description: 'Sort order must be zero or higher.',
                          });
                          return;
                        }

                        startTransition(() => {
                          void (async () => {
                            setPendingId(paymentPackage.id);

                            try {
                              const response = await fetch(`/api/admin/payment-packages/${paymentPackage.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  name: draft.name.trim(),
                                  description: draft.description.trim(),
                                  minutesToCredit,
                                  priceMajor,
                                  isActive: draft.isActive,
                                  sortOrder,
                                }),
                              });

                              const payload = await readJson<{ message: string }>(response);
                              if (!response.ok) {
                                throw new Error(payload.error ?? 'Failed to update payment package.');
                              }

                              pushToast({
                                tone: 'success',
                                title: 'Package updated',
                                description: payload.message,
                              });
                              router.refresh();
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
