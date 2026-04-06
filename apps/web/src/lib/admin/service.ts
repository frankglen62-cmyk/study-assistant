import type {
  AdminPaymentPackageCreateRequest,
  AdminPaymentPackageUpdateRequest,
  AdminCategoryMutationRequest,
  AdminFolderCreateRequest,
  AdminFolderUpdateRequest,
  AdminSourceMetadataRequest,
  AdminSubjectQaPairCreateRequest,
  AdminSubjectQaPairUpdateRequest,
  AdminSubjectMutationRequest,
  AdminUserCreditAdjustmentRequest,
  AdminUserStatusRequest,
  AccountStatus,
  SourceStatus,
  WalletStatus,
} from '@study-assistant/shared-types';

import { slugify } from '@study-assistant/shared-utils';

import { applyWalletSeconds } from '@/lib/billing/wallet';
import { invalidatePreloadedQaPairCache } from '@/lib/ai/retrieval';
import { RouteError } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { invalidateActiveCatalogCache } from '@/lib/supabase/catalog';
import { assertSupabaseResult } from '@/lib/supabase/utils';
import { getProfileWithWalletByUserId, setUserAccountStatusAtomic } from '@/lib/supabase/users';

import { retrySourceProcessing, uploadAndProcessSource } from './source-ingestion';

interface AuditContext {
  actorUserId: string;
  actorRole: 'super_admin' | 'admin' | 'client';
  ipAddress?: string | null;
  userAgent?: string | null;
}

function isMissingSubjectQaPairsRelation(error: { message?: string | null; details?: string | null } | null) {
  const rawMessage = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'));
}

function assertSubjectQaPairsAvailable(error: { message?: string | null; details?: string | null } | null, message: string) {
  if (isMissingSubjectQaPairsRelation(error)) {
    throw new RouteError(
      503,
      'subject_qa_storage_unavailable',
      'Subject Q&A storage is not available yet. Apply the latest database migration before saving answer pairs.',
      message,
    );
  }

  assertSupabaseResult(error as { message: string } | null, message);
}

function ensureMutableClientAccount(status: AccountStatus) {
  if (status === 'banned') {
    throw new RouteError(403, 'user_banned', 'Banned users cannot be modified by standard admin flows.');
  }
}

function assertActorMayManageTarget(params: {
  actorRole: 'super_admin' | 'admin' | 'client';
  targetRole: 'super_admin' | 'admin' | 'client';
}) {
  if (params.actorRole === 'client') {
    throw new RouteError(403, 'insufficient_role', 'Client users cannot perform admin mutations.');
  }

  if (params.actorRole !== 'super_admin' && params.targetRole !== 'client') {
    throw new RouteError(403, 'insufficient_role', 'Only super admins may modify admin or super admin accounts.');
  }
}

