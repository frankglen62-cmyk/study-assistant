import { categoryRecordSchema, subjectRecordSchema, type CategoryRecord, type SubjectRecord } from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseArray } from './utils';

export interface ActiveCatalog {
  subjects: SubjectRecord[];
  categories: CategoryRecord[];
}

export async function getActiveCatalog(): Promise<ActiveCatalog> {
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

  return {
    subjects: parseArray(subjectsResponse.data ?? [], subjectRecordSchema, 'Subject catalog is invalid.'),
    categories: parseArray(categoriesResponse.data ?? [], categoryRecordSchema, 'Category catalog is invalid.'),
  };
}
