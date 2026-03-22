import { describe, expect, it } from 'vitest';

import { catalogResponseSchema } from './validators';

describe('catalogResponseSchema', () => {
  it('accepts category rows with null subject ids so subjects can still load', () => {
    const parsed = catalogResponseSchema.parse({
      subjects: [
        {
          id: 'subject-1',
          name: 'Information Management',
          slug: 'information-management',
          course_code: 'UGRD-ITE6220',
        },
      ],
      categories: [
        {
          id: 'category-1',
          name: 'Prelim',
          subject_id: null,
        },
      ],
    });

    expect(parsed.subjects).toHaveLength(1);
    expect(parsed.categories[0]?.subject_id).toBeNull();
  });
});