async function getFolderById(folderId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('folders')
    .select('id, parent_id, subject_id, folder_type, name, slug, is_active, archived_at, deleted_at')
    .eq('id', folderId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load folder.');

  if (!data || data.deleted_at) {
    throw new RouteError(404, 'folder_not_found', 'Folder not found.');
  }

  return data;
}

async function getSubjectById(subjectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, slug, course_code, department, description, keywords, url_patterns, is_active')
    .eq('id', subjectId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load subject.');

  if (!data) {
    throw new RouteError(404, 'subject_not_found', 'Subject not found.');
  }

  return data;
}

async function getSourceById(sourceId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('source_files')
    .select(`
      id,
      folder_id,
      subject_id,
      category_id,
      title,
      source_status,
      processing_error,
      source_priority,
      tags,
      description,
      archived_at,
      deleted_at
    `)
    .eq('id', sourceId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load source.');

  if (!data || data.deleted_at) {
    throw new RouteError(404, 'source_not_found', 'Source file not found.');
  }

  return data;
}

async function getSubjectQaPairById(pairId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('subject_qa_pairs')
    .select(`
      id,
      subject_id,
      category_id,
      question_text,
      answer_text,
      short_explanation,
      keywords,
      sort_order,
      is_active,
      deleted_at
    `)
    .eq('id', pairId)
    .maybeSingle();

  assertSubjectQaPairsAvailable(error, 'Failed to load subject Q&A pair.');

  if (!data || data.deleted_at) {
    throw new RouteError(404, 'qa_pair_not_found', 'Subject Q&A pair not found.');
  }

  return data;
}

async function getPaymentPackageByIdForAdmin(packageId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code, name, description, seconds_to_credit, amount_minor, currency, is_active, sort_order, provider_price_reference')
    .eq('id', packageId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment package.');

  if (!data) {
    throw new RouteError(404, 'payment_package_not_found', 'Payment package not found.');
  }

  return data;
}

async function getPaymentPackageByCode(code: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code')
    .eq('code', code)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment package code.');
  return data;
}

export async function adjustUserCredits(
  input: AdminUserCreditAdjustmentRequest & AuditContext & { userId: string },
) {
  const target = await getProfileWithWalletByUserId(input.userId);
  assertActorMayManageTarget({
    actorRole: input.actorRole,
    targetRole: target.profile.role,
  });
  ensureMutableClientAccount(target.profile.account_status);

  const wallet = await applyWalletSeconds({
    userId: input.userId,
    deltaSeconds: input.deltaSeconds,
    transactionType: input.deltaSeconds > 0 ? 'admin_adjustment_add' : 'admin_adjustment_subtract',
    description: input.description,
    createdBy: input.actorUserId,
    metadata: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
    },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'wallet.admin_adjustment',
    entityType: 'wallets',
    entityId: target.wallet.id,
    eventSummary: `Adjusted ${input.deltaSeconds} seconds for ${target.profile.email}.`,
    oldValues: {
      remainingSeconds: target.wallet.remaining_seconds,
    },
    newValues: {
      remainingSeconds: wallet.remaining_seconds,
      deltaSeconds: input.deltaSeconds,
      description: input.description,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    userId: input.userId,
    remainingSeconds: wallet.remaining_seconds,
    lifetimeSecondsPurchased: wallet.lifetime_seconds_purchased,
    lifetimeSecondsUsed: wallet.lifetime_seconds_used,
    message: 'Wallet balance updated successfully.',
  };
}

export async function updateUserStatus(input: AdminUserStatusRequest & AuditContext & { userId: string }) {
  const target = await getProfileWithWalletByUserId(input.userId);
  assertActorMayManageTarget({
    actorRole: input.actorRole,
    targetRole: target.profile.role,
  });
  ensureMutableClientAccount(target.profile.account_status);

  const nextWalletStatus: WalletStatus = input.status === 'suspended' ? 'locked' : 'active';
  await setUserAccountStatusAtomic({
    userId: input.userId,
    accountStatus: input.status,
    walletStatus: nextWalletStatus,
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'profile.status_changed',
    entityType: 'profiles',
    entityId: input.userId,
    eventSummary: `Changed account status for ${target.profile.email} to ${input.status}.`,
    oldValues: {
      accountStatus: target.profile.account_status,
      walletStatus: target.wallet.status,
    },
    newValues: {
      accountStatus: input.status,
      walletStatus: nextWalletStatus,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    userId: input.userId,
    accountStatus: input.status,
    walletStatus: nextWalletStatus,
    message: 'User status updated successfully.',
  };
}

export async function createPaymentPackage(
  input: AdminPaymentPackageCreateRequest & AuditContext,
) {
  const supabase = getSupabaseAdmin();
  const code = slugify(input.code ?? input.name);

  if (!code) {
    throw new RouteError(400, 'payment_package_code_invalid', 'Enter a package code or name that can be converted into a valid code.');
  }

  const existing = await getPaymentPackageByCode(code);
  if (existing) {
    throw new RouteError(409, 'payment_package_code_taken', `A payment package with code "${code}" already exists.`);
  }

  const amountMinor = Math.round(input.priceMajor * 100);

  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new RouteError(400, 'invalid_price', 'Enter a valid positive price.');
  }

  const secondsToCredit = input.minutesToCredit * 60;

  const inserted = await supabase
    .from('payment_packages')
    .insert({
      code,
      name: input.name,
      description: input.description ?? '',
      seconds_to_credit: secondsToCredit,
      amount_minor: amountMinor,
      currency: 'PHP',
      is_active: input.isActive ?? true,
      provider_price_reference: null,
      sort_order: input.sortOrder ?? 0,
    })
    .select('id')
    .single();

  assertSupabaseResult(inserted.error, 'Failed to create payment package.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'payment_package.created',
    entityType: 'payment_packages',
    entityId: inserted.data!.id,
    eventSummary: `Created payment package ${code}.`,
    newValues: {
      code,
      name: input.name,
      description: input.description ?? '',
      secondsToCredit,
      amountMinor,
      currency: 'PHP',
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    packageId: inserted.data!.id,
    amountMinor,
    minutesToCredit: input.minutesToCredit,
    message: 'Payment package created successfully.',
  };
}

export async function updatePaymentPackage(
  input: AdminPaymentPackageUpdateRequest & AuditContext & { packageId: string },
) {
  const supabase = getSupabaseAdmin();
  const existing = await getPaymentPackageByIdForAdmin(input.packageId);
  const amountMinor = Math.round(input.priceMajor * 100);

  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new RouteError(400, 'invalid_price', 'Enter a valid positive price.');
  }

  const secondsToCredit = input.minutesToCredit * 60;

  const updated = await supabase
    .from('payment_packages')
    .update({
      name: input.name,
      description: input.description ?? '',
      seconds_to_credit: secondsToCredit,
      amount_minor: amountMinor,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? existing.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.packageId);

  assertSupabaseResult(updated.error, 'Failed to update payment package.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'payment_package.updated',
    entityType: 'payment_packages',
    entityId: input.packageId,
    eventSummary: `Updated payment package ${existing.code}.`,
    oldValues: {
      name: existing.name,
      description: existing.description,
      secondsToCredit: existing.seconds_to_credit,
      amountMinor: existing.amount_minor,
      isActive: existing.is_active,
      sortOrder: existing.sort_order,
    },
    newValues: {
      name: input.name,
      description: input.description ?? '',
      secondsToCredit,
      amountMinor,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? existing.sort_order,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    packageId: input.packageId,
    amountMinor,
    minutesToCredit: input.minutesToCredit,
    message: 'Payment package updated successfully.',
  };
}

export async function deletePaymentPackage(input: AuditContext & { packageId: string }) {
  const supabase = getSupabaseAdmin();
  const existing = await getPaymentPackageByIdForAdmin(input.packageId);
  const relatedPayments = await supabase
    .from('payments')
    .select('*', { head: true, count: 'exact' })
    .eq('package_id', input.packageId);

  assertSupabaseResult(relatedPayments.error, 'Failed to inspect related payments.');

  if ((relatedPayments.count ?? 0) > 0) {
    throw new RouteError(
      409,
      'payment_package_has_history',
      'This package already has payment history. Hide it instead of deleting so your old payment records stay readable.',
    );
  }

  const deleted = await supabase
    .from('payment_packages')
    .delete()
    .eq('id', input.packageId);

  assertSupabaseResult(deleted.error, 'Failed to delete payment package.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'payment_package.deleted',
    entityType: 'payment_packages',
    entityId: input.packageId,
    eventSummary: `Deleted payment package ${existing.code}.`,
    oldValues: {
      code: existing.code,
      name: existing.name,
      description: existing.description,
      secondsToCredit: existing.seconds_to_credit,
      amountMinor: existing.amount_minor,
      currency: existing.currency,
      isActive: existing.is_active,
      sortOrder: existing.sort_order,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    packageId: input.packageId,
    amountMinor: existing.amount_minor,
    minutesToCredit: Math.round(existing.seconds_to_credit / 60),
    message: 'Payment package deleted successfully.',
  };
}

export async function createSubject(input: AdminSubjectMutationRequest & AuditContext) {
  const supabase = getSupabaseAdmin();
  const slug = input.slug ?? slugify(input.name);

  const inserted = await supabase
    .from('subjects')
    .insert({
      name: input.name,
      slug,
      course_code: input.courseCode ?? null,
      department: input.department ?? null,
      description: input.description ?? null,
      keywords: input.keywords,
      url_patterns: input.urlPatterns,
      is_active: input.isActive ?? true,
    })
    .select('id, name, slug')
    .single();

  assertSupabaseResult(inserted.error, 'Failed to create subject.');

  const subject = inserted.data!;

  const rootFolder = await supabase
    .from('folders')
    .insert({
      parent_id: null,
      subject_id: subject.id,
      folder_type: 'subject_root',
      name: subject.name,
      slug: subject.slug,
      sort_order: 0,
      is_active: true,
      created_by: input.actorUserId,
    })
    .select('id')
    .single();

  assertSupabaseResult(rootFolder.error, 'Failed to create the subject root folder.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'subject.created',
    entityType: 'subjects',
    entityId: subject.id,
    eventSummary: `Created subject ${subject.name}.`,
    newValues: {
      slug,
      courseCode: input.courseCode ?? null,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidateActiveCatalogCache();

  return {
    subjectId: subject.id,
    folderId: rootFolder.data!.id,
    message: 'Subject created successfully.',
  };
}

export async function updateSubject(
  input: AdminSubjectMutationRequest & AuditContext & { subjectId: string },
) {
  const supabase = getSupabaseAdmin();
  const slug = input.slug ?? slugify(input.name);

  const existing = await supabase
    .from('subjects')
    .select('id, name, slug, course_code, department, description, keywords, url_patterns, is_active')
    .eq('id', input.subjectId)
    .maybeSingle();

  assertSupabaseResult(existing.error, 'Failed to load subject.');

  if (!existing.data) {
    throw new RouteError(404, 'subject_not_found', 'Subject not found.');
  }

  const updated = await supabase
    .from('subjects')
    .update({
      name: input.name,
      slug,
      course_code: input.courseCode ?? null,
      department: input.department ?? null,
      description: input.description ?? null,
      keywords: input.keywords,
      url_patterns: input.urlPatterns,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.subjectId);

  assertSupabaseResult(updated.error, 'Failed to update subject.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'subject.updated',
    entityType: 'subjects',
    entityId: input.subjectId,
    eventSummary: `Updated subject ${input.name}.`,
    oldValues: existing.data,
    newValues: {
      name: input.name,
      slug,
      isActive: input.isActive ?? true,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidateActiveCatalogCache();

  return {
    subjectId: input.subjectId,
    message: 'Subject updated successfully.',
  };
}

export async function deleteSubjectLibrary(input: AuditContext & { subjectId: string }) {
  const supabase = getSupabaseAdmin();
  const existing = await getSubjectById(input.subjectId);

  const allFoldersResponse = await supabase
    .from('folders')
    .select('id, parent_id, subject_id');
  assertSupabaseResult(allFoldersResponse.error, 'Failed to inspect subject folders.');

  const allFolders = allFoldersResponse.data ?? [];
  const relatedFolderIds = new Set(
    allFolders.filter((folder) => folder.subject_id === input.subjectId).map((folder) => folder.id),
  );

  let changed = true;
  while (changed) {
    changed = false;

    for (const folder of allFolders) {
      if (folder.parent_id && relatedFolderIds.has(folder.parent_id) && !relatedFolderIds.has(folder.id)) {
        relatedFolderIds.add(folder.id);
        changed = true;
      }
    }
  }

  const folderById = new Map(allFolders.map((folder) => [folder.id, folder]));
  const getFolderDepth = (folderId: string): number => {
    const folder = folderById.get(folderId);
    if (!folder?.parent_id || !relatedFolderIds.has(folder.parent_id)) {
      return 0;
    }

    return 1 + getFolderDepth(folder.parent_id);
  };

  const relatedSourceFilesResponse = await supabase
    .from('source_files')
    .select('id, storage_bucket, storage_path')
    .eq('subject_id', input.subjectId);
  assertSupabaseResult(relatedSourceFilesResponse.error, 'Failed to inspect subject files.');

  const relatedSourceFiles = relatedSourceFilesResponse.data ?? [];
  const storagePathsByBucket = new Map<string, string[]>();

  for (const file of relatedSourceFiles) {
    const bucketEntries = storagePathsByBucket.get(file.storage_bucket) ?? [];
    bucketEntries.push(file.storage_path);
    storagePathsByBucket.set(file.storage_bucket, bucketEntries);
  }

  for (const [bucket, storagePaths] of storagePathsByBucket) {
    if (storagePaths.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(bucket).remove(storagePaths);
    if (error) {
      console.warn(`Failed to remove ${storagePaths.length} storage objects from ${bucket}: ${error.message}`);
    }
  }

  if (relatedSourceFiles.length > 0) {
    const deletedSourceFiles = await supabase.from('source_files').delete().eq('subject_id', input.subjectId);
    assertSupabaseResult(deletedSourceFiles.error, 'Failed to delete subject source files.');
  }

  // Step 1: Soft-delete all Q&A pairs for this subject (required by the
  // protect_qa_pair_hard_delete_trigger which blocks hard-deletes on rows
  // where deleted_at IS NULL).
  const softDeletedQaPairs = await supabase
    .from('subject_qa_pairs')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.actorUserId,
      is_active: false,
    })
    .eq('subject_id', input.subjectId)
    .is('deleted_at', null);
  assertSubjectQaPairsAvailable(softDeletedQaPairs.error, 'Failed to soft-delete subject Q&A pairs.');

  // Step 2: Now hard-delete the soft-deleted rows (trigger allows this).
  const hardDeletedQaPairs = await supabase
    .from('subject_qa_pairs')
    .delete()
    .eq('subject_id', input.subjectId)
    .not('deleted_at', 'is', null);
  assertSubjectQaPairsAvailable(hardDeletedQaPairs.error, 'Failed to hard-delete subject Q&A pairs.');

  const deletedCategories = await supabase.from('categories').delete().eq('subject_id', input.subjectId);
  assertSupabaseResult(deletedCategories.error, 'Failed to delete subject categories.');

  const folderIdsByDepth = Array.from(relatedFolderIds).sort((left, right) => getFolderDepth(right) - getFolderDepth(left));
  for (const folderId of folderIdsByDepth) {
    const deletedFolder = await supabase.from('folders').delete().eq('id', folderId);
    assertSupabaseResult(deletedFolder.error, 'Failed to delete a subject folder.');
  }

  const deletedSubject = await supabase.from('subjects').delete().eq('id', input.subjectId);
  assertSupabaseResult(deletedSubject.error, 'Failed to delete the subject.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'subject.deleted',
    entityType: 'subjects',
    entityId: input.subjectId,
    eventSummary: `Deleted subject library ${existing.name}.`,
    oldValues: {
      name: existing.name,
      courseCode: existing.course_code,
      folderCount: relatedFolderIds.size,
      sourceFileCount: relatedSourceFiles.length,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidateActiveCatalogCache();
  invalidatePreloadedQaPairCache(input.subjectId);

  return {
    subjectId: input.subjectId,
    message: 'Subject folder deleted successfully.',
  };
}

export async function createCategory(input: AdminCategoryMutationRequest & AuditContext) {
  const supabase = getSupabaseAdmin();
  const slug = input.slug ?? slugify(input.name);

  const inserted = await supabase
    .from('categories')
    .insert({
      subject_id: input.subjectId ?? null,
      name: input.name,
      slug,
      description: input.description ?? null,
      default_keywords: input.defaultKeywords,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select('id')
    .single();

  assertSupabaseResult(inserted.error, 'Failed to create category.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'category.created',
    entityType: 'categories',
    entityId: inserted.data!.id,
    eventSummary: `Created category ${input.name}.`,
    newValues: {
      subjectId: input.subjectId ?? null,
      slug,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidateActiveCatalogCache();

  return {
    categoryId: inserted.data!.id,
    message: 'Category created successfully.',
  };
}

export async function updateCategory(
  input: AdminCategoryMutationRequest & AuditContext & { categoryId: string },
) {
  const supabase = getSupabaseAdmin();
  const slug = input.slug ?? slugify(input.name);

  const existing = await supabase
    .from('categories')
    .select('id, subject_id, name, slug, description, default_keywords, is_active, sort_order')
    .eq('id', input.categoryId)
    .maybeSingle();

  assertSupabaseResult(existing.error, 'Failed to load category.');

  if (!existing.data) {
    throw new RouteError(404, 'category_not_found', 'Category not found.');
  }

  const updated = await supabase
    .from('categories')
    .update({
      subject_id: input.subjectId ?? null,
      name: input.name,
      slug,
      description: input.description ?? null,
      default_keywords: input.defaultKeywords,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.categoryId);

  assertSupabaseResult(updated.error, 'Failed to update category.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'category.updated',
    entityType: 'categories',
    entityId: input.categoryId,
    eventSummary: `Updated category ${input.name}.`,
    oldValues: existing.data,
    newValues: {
      subjectId: input.subjectId ?? null,
      slug,
      isActive: input.isActive ?? true,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidateActiveCatalogCache();

  return {
    categoryId: input.categoryId,
    message: 'Category updated successfully.',
  };
}

export async function createFolder(input: AdminFolderCreateRequest & AuditContext) {
  const supabase = getSupabaseAdmin();
  const slug = input.slug ?? slugify(input.name);

  if (input.folderType === 'subject_root' && !input.subjectId) {
    throw new RouteError(400, 'subject_required', 'A subject root folder requires a subject id.');
  }

  if (input.folderType !== 'subject_root' && !input.parentId) {
    throw new RouteError(400, 'parent_required', 'Child folders require a parent folder.');
  }

  const inserted = await supabase
    .from('folders')
    .insert({
      parent_id: input.folderType === 'subject_root' ? null : input.parentId ?? null,
      subject_id: input.subjectId ?? null,
      folder_type: input.folderType,
      name: input.name,
      slug,
      sort_order: input.sortOrder ?? 0,
      is_active: true,
      created_by: input.actorUserId,
    })
    .select('id')
    .single();

  assertSupabaseResult(inserted.error, 'Failed to create folder.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'folder.created',
    entityType: 'folders',
    entityId: inserted.data!.id,
    eventSummary: `Created folder ${input.name}.`,
    newValues: {
      parentId: input.parentId ?? null,
      subjectId: input.subjectId ?? null,
      folderType: input.folderType,
      slug,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    folderId: inserted.data!.id,
    message: 'Folder created successfully.',
  };
}

export async function updateFolder(
  input: AdminFolderUpdateRequest & AuditContext & { folderId: string },
) {
  const supabase = getSupabaseAdmin();
  const existing = await getFolderById(input.folderId);

  if (input.action === 'rename') {
    const nextSlug = input.slug ?? slugify(input.name ?? existing.name);
    const updated = await supabase
      .from('folders')
      .update({
        name: input.name,
        slug: nextSlug,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.folderId);

    assertSupabaseResult(updated.error, 'Failed to rename folder.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'folder.renamed',
      entityType: 'folders',
      entityId: input.folderId,
      eventSummary: `Renamed folder ${existing.name} to ${input.name}.`,
      oldValues: {
        name: existing.name,
        slug: existing.slug,
      },
      newValues: {
        name: input.name,
        slug: nextSlug,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  if (input.action === 'move') {
    if (existing.folder_type === 'subject_root') {
      throw new RouteError(400, 'subject_root_immutable', 'Subject root folders cannot be moved.');
    }

    if (!input.parentId) {
      throw new RouteError(400, 'parent_required', 'A destination parent folder is required.');
    }

    const updated = await supabase
      .from('folders')
      .update({
        parent_id: input.parentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.folderId);

    assertSupabaseResult(updated.error, 'Failed to move folder.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'folder.moved',
      entityType: 'folders',
      entityId: input.folderId,
      eventSummary: `Moved folder ${existing.name}.`,
      oldValues: {
        parentId: existing.parent_id,
      },
      newValues: {
        parentId: input.parentId,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  if (input.action === 'archive') {
    const updated = await supabase
      .from('folders')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        archived_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.folderId);

    assertSupabaseResult(updated.error, 'Failed to archive folder.');

    const archiveSources = await supabase
      .from('source_files')
      .update({
        source_status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('folder_id', input.folderId)
      .is('deleted_at', null);

    assertSupabaseResult(archiveSources.error, 'Failed to archive source files in the folder.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'folder.archived',
      entityType: 'folders',
      entityId: input.folderId,
      eventSummary: `Archived folder ${existing.name}.`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  if (input.action === 'delete') {
    const [childrenCount, sourceCount] = await Promise.all([
      supabase
        .from('folders')
        .select('*', { head: true, count: 'exact' })
        .eq('parent_id', input.folderId)
        .is('deleted_at', null),
      supabase
        .from('source_files')
        .select('*', { head: true, count: 'exact' })
        .eq('folder_id', input.folderId)
        .is('deleted_at', null),
    ]);

    assertSupabaseResult(childrenCount.error, 'Failed to inspect child folders.');
    assertSupabaseResult(sourceCount.error, 'Failed to inspect folder sources.');

    if ((childrenCount.count ?? 0) > 0 || (sourceCount.count ?? 0) > 0) {
      throw new RouteError(409, 'folder_not_empty', 'Only empty folders can be deleted safely.');
    }

    const deleted = await supabase
      .from('folders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.folderId);

    assertSupabaseResult(deleted.error, 'Failed to delete folder.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'folder.deleted',
      entityType: 'folders',
      entityId: input.folderId,
      eventSummary: `Soft-deleted folder ${existing.name}.`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  return {
    folderId: input.folderId,
    message: 'Folder updated successfully.',
  };
}

export async function updateSourceMetadata(
  input: AdminSourceMetadataRequest & AuditContext & { sourceId: string },
) {
  const supabase = getSupabaseAdmin();
  const existing = await getSourceById(input.sourceId);

  if (input.action === 'rename') {
    const updated = await supabase
      .from('source_files')
      .update({
        title: input.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sourceId);

    assertSupabaseResult(updated.error, 'Failed to rename source.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'source.renamed',
      entityType: 'source_files',
      entityId: input.sourceId,
      eventSummary: `Renamed source ${existing.title} to ${input.title}.`,
      oldValues: { title: existing.title },
      newValues: { title: input.title },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      sourceId: input.sourceId,
      status: existing.source_status,
      message: 'Source renamed successfully.',
    };
  }

  if (input.action === 'move') {
    const updated = await supabase
      .from('source_files')
      .update({
        folder_id: input.folderId,
        subject_id: input.subjectId,
        category_id: input.categoryId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sourceId);

    assertSupabaseResult(updated.error, 'Failed to move source.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'source.moved',
      entityType: 'source_files',
      entityId: input.sourceId,
      eventSummary: `Moved source ${existing.title}.`,
      oldValues: {
        folderId: existing.folder_id,
        subjectId: existing.subject_id,
        categoryId: existing.category_id,
      },
      newValues: {
        folderId: input.folderId,
        subjectId: input.subjectId,
        categoryId: input.categoryId ?? null,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      sourceId: input.sourceId,
      status: existing.source_status,
      message: 'Source moved successfully.',
    };
  }

  if (input.action === 'archive') {
    const updated = await supabase
      .from('source_files')
      .update({
        source_status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sourceId);

    assertSupabaseResult(updated.error, 'Failed to archive source.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'source.archived',
      entityType: 'source_files',
      entityId: input.sourceId,
      eventSummary: `Archived source ${existing.title}.`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      sourceId: input.sourceId,
      status: 'archived' as SourceStatus,
      message: 'Source archived successfully.',
    };
  }

  if (input.action === 'set_activation' && existing.source_status === 'processing') {
    throw new RouteError(409, 'source_processing', 'Wait until processing completes before changing activation state.');
  }

  if (input.action === 'set_activation' && input.active && existing.source_status === 'failed') {
    throw new RouteError(409, 'source_failed', 'Retry processing before activating a failed source.');
  }

  const nextStatus = input.active ? 'active' : 'draft';
  const activation = await supabase
    .from('source_files')
    .update({
      source_status: nextStatus,
      activated_at: input.active ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.sourceId);

  assertSupabaseResult(activation.error, 'Failed to update source activation state.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: input.active ? 'source.activated' : 'source.deactivated',
    entityType: 'source_files',
    entityId: input.sourceId,
    eventSummary: `${input.active ? 'Activated' : 'Deactivated'} source ${existing.title}.`,
    oldValues: {
      sourceStatus: existing.source_status,
    },
    newValues: {
      sourceStatus: nextStatus,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    sourceId: input.sourceId,
    status: nextStatus,
    message: `Source ${input.active ? 'activated' : 'deactivated'} successfully.`,
  };
}

export async function createSubjectQaPair(input: AdminSubjectQaPairCreateRequest & AuditContext) {
  const supabase = getSupabaseAdmin();
  const updatedAt = new Date().toISOString();

  const { data: existingExactMatches } = await supabase
    .from('subject_qa_pairs')
    .select('id')
    .eq('subject_id', input.subjectId)
    .eq('question_text', input.questionText)
    .eq('answer_text', input.answerText)
    .is('deleted_at', null)
    .limit(1);

  if (existingExactMatches && existingExactMatches.length > 0) {
    throw new RouteError(409, 'already_exists', 'A Q&A pair with the exact same question and answer already exists in this subject.');
  }

  const inserted = await supabase
    .from('subject_qa_pairs')
    .insert({
      subject_id: input.subjectId,
      category_id: input.categoryId ?? null,
      question_text: input.questionText,
      answer_text: input.answerText,
      short_explanation: input.shortExplanation ?? null,
      keywords: input.keywords,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
      updated_at: updatedAt,
    })
    .select('id')
    .single();

  assertSubjectQaPairsAvailable(inserted.error, 'Failed to create subject Q&A pair.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'subject_qa_pair.created',
    entityType: 'subject_qa_pairs',
    entityId: inserted.data!.id,
    eventSummary: 'Created a subject Q&A pair.',
    newValues: {
      subjectId: input.subjectId,
      categoryId: input.categoryId ?? null,
      questionText: input.questionText,
      isActive: input.isActive ?? true,
      keywords: input.keywords,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidatePreloadedQaPairCache(input.subjectId);

  return {
    pairId: inserted.data!.id,
    message: 'Subject Q&A pair created successfully.',
  };
}

export async function createSubjectQaPairFast(input: AdminSubjectQaPairCreateRequest & AuditContext) {
  const supabase = getSupabaseAdmin();
  const updatedAt = new Date().toISOString();

  const inserted = await supabase
    .from('subject_qa_pairs')
    .insert({
      subject_id: input.subjectId,
      category_id: input.categoryId ?? null,
      question_text: input.questionText,
      answer_text: input.answerText,
      short_explanation: input.shortExplanation ?? null,
      keywords: input.keywords,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
      updated_at: updatedAt,
    })
    .select('id')
    .single();

  assertSubjectQaPairsAvailable(inserted.error, 'Failed to create subject Q&A pair.');

  invalidatePreloadedQaPairCache(input.subjectId);

  return {
    pairId: inserted.data!.id,
    message: 'Subject Q&A pair created successfully.',
  };
}

export async function updateSubjectQaPair(
  input: AdminSubjectQaPairUpdateRequest & AuditContext & { pairId: string },
) {
  const supabase = getSupabaseAdmin();
  const existing = await getSubjectQaPairById(input.pairId);
  const updatedAt = new Date().toISOString();

  if (input.action === 'update') {
    const { data: existingExactMatches } = await supabase
      .from('subject_qa_pairs')
      .select('id')
      .eq('subject_id', input.subjectId)
      .eq('question_text', input.questionText)
      .eq('answer_text', input.answerText)
      .neq('id', input.pairId)
      .is('deleted_at', null)
      .limit(1);

    if (existingExactMatches && existingExactMatches.length > 0) {
      throw new RouteError(409, 'already_exists', 'A Q&A pair with the exact same question and answer already exists in this subject.');
    }

    const updated = await supabase
      .from('subject_qa_pairs')
      .update({
        subject_id: input.subjectId,
        category_id: input.categoryId ?? null,
        question_text: input.questionText,
        answer_text: input.answerText,
        short_explanation: input.shortExplanation ?? null,
        keywords: input.keywords,
        sort_order: input.sortOrder ?? 0,
        is_active: input.isActive ?? true,
        updated_by: input.actorUserId,
        updated_at: updatedAt,
      })
      .eq('id', input.pairId);

      assertSubjectQaPairsAvailable(updated.error, 'Failed to update subject Q&A pair.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: 'subject_qa_pair.updated',
      entityType: 'subject_qa_pairs',
      entityId: input.pairId,
      eventSummary: 'Updated a subject Q&A pair.',
      oldValues: existing,
      newValues: {
        subjectId: input.subjectId,
        categoryId: input.categoryId ?? null,
        questionText: input.questionText,
        isActive: input.isActive ?? true,
        keywords: input.keywords,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    invalidatePreloadedQaPairCache(input.subjectId);

    return {
      pairId: input.pairId,
      message: 'Subject Q&A pair updated successfully.',
    };
  }

  if (input.action === 'set_activation') {
    const updated = await supabase
      .from('subject_qa_pairs')
      .update({
        is_active: input.isActive,
        updated_by: input.actorUserId,
        updated_at: updatedAt,
      })
      .eq('id', input.pairId);

      assertSubjectQaPairsAvailable(updated.error, 'Failed to update subject Q&A activation.');

    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      eventType: input.isActive ? 'subject_qa_pair.activated' : 'subject_qa_pair.deactivated',
      entityType: 'subject_qa_pairs',
      entityId: input.pairId,
      eventSummary: `${input.isActive ? 'Activated' : 'Deactivated'} a subject Q&A pair.`,
      oldValues: {
        isActive: existing.is_active,
      },
      newValues: {
        isActive: input.isActive,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    invalidatePreloadedQaPairCache(existing.subject_id);

    return {
      pairId: input.pairId,
      message: `Subject Q&A pair ${input.isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }

  const deleted = await supabase
    .from('subject_qa_pairs')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.actorUserId,
      updated_by: input.actorUserId,
      is_active: false,
      updated_at: updatedAt,
    })
    .eq('id', input.pairId);

  assertSubjectQaPairsAvailable(deleted.error, 'Failed to delete subject Q&A pair.');

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: 'subject_qa_pair.deleted',
    entityType: 'subject_qa_pairs',
    entityId: input.pairId,
    eventSummary: 'Deleted a subject Q&A pair.',
    oldValues: existing,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  invalidatePreloadedQaPairCache(existing.subject_id);

  return {
    pairId: input.pairId,
    message: 'Subject Q&A pair deleted successfully.',
  };
}

export async function uploadSource(
  input: AuditContext & {
    file: File;
    title: string;
    subjectId: string;
    folderId: string;
    categoryId: string | null;
    description: string | null;
    tags: string[];
    sourcePriority: number;
    activateOnSuccess: boolean;
  },
) {
  return uploadAndProcessSource(input);
}

export async function retrySource(input: AuditContext & { sourceId: string }) {
  return retrySourceProcessing(input);
}
