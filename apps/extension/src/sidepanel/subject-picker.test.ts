import { describe, expect, it } from 'vitest';

import { getSubjectDisplayLabel, getSubjectSuggestions, type SubjectCatalogEntry } from './subject-picker';

const SUBJECTS: SubjectCatalogEntry[] = [
  {
    id: '1',
    name: 'Calculus-Based Physics 2',
    course_code: 'UGRD-NSCI6101',
    slug: 'calculus-based-physics-2',
  },
  {
    id: '2',
    name: 'Information Assurance and Security 2',
    course_code: 'UGRD-IT6206',
    slug: 'information-assurance-and-security-2',
  },
  {
    id: '3',
    name: 'Information Management',
    course_code: 'UGRD-ITE6220',
    slug: 'information-management',
  },
];

describe('subject picker suggestions', () => {
  it('surfaces prefix matches from just two letters', () => {
    const suggestions = getSubjectSuggestions(SUBJECTS, 'ca');

    expect(suggestions[0]?.name).toBe('Calculus-Based Physics 2');
  });

  it('matches course-code searches too', () => {
    const suggestions = getSubjectSuggestions(SUBJECTS, 'ite6');

    expect(suggestions[0]?.name).toBe('Information Management');
  });

  it('returns full display labels with course codes when available', () => {
    expect(getSubjectDisplayLabel(SUBJECTS[2]!)).toBe('Information Management / UGRD-ITE6220');
  });
});
