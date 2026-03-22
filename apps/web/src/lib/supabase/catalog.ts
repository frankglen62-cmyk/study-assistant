import { categoryRecordSchema, subjectRecordSchema, type CategoryRecord, type SubjectRecord } from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseArray } from './utils';

export interface ActiveCatalog {
  subjects: SubjectRecord[];
  categories: CategoryRecord[];
}

const CATALOG_CACHE_TTL_MS = 3_000;

let activeCatalogCache: { value: ActiveCatalog; expiresAt: number } | null = null;
let activeCatalogPromise: Promise<ActiveCatalog> | null = null;

export function invalidateActiveCatalogCache() {
  activeCatalogCache = null;
  activeCatalogPromise = null;
}

export async function getActiveCatalog(): Promise<ActiveCatalog> {
  const now = Date.now();
  if (activeCatalogCache && activeCatalogCache.expiresAt > now) {
    return activeCatalogCache.value;
  }

  if (activeCatalogPromise) {
    return activeCatalogPromise;
  }

  activeCatalogPromise = (async () => {
    const supabase = getSupabaseAdmin();
    const [subjectsResponse, categoriesResponse] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, name, slug, course_code, department, description, keywords, url_patterns, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('categories')
        .select('id, subject_id, name, slug, default_keywords, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    assertSupabaseResult(subjectsResponse.error, 'Failed to load subject catalog.');
    assertSupabaseResult(categoriesResponse.error, 'Failed to load category catalog.');

    const value = {
      subjects: parseArray(subjectsResponse.data ?? [], subjectRecordSchema, 'Subject catalog is invalid.'),
      categories: parseArray(categoriesResponse.data ?? [], categoryRecordSchema, 'Category catalog is invalid.'),
    };

    activeCatalogCache = {
      value,
      expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    };

    return value;
  })().finally(() => {
    activeCatalogPromise = null;
  });

  return activeCatalogPromise;
}
