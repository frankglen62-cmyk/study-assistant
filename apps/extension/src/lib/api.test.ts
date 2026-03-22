import { describe, expect, it } from 'vitest';

import { parseCatalogResponse } from './api';

describe('parseCatalogResponse', () => {
  it('recovers the subject list even when category subject ids are malformed', () => {
    const parsed = parseCatalogResponse({
      subjects: [
        {
          id: 'subject-1',
          name: 'Calculus-Based Physics 2',
          slug: 'calculus-based-physics-2',
          course_code: 'UGRD-NSCI6101',
        },
      ],
      categories: [
        {
          id: 'category-1',
          name: 'Legacy row',
          subject_id: 12345,
        },
      ],
    });

    expect(parsed.subjects).toHaveLength(1);
    expect(parsed.subjects[0]?.name).toBe('Calculus-Based Physics 2');
    expect(parsed.categories[0]?.subject_id).toBeNull();
  });
});
