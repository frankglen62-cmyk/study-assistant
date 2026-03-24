import { subjectQaPairRecordSchema, type SubjectQaPairRecord } from '@/lib/supabase/schemas';

import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseArray } from './utils';

async function fetchSubjectQaBatch(offset: number, pageSize: number) {
  const supabase = getSupabaseAdmin();
  return supabase
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
      deleted_at,
      updated_at,
      subjects:subject_id (
        name
      ),
      categories:category_id (
        name
      )
    `)
    .is('deleted_at', null)
    .order('subject_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);
}

export async function listAdminSubjectQaPairs(): Promise<SubjectQaPairRecord[]> {
  const pageSize = 1000;
  const rows: unknown[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchSubjectQaBatch(offset, pageSize);

    if (error) {
      const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
        return [];
      }
    }

    assertSupabaseResult(error, 'Failed to load subject Q&A pairs.');

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return parseArray(rows, subjectQaPairRecordSchema, 'Subject Q&A rows are invalid.');
}

export async function listAdminSubjectQaPairsBySubjectId(subjectId: string): Promise<SubjectQaPairRecord[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: unknown[] = [];
  let offset = 0;

  while (true) {
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
        deleted_at,
        updated_at,
        subjects:subject_id (
          name
        ),
        categories:category_id (
          name
        )
      `)
      .eq('subject_id', subjectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
        return [];
      }
    }

    assertSupabaseResult(error, 'Failed to load subject Q&A pairs.');

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return parseArray(rows, subjectQaPairRecordSchema, 'Subject Q&A rows are invalid.');
}

export async function countAdminSubjectQaPairsBySubjectIds(subjectIds: string[]) {
  if (subjectIds.length === 0) {
    return new Map<string, number>();
  }

  const supabase = getSupabaseAdmin();
  const counts = new Map(subjectIds.map((subjectId) => [subjectId, 0]));
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('subject_qa_pairs')
      .select('subject_id')
      .in('subject_id', subjectIds)
      .is('deleted_at', null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
        return counts;
      }
    }

    assertSupabaseResult(error, 'Failed to count subject Q&A pairs.');

    const batch = data ?? [];
    for (const row of batch) {
      const subjectId = row.subject_id;
      if (!subjectId) {
        continue;
      }

      counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
    }

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return counts;
}
