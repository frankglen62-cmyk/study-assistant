'use client';

import { useEffect, useMemo, useState } from 'react';


import type {
  AdminSubjectQaCountResponse,
  AdminFolderMutationResponse,
  AdminSourceMutationResponse,
  AdminSourceUploadResponse,
  AdminSubjectMutationResponse,
  AdminSubjectQaPairListResponse,
  AdminSubjectQaPairMutationResponse,
  QuestionType,
} from '@study-assistant/shared-types';
import { slugify } from '@study-assistant/shared-utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';
import { Plus, XCircle, GripVertical } from 'lucide-react';
import { parseDropdownPairs, serializeDropdownPairs, DROPDOWN_PAIRS_HEADER, type DropdownPair } from '@/lib/ai/dropdown-pairs';

import { useToast } from '@/components/providers/toast-provider';
import type { FolderRecord, SourceFileRecord, SubjectQaPairRecord } from '@/lib/supabase/schemas';

interface SubjectSummary {
  id: string;
  name: string;
  courseCode: string | null;
}

interface AdminSourceManagerProps {
  folders: FolderRecord[];
  sourceFiles: SourceFileRecord[];
  initialQaPairs: SubjectQaPairRecord[];
  qaPairCounts: Record<string, number>;
  subjects: SubjectSummary[];
}

interface QaEditorState {
  editingId: string | null;
  questionText: string;
  answerText: string;
  shortExplanation: string;
  keywordsText: string;
  sortOrder: string;
  isActive: boolean;
  questionType: QuestionType;
  questionImageUrl: string;
}

interface JsonErrorPayload {
  error?: string;
  message?: string;
}

function readJson<T>(response: Response) {
  return response.json() as Promise<T & JsonErrorPayload>;
}

function parseKeywordInput(input: string) {
  return input
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function buildEmptyEditor(sortOrder: number): QaEditorState {
  return {
    editingId: null,
    questionText: '',
    answerText: '',
    shortExplanation: '',
    keywordsText: '',
    sortOrder: String(sortOrder),
    isActive: true,
    questionType: 'multiple_choice' as QuestionType,
    questionImageUrl: '',
  };
}

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '\u{1F4D8}' },
  { value: 'checkbox', label: 'Checkbox', icon: '\u2611\uFE0F' },
  { value: 'fill_in_blank', label: 'Fill in the Blank', icon: '\u270F\uFE0F' },
  { value: 'dropdown', label: 'Dropdown', icon: '\u{1F4CB}' },
  { value: 'picture', label: 'Picture Question', icon: '\u{1F5BC}\uFE0F' },
];

function getQuestionTypeBadge(qt: string) {
  const opt = QUESTION_TYPE_OPTIONS.find(o => o.value === qt);
  return opt ? `${opt.icon} ${opt.label}` : '\u{1F4D8} MC';
}

function getNextSortOrder(pairs: SubjectQaPairRecord[]) {
  return pairs.reduce((highest, pair) => Math.max(highest, pair.sort_order), 0) + 1;
}

function getStatusTone(status: SourceFileRecord['source_status']) {
  switch (status) {
    case 'active':
      return 'success';
    case 'processing':
      return 'warning';
    case 'failed':
      return 'danger';
    case 'archived':
      return 'neutral';
    default:
      return 'accent';
  }
}

function collectSubjectFolderIds(folders: FolderRecord[], subjectId: string) {
  const relatedFolderIds = new Set(folders.filter((folder) => folder.subject_id === subjectId).map((folder) => folder.id));

  let changed = true;
  while (changed) {
    changed = false;

    for (const folder of folders) {
      if (folder.parent_id && relatedFolderIds.has(folder.parent_id) && !relatedFolderIds.has(folder.id)) {
        relatedFolderIds.add(folder.id);
        changed = true;
      }
    }
  }

  return relatedFolderIds;
}

function mapSummaryToRecord(summary: AdminSubjectQaPairListResponse['pairs'][number]): SubjectQaPairRecord {
  return {
    id: summary.id,
    subject_id: summary.subjectId,
    category_id: summary.categoryId,
    question_text: summary.questionText,
    answer_text: summary.answerText,
    short_explanation: summary.shortExplanation,
    keywords: summary.keywords,
    sort_order: summary.sortOrder,
    is_active: summary.isActive,
    deleted_at: null,
    updated_at: summary.updatedAt,
    subjects: summary.subjectName ? { name: summary.subjectName } : null,
    question_type: summary.questionType ?? 'multiple_choice',
    question_image_url: summary.questionImageUrl ?? null,
    categories: summary.categoryName ? { name: summary.categoryName } : null,
  };
}

export function AdminSourceManager({
  folders,
  sourceFiles,
  initialQaPairs,
  qaPairCounts,
  subjects,
}: AdminSourceManagerProps) {

  const { pushToast } = useToast();

  const [subjectRows, setSubjectRows] = useState(subjects);
  const [folderRows, setFolderRows] = useState(folders);
  const [qaPairCountsBySubjectId, setQaPairCountsBySubjectId] = useState(qaPairCounts);
  const [qaPairCache, setQaPairCache] = useState<Record<string, SubjectQaPairRecord[]>>(() => {
    const firstSubjectId = subjects[0]?.id;
    if (!firstSubjectId || initialQaPairs.length === 0) {
      return {};
    }

    return {
      [firstSubjectId]: initialQaPairs,
    };
  });
  const [loadedSubjectIds, setLoadedSubjectIds] = useState<string[]>(() => {
    const firstSubjectId = subjects[0]?.id;
    return firstSubjectId && initialQaPairs.length > 0 ? [firstSubjectId] : [];
  });
  const [sourceFileRows, setSourceFileRows] = useState(sourceFiles);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [subjectFolderSearch, setSubjectFolderSearch] = useState('');
  const [pairSearch, setPairSearch] = useState('');
  const [editor, setEditor] = useState<QaEditorState>(() => buildEmptyEditor(1));
  const [inlineEditor, setInlineEditor] = useState<QaEditorState | null>(null);
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [showCreateSubjectForm, setShowCreateSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [activeTab, setActiveTab] = useState<'qa' | 'add' | 'files' | 'settings'>('qa');
  const [isLoadingSelectedPairs, setIsLoadingSelectedPairs] = useState(false);

  // Unified Add Content state — each pair has full fields
  interface UnifiedPairRow {
    questionText: string;
    answerText: string;
    questionType: QuestionType;
    keywordsText: string;
    shortExplanation: string;
    isActive: boolean;
    showAdvanced: boolean;
  }
  const createEmptyPairRow = (): UnifiedPairRow => ({
    questionText: '',
    answerText: '',
    questionType: 'multiple_choice' as QuestionType,
    keywordsText: '',
    shortExplanation: '',
    isActive: true,
    showAdvanced: false,
  });
  const [unifiedPairs, setUnifiedPairs] = useState<UnifiedPairRow[]>([createEmptyPairRow()]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState<{ saved: number; total: number } | null>(null);
  const [recentlyAddedPairs, setRecentlyAddedPairs] = useState<SubjectQaPairRecord[]>([]);

  // Stored Q&A Library state
  const [qaPairPage, setQaPairPage] = useState(0);
  const [qaPairSort, setQaPairSort] = useState<'sort_order' | 'date' | 'alpha'>('sort_order');
  const QA_PAGE_SIZE = 25;

  useEffect(() => {
    setSubjectRows(subjects);
  }, [subjects]);

  useEffect(() => {
    setFolderRows(folders);
  }, [folders]);

  useEffect(() => {
    setQaPairCountsBySubjectId(qaPairCounts);
  }, [qaPairCounts]);

  // NOTE: We intentionally do NOT sync initialQaPairs into the cache after
  // the first render.  initialQaPairs comes from the server and is always
  // empty (server.ts returns []).  Syncing it would WIPE the client-side
  // cache.  All Q&A data is loaded lazily via loadSubjectPairs().

  useEffect(() => {
    setSourceFileRows(sourceFiles);
  }, [sourceFiles]);

  const subjectRootFolderBySubjectId = useMemo(() => {
    const map = new Map<string, FolderRecord>();

    for (const folder of folderRows) {
      if (folder.folder_type === 'subject_root' && folder.subject_id) {
        map.set(folder.subject_id, folder);
      }
    }

    return map;
  }, [folderRows]);

  const selectedSubject = useMemo(
    () => subjectRows.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjectRows],
  );

  const selectedSubjectPairs = useMemo(
    () => qaPairCache[selectedSubjectId] ?? [],
    [qaPairCache, selectedSubjectId],
  );

  const selectedSubjectFiles = useMemo(
    () => sourceFileRows.filter((file) => file.subject_id === selectedSubjectId),
    [selectedSubjectId, sourceFileRows],
  );

  const selectedRootFolder = selectedSubject ? subjectRootFolderBySubjectId.get(selectedSubject.id) ?? null : null;

  const subjectStatsById = useMemo(() => {
    const map = new Map<
      string,
      {
        pairCount: number;
        fileCount: number;
        hasFolder: boolean;
      }
    >();

    for (const subject of subjectRows) {
      map.set(subject.id, {
        pairCount: qaPairCountsBySubjectId[subject.id] ?? 0,
        fileCount: sourceFileRows.filter((file) => file.subject_id === subject.id).length,
        hasFolder: subjectRootFolderBySubjectId.has(subject.id),
      });
    }

    return map;
  }, [qaPairCountsBySubjectId, sourceFileRows, subjectRootFolderBySubjectId, subjectRows]);

  const filteredSubjects = useMemo(() => {
    const query = subjectFolderSearch.trim().toLowerCase();
    if (!query) {
      return subjectRows;
    }

    return subjectRows.filter((subject) =>
      [subject.name, subject.courseCode ?? '', subjectRootFolderBySubjectId.get(subject.id)?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [subjectFolderSearch, subjectRootFolderBySubjectId, subjectRows]);

  const subjectDropdownOptions = useMemo(() => {
    if (!selectedSubject) {
      return filteredSubjects;
    }

    if (filteredSubjects.some((subject) => subject.id === selectedSubject.id)) {
      return filteredSubjects;
    }

    return [selectedSubject, ...filteredSubjects];
  }, [filteredSubjects, selectedSubject]);

  const filteredPairs = useMemo(() => {
    const query = pairSearch.trim().toLowerCase();
    if (!query) {
      return selectedSubjectPairs;
    }

    // Word-by-word matching: ALL words in the search query must appear
    // somewhere in the pair's combined text. This is much more forgiving
    // than substring matching for long question text searches.
    const queryWords = query.split(/\s+/).filter((w: string) => w.length >= 2);
    if (queryWords.length === 0) {
      return selectedSubjectPairs;
    }

    return selectedSubjectPairs.filter((pair) => {
      const haystack = [pair.question_text, pair.answer_text, pair.short_explanation ?? '', pair.keywords.join(' ')]
        .join(' ')
        .toLowerCase();
      return queryWords.every((word: string) => haystack.includes(word));
    });
  }, [pairSearch, selectedSubjectPairs]);

  // Sorted pairs
  const sortedPairs = useMemo(() => {
    const arr = [...filteredPairs];
    switch (qaPairSort) {
      case 'date':
        arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        break;
      case 'alpha':
        arr.sort((a, b) => a.question_text.localeCompare(b.question_text));
        break;
      case 'sort_order':
      default:
        arr.sort((a, b) => a.sort_order - b.sort_order);
        break;
    }
    return arr;
  }, [filteredPairs, qaPairSort]);

  // Paginated pairs
  const totalQaPairPages = Math.max(1, Math.ceil(sortedPairs.length / QA_PAGE_SIZE));
  const paginatedPairs = useMemo(() => {
    const start = qaPairPage * QA_PAGE_SIZE;
    return sortedPairs.slice(start, start + QA_PAGE_SIZE);
  }, [sortedPairs, qaPairPage, QA_PAGE_SIZE]);

  // Reset page when search/sort/subject changes
  useEffect(() => {
    setQaPairPage(0);
  }, [pairSearch, qaPairSort, selectedSubjectId]);

  useEffect(() => {
    setFolderNameDraft(selectedRootFolder?.name ?? selectedSubject?.name ?? '');
    setIsRenamingFolder(false);
  }, [selectedRootFolder?.id, selectedRootFolder?.name, selectedSubject?.name]);

  async function runAction<T>(actionKey: string, callback: () => Promise<T>) {
    setBusyAction(actionKey);

    try {
      return await callback();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateSubject() {
    const name = newSubjectName.trim();
    const courseCode = newSubjectCode.trim();

    if (name.length < 3 || courseCode.length < 3) {
      pushToast({
        tone: 'warning',
        title: 'Subject details are incomplete',
        description: 'Enter both the subject name and course code before adding the subject folder.',
      });
      return;
    }

    await runAction('create-subject', async () => {
      const response = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          courseCode,
          department: null,
          description: null,
          keywords: [],
          urlPatterns: [],
          isActive: true,
        }),
      });

      const payload = await readJson<AdminSubjectMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create the subject folder.');
      }

      const nextSubject: SubjectSummary = {
        id: payload.subjectId,
        name,
        courseCode,
      };

      setSubjectRows((current) => [...current, nextSubject].sort((left, right) => left.name.localeCompare(right.name)));
      const rootFolderId = payload.folderId ?? null;
      if (rootFolderId) {
        setFolderRows((current) => [
          ...current,
          {
            id: rootFolderId,
            parent_id: null,
            subject_id: payload.subjectId,
            folder_type: 'subject_root',
            name,
            slug: slugify(name),
            sort_order: current.filter((folder) => folder.folder_type === 'subject_root').length,
            is_active: true,
            archived_at: null,
            deleted_at: null,
          },
        ]);
      }

      setSelectedSubjectId(payload.subjectId);
      setNewSubjectName('');
      setNewSubjectCode('');
      setShowCreateSubjectForm(false);

      pushToast({
        tone: 'success',
        title: 'Subject folder added',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Subject creation failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  function resetEditor() {
    setEditor(buildEmptyEditor(getNextSortOrder(selectedSubjectPairs)));
  }

  function resetInlineEditor() {
    setInlineEditor(null);
  }

  function buildEditorFromPair(pair: SubjectQaPairRecord): QaEditorState {
    return {
      editingId: pair.id,
      questionText: pair.question_text,
      answerText: pair.answer_text,
      shortExplanation: pair.short_explanation ?? '',
      keywordsText: pair.keywords.join(', '),
      sortOrder: String(pair.sort_order),
      isActive: pair.is_active,
      questionType: (pair.question_type ?? 'multiple_choice') as QuestionType,
      questionImageUrl: pair.question_image_url ?? '',
    };
  }

  useEffect(() => {
    if (!selectedSubjectId && subjectRows[0]?.id) {
      setSelectedSubjectId(subjectRows[0].id);
    }
  }, [selectedSubjectId, subjectRows]);

  useEffect(() => {
    if (selectedSubjectId && subjectRows.some((subject) => subject.id === selectedSubjectId)) {
      return;
    }

    setSelectedSubjectId(subjectRows[0]?.id ?? '');
  }, [selectedSubjectId, subjectRows]);

  useEffect(() => {
    if (!selectedSubjectId) {
      return;
    }

    setEditor((current) => {
      if (current.editingId) {
        const existingPair = selectedSubjectPairs.find((pair) => pair.id === current.editingId);
        if (existingPair && existingPair.subject_id === selectedSubjectId) {
          return current;
        }
      }

      return buildEmptyEditor(getNextSortOrder(selectedSubjectPairs));
    });
  }, [selectedSubjectId, selectedSubjectPairs]);

  useEffect(() => {
    if (!inlineEditor?.editingId) {
      return;
    }

    const existingPair = selectedSubjectPairs.find((pair) => pair.id === inlineEditor.editingId);
    if (!existingPair || existingPair.subject_id !== selectedSubjectId) {
      setInlineEditor(null);
    }
  }, [inlineEditor?.editingId, selectedSubjectId, selectedSubjectPairs]);

  async function loadSubjectPairCounts() {
    const response = await fetch(`/api/admin/subject-qa/counts?t=${Date.now()}`, {
      cache: 'no-store',
    });
    const payload = await readJson<AdminSubjectQaCountResponse>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? 'Failed to load subject counts.');
    }

    setQaPairCountsBySubjectId(payload.counts);
    return payload.counts;
  }

  async function loadSubjectPairs(subjectId: string, options?: { force?: boolean }) {
    if (!subjectId) {
      return [];
    }

    if (!options?.force && loadedSubjectIds.includes(subjectId)) {
      return qaPairCache[subjectId] ?? [];
    }

    setIsLoadingSelectedPairs(true);

    try {
      const response = await fetch(`/api/admin/subject-qa?subjectId=${encodeURIComponent(subjectId)}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const payload = await readJson<AdminSubjectQaPairListResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load the subject Q&A library.');
      }

      const nextPairs = payload.pairs.map(mapSummaryToRecord);
      setQaPairCache((current) => ({
        ...current,
        [subjectId]: nextPairs,
      }));
      setQaPairCountsBySubjectId((current) => ({
        ...current,
        [subjectId]: nextPairs.length,
      }));
      setLoadedSubjectIds((current) => (current.includes(subjectId) ? current : [...current, subjectId]));

      return nextPairs;
    } finally {
      setIsLoadingSelectedPairs(false);
    }
  }

  async function refreshSubjectLibraryState(subjectId: string) {
    await Promise.all([loadSubjectPairCounts(), loadSubjectPairs(subjectId, { force: true })]);
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadSelectedSubjectPairs() {
      if (!selectedSubjectId) {
        return;
      }

      const expectedCount = qaPairCountsBySubjectId[selectedSubjectId] ?? 0;
      const cachedPairs = qaPairCache[selectedSubjectId] ?? [];
      const needsRecoveryFetch =
        expectedCount > 0 &&
        cachedPairs.length === 0;

      if (!needsRecoveryFetch && loadedSubjectIds.includes(selectedSubjectId)) {
        return;
      }

      try {
        if (isCancelled) {
          return;
        }
        await loadSubjectPairs(selectedSubjectId, { force: needsRecoveryFetch });
      } catch (error) {
        if (!isCancelled) {
          pushToast({
            tone: 'danger',
            title: 'Failed to load Q&A pairs',
            description: error instanceof Error ? error.message : 'Unknown error.',
          });
        }
      } finally {
        // no-op
      }
    }

    void loadSelectedSubjectPairs();

    return () => {
      isCancelled = true;
    };
  }, [loadedSubjectIds, pushToast, qaPairCache, qaPairCountsBySubjectId, selectedSubjectId]);

  // Refresh counts once on mount.  Do NOT include qaPairCache or
  // loadedSubjectIds in the dependency array — that creates a re-run loop
  // because this effect updates those same values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let isCancelled = false;

    async function refreshCounts() {
      try {
        await loadSubjectPairCounts();
        if (isCancelled) {
          return;
        }
      } catch (error) {
        if (!isCancelled) {
          pushToast({
            tone: 'danger',
            title: 'Failed to refresh subject counts',
            description: error instanceof Error ? error.message : 'Unknown error.',
          });
        }
      }
    }

    void refreshCounts();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleCreateSubjectFolder() {
    if (!selectedSubject) {
      return;
    }

    if (selectedRootFolder) {
      pushToast({
        tone: 'warning',
        title: 'Folder already exists',
        description: `${selectedSubject.name} already has a subject folder.`,
      });
      return;
    }

    await runAction(`create-folder-${selectedSubject.id}`, async () => {
      const response = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: null,
          subjectId: selectedSubject.id,
          folderType: 'subject_root',
          name: selectedSubject.name,
          slug: slugify(selectedSubject.name),
          sortOrder: folderRows.filter((folder) => folder.folder_type === 'subject_root').length,
        }),
      });

      const payload = await readJson<AdminFolderMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create the subject folder.');
      }

      setFolderRows((current) => [
        ...current,
        {
          id: payload.folderId,
          parent_id: null,
          subject_id: selectedSubject.id,
          folder_type: 'subject_root',
          name: selectedSubject.name,
          slug: slugify(selectedSubject.name),
          sort_order: current.filter((folder) => folder.folder_type === 'subject_root').length,
          is_active: true,
          archived_at: null,
          deleted_at: null,
        },
      ]);

      pushToast({
        tone: 'success',
        title: 'Subject folder created',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Folder creation failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleRenameSubjectFolder() {
    if (!selectedRootFolder) {
      return;
    }

    const nextName = folderNameDraft.trim();
    if (nextName.length < 2) {
      pushToast({
        tone: 'warning',
        title: 'Folder name is too short',
        description: 'Use at least 2 characters for the subject folder name.',
      });
      return;
    }

    await runAction(`rename-folder-${selectedRootFolder.id}`, async () => {
      const response = await fetch(`/api/admin/folders/${selectedRootFolder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rename',
          name: nextName,
          slug: slugify(nextName),
        }),
      });

      const payload = await readJson<AdminFolderMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to rename the subject folder.');
      }

      setFolderRows((current) =>
        current.map((folder) =>
          folder.id === selectedRootFolder.id
            ? {
                ...folder,
                name: nextName,
                slug: slugify(nextName),
              }
            : folder,
        ),
      );
      setIsRenamingFolder(false);

      pushToast({
        tone: 'success',
        title: 'Subject folder renamed',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Rename failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleDeleteSubjectFolder() {
    if (!selectedRootFolder || !selectedSubject) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the entire subject folder "${selectedRootFolder.name}"?\n\nThis will remove the subject, all stored Q&A pairs, and optional files from Sources. This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    await runAction(`delete-subject-${selectedSubject.id}`, async () => {
      const response = await fetch(`/api/admin/subjects/${selectedSubject.id}`, {
        method: 'DELETE',
      });

      const payload = await readJson<AdminSubjectMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete the subject folder.');
      }

      const deletedFolderIds = collectSubjectFolderIds(folderRows, selectedSubject.id);
      const remainingSubjects = subjectRows.filter((subject) => subject.id !== selectedSubject.id);

      setSubjectRows(remainingSubjects);
      setFolderRows((current) => current.filter((folder) => !deletedFolderIds.has(folder.id)));
      setQaPairCache((current) => {
        const next = { ...current };
        delete next[selectedSubject.id];
        return next;
      });
      setLoadedSubjectIds((current) => current.filter((id) => id !== selectedSubject.id));
      setQaPairCountsBySubjectId((current) => {
        const next = { ...current };
        delete next[selectedSubject.id];
        return next;
      });
      setSourceFileRows((current) => current.filter((file) => file.subject_id !== selectedSubject.id));
      setSelectedSubjectId(remainingSubjects[0]?.id ?? '');
      setFolderNameDraft('');
      setIsRenamingFolder(false);
      resetEditor();
      resetInlineEditor();

      pushToast({
        tone: 'success',
        title: 'Subject deleted',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function savePairDraft(draft: QaEditorState, mode: 'top' | 'inline') {
    if (!selectedSubject) {
      pushToast({
        tone: 'warning',
        title: 'No subject selected',
        description: 'Select a subject folder first.',
      });
      return;
    }

    const questionText = draft.questionText.trim();
    const answerText = draft.answerText.trim();

    if (questionText.length < 1 || answerText.length < 1) {
      pushToast({
        tone: 'warning',
        title: 'Incomplete Q&A pair',
        description: 'Both question and answer fields are required (even short ones like "what" are allowed).',
      });
      return;
    }

    const sortOrderValue = Number.parseInt(draft.sortOrder, 10);
    const sortOrder = Number.isFinite(sortOrderValue) && sortOrderValue >= 0 ? sortOrderValue : getNextSortOrder(selectedSubjectPairs);
    const keywords = parseKeywordInput(draft.keywordsText);
    const shortExplanation = draft.shortExplanation.trim() || null;
    const actionKey =
      mode === 'inline'
        ? draft.editingId
          ? `inline-save-pair-${draft.editingId}`
          : 'inline-create-pair'
        : draft.editingId
          ? `save-pair-${draft.editingId}`
          : 'create-pair';

    await runAction(actionKey, async () => {
      const basePayload = {
        subjectId: selectedSubject.id,
        categoryId: null,
        questionText,
        answerText,
        shortExplanation,
        keywords,
        sortOrder,
        isActive: draft.isActive,
        questionType: draft.questionType ?? 'multiple_choice',
        questionImageUrl: draft.questionImageUrl || null,
      };

      const response = await fetch(
        draft.editingId ? `/api/admin/subject-qa/${draft.editingId}` : '/api/admin/subject-qa',
        {
          method: draft.editingId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            draft.editingId
              ? {
                  action: 'update',
                  ...basePayload,
                }
              : basePayload,
          ),
        },
      );

      const payload = await readJson<AdminSubjectQaPairMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save the Q&A pair.');
      }

      const nextPair: SubjectQaPairRecord = {
        id: payload.pairId,
        subject_id: selectedSubject.id,
        category_id: null,
        question_text: questionText,
        answer_text: answerText,
        short_explanation: shortExplanation,
        keywords,
        sort_order: sortOrder,
        is_active: draft.isActive,
        question_type: draft.questionType ?? 'multiple_choice',
        question_image_url: draft.questionImageUrl || null,
        deleted_at: null,
        updated_at: new Date().toISOString(),
        subjects: {
          name: selectedSubject.name,
        },
        categories: null,
      };

      setQaPairCache((current) => {
        const currentPairs = current[selectedSubject.id] ?? [];
        let nextPairs: SubjectQaPairRecord[];
        
        if (draft.editingId) {
          nextPairs = currentPairs
            .map((pair) => (pair.id === draft.editingId ? nextPair : pair))
            .sort((left, right) => left.sort_order - right.sort_order || right.updated_at.localeCompare(left.updated_at));
        } else {
          // Put the newest pair consistently at the front, so it doesn't "disappear" out of view
          nextPairs = [nextPair, ...currentPairs]; 
        }

        return {
          ...current,
          [selectedSubject.id]: nextPairs,
        };
      });
      setLoadedSubjectIds((current) => (current.includes(selectedSubject.id) ? current : [...current, selectedSubject.id]));
      setQaPairCountsBySubjectId((current) => ({
        ...current,
        [selectedSubject.id]: draft.editingId ? current[selectedSubject.id] ?? 0 : (current[selectedSubject.id] ?? 0) + 1,
      }));

      if (!draft.editingId && mode === 'top') {
        setRecentlyAddedPairs((current) => [nextPair, ...current]);
      }

      pushToast({
        tone: 'success',
        title: draft.editingId ? 'Q&A pair updated' : 'Q&A pair added',
        description: payload.message,
      });

      if (mode === 'inline') {
        resetInlineEditor();
      } else {
        resetEditor();
      }
    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleSavePair() {
    await savePairDraft(editor, 'top');
  }

  async function handleSaveInlinePair() {
    if (!inlineEditor) {
      return;
    }

    await savePairDraft(inlineEditor, 'inline');
  }

  function startEditingPair(pair: SubjectQaPairRecord) {
    setSelectedSubjectId(pair.subject_id);
    setInlineEditor(buildEditorFromPair(pair));
  }

  async function handleTogglePair(pair: SubjectQaPairRecord) {
    const pairSubjectId = pair.subject_id;

    await runAction(`toggle-pair-${pair.id}`, async () => {
      const response = await fetch(`/api/admin/subject-qa/${pair.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_activation',
          isActive: !pair.is_active,
        }),
      });

      const payload = await readJson<AdminSubjectQaPairMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update activation.');
      }

      setQaPairCache((current) => ({
        ...current,
        [pairSubjectId]: (current[pairSubjectId] ?? []).map((entry) =>
          entry.id === pair.id
            ? {
                ...entry,
                is_active: !pair.is_active,
                updated_at: new Date().toISOString(),
              }
            : entry,
        ),
      }));
      await refreshSubjectLibraryState(pairSubjectId);

      if (editor.editingId === pair.id) {
        setEditor((current) => ({ ...current, isActive: !pair.is_active }));
      }

      if (inlineEditor?.editingId === pair.id) {
        setInlineEditor((current) => (current ? { ...current, isActive: !pair.is_active } : current));
      }

      pushToast({
        tone: 'success',
        title: !pair.is_active ? 'Pair activated' : 'Pair deactivated',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Activation update failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleDeletePair(pair: SubjectQaPairRecord) {
    const pairSubjectId = pair.subject_id;
    const confirmText = window.prompt("Type 'DELETE' to confirm removing this Q&A pair from the subject library.");
    if (confirmText !== 'DELETE') {
      return;
    }

    await runAction(`delete-pair-${pair.id}`, async () => {
      const response = await fetch(`/api/admin/subject-qa/${pair.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
        }),
      });

      const payload = await readJson<AdminSubjectQaPairMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete the Q&A pair.');
      }

      setQaPairCache((current) => ({
        ...current,
        [pairSubjectId]: (current[pairSubjectId] ?? []).filter((entry) => entry.id !== pair.id),
      }));
      setQaPairCountsBySubjectId((current) => ({
        ...current,
        [pairSubjectId]: Math.max((current[pairSubjectId] ?? 1) - 1, 0),
      }));
      await refreshSubjectLibraryState(pairSubjectId);
      if (editor.editingId === pair.id) {
        resetEditor();
      }

      if (inlineEditor?.editingId === pair.id) {
        resetInlineEditor();
      }

      pushToast({
        tone: 'success',
        title: 'Q&A pair deleted',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleUploadFile() {
    if (!selectedSubject || !selectedRootFolder || !uploadFile) {
      pushToast({
        tone: 'warning',
        title: 'File upload not ready',
        description: 'Choose a subject folder and a file first.',
      });
      return;
    }

    const title = uploadTitle.trim() || uploadFile.name;
    const formData = new FormData();
    formData.set('file', uploadFile);
    formData.set('title', title);
    formData.set('subjectId', selectedSubject.id);
    formData.set('folderId', selectedRootFolder.id);
    formData.set('tags', uploadTags.trim());
    formData.set('sourcePriority', '0');
    formData.set('activateOnSuccess', 'true');

    await runAction(`upload-${selectedSubject.id}`, async () => {
      const response = await fetch('/api/admin/sources/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = await readJson<AdminSourceUploadResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to upload the source file.');
      }

      setSourceFileRows((current) => [
        {
          id: payload.sourceId,
          folder_id: selectedRootFolder.id,
          subject_id: selectedSubject.id,
          category_id: null,
          title,
          source_status: payload.status,
          version_number: 1,
          processing_error: null,
          source_priority: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          activated_at: payload.status === 'active' ? new Date().toISOString() : null,
          profiles: null,
          subjects: {
            name: selectedSubject.name,
          },
          categories: null,
        },
        ...current,
      ]);

      setUploadFile(null);
      setUploadTitle('');
      setUploadTags('');
      setUploadInputKey((current) => current + 1);

      pushToast({
        tone: 'success',
        title: 'File uploaded',
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleReloadSelectedSubjectLibrary() {
    if (!selectedSubjectId) {
      return;
    }

    await runAction(`reload-subject-${selectedSubjectId}`, async () => {
      await refreshSubjectLibraryState(selectedSubjectId);

      pushToast({
        tone: 'success',
        title: 'Subject library reloaded',
        description: 'The latest Q&A pairs and counts were fetched from the server.',
      });
    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'Reload failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  async function handleFileAction(
    file: SourceFileRecord,
    body: Record<string, unknown>,
    successTitle: string,
  ) {
    await runAction(`file-${file.id}`, async () => {
      const response = await fetch(`/api/admin/sources/${file.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = await readJson<AdminSourceMutationResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update the source file.');
      }

      setSourceFileRows((current) =>
        current.map((entry) =>
          entry.id === file.id
            ? {
                ...entry,
                source_status: payload.status,
                updated_at: new Date().toISOString(),
              }
            : entry,
        ),
      );

      pushToast({
        tone: 'success',
        title: successTitle,
        description: payload.message,
      });    }).catch((error: unknown) => {
      pushToast({
        tone: 'danger',
        title: 'File update failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    });
  }

  if (!subjectRows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No subjects yet</CardTitle>
          <CardDescription>Add a subject folder first, then build its private Q&A library here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_240px]">
            <Input
              value={newSubjectName}
              onChange={(event) => setNewSubjectName(event.target.value)}
              placeholder="Subject name"
            />
            <Input
              value={newSubjectCode}
              onChange={(event) => setNewSubjectCode(event.target.value)}
              placeholder="Course code"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreateSubject()} disabled={busyAction === 'create-subject'}>
              {busyAction === 'create-subject' ? 'Adding subject...' : 'Add subject folder'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card className="overflow-hidden rounded-xl border border-border/40 shadow-card">
        <CardHeader className="space-y-4 border-b border-border/40 bg-surface/30 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Subject folders</CardTitle>
              <CardDescription className="text-xs">
                Search, jump, and manage one subject library at a time.
              </CardDescription>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => setShowCreateSubjectForm((current) => !current)}>
              {showCreateSubjectForm ? 'Close' : '+ Add subject'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex-1 min-w-[240px] max-w-sm">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Quick select</label>
              <select
                value={selectedSubjectId}
                onChange={(event) => { setSelectedSubjectId(event.target.value); setRecentlyAddedPairs([]); }}
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/20"
              >
                {subjectDropdownOptions.map((subject) => (
                  <option key={subject.id} value={subject.id} className="bg-background text-foreground">
                    {subject.name}
                    {subject.courseCode ? ` / ${subject.courseCode}` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 min-w-[240px] max-w-sm">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Search subjects</label>
              <Input
                value={subjectFolderSearch}
                onChange={(event) => setSubjectFolderSearch(event.target.value)}
                placeholder="Search by name..."
                className="rounded-xl border border-border/40 bg-surface/30 h-10 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-4 pt-5">
          {showCreateSubjectForm ? (
            <div className="space-y-3 rounded-[24px] border border-border/50 bg-background/35 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject name</label>
                <Input
                  value={newSubjectName}
                  onChange={(event) => setNewSubjectName(event.target.value)}
                  placeholder="Integrative Programming and Technology 1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Course code</label>
                <Input
                  value={newSubjectCode}
                  onChange={(event) => setNewSubjectCode(event.target.value)}
                  placeholder="UGRD-IT6302"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowCreateSubjectForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void handleCreateSubject()} disabled={busyAction === 'create-subject'}>
                  {busyAction === 'create-subject' ? 'Adding...' : 'Save subject'}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Header Card with Navigation */}
        <div className="rounded-xl border border-border/40 bg-background shadow-card-hover overflow-hidden flex flex-col pt-6 sm:pt-8 w-full">
          <div className="px-6 sm:px-8 pb-6 border-b border-border/40 bg-surface/30">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="accent">Current subject folder</Badge>
                  {selectedRootFolder ? <Badge tone="success">Library ready</Badge> : <Badge tone="warning">Setup missing</Badge>}
                </div>
                <CardTitle className="mt-4 text-3xl font-display font-bold tracking-tight">
                  {(selectedRootFolder?.name ?? selectedSubject?.name) ?? 'Select a subject'}
                </CardTitle>
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedSubject?.courseCode ? <span className="font-mono uppercase tracking-[0.2em]">{selectedSubject.courseCode}</span> : 'No course code set'}
                </div>
              </div>
              {selectedRootFolder && (
                <div className="flex shrink-0 items-center gap-6 rounded-xl bg-surface/50 px-6 py-4 border border-border/40">
                  <div className="text-center">
                    <p className="font-display text-3xl text-foreground">{qaPairCountsBySubjectId[selectedSubjectId] ?? selectedSubjectPairs.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Q&A Pairs</p>
                  </div>
                  <div className="h-12 w-px bg-border/40" />
                  <div className="text-center">
                    <p className="font-display text-3xl text-foreground">{selectedSubjectFiles.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Files</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedRootFolder && (
            <div className="flex overflow-x-auto px-6 sm:px-8 gap-6 border-b border-border/40 bg-surface/30 no-scrollbar pt-3 text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('qa')}
                className={`pb-3 transition-all whitespace-nowrap border-b-2 ${
                  activeTab === 'qa' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Stored Q&A Library
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className={`pb-3 transition-all whitespace-nowrap border-b-2 ${
                  activeTab === 'add' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                + Add Content
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('files')}
                className={`pb-3 transition-all whitespace-nowrap border-b-2 ${
                  activeTab === 'files' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Supporting Files
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`pb-3 transition-all whitespace-nowrap border-b-2 ${
                  activeTab === 'settings' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Folder Settings
              </button>
            </div>
          )}
        </div>

        <div className="min-h-[400px]">
          {!selectedRootFolder ? (
            <Card className="rounded-2xl border border-amber-200/60 dark:border-amber-500/20 shadow-card bg-amber-50/30 dark:bg-amber-500/5">
              <CardContent className="space-y-4 pt-12 pb-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-border/40 bg-background text-foreground mb-6 shadow-soft-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20V8H4v12zM12 2v6"></path></svg>
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground">Subject folder not initialized</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Create the subject folder here to enable Q&A storage and supporting feature files for this subject.
                </p>
                <div className="mt-8">
                  <Button
                    onClick={() => void handleCreateSubjectFolder()}
                    disabled={busyAction === `create-folder-${selectedSubjectId}`}
                    className="px-8 shadow-soft-sm"
                  >
                    {busyAction === `create-folder-${selectedSubjectId}` ? 'Creating folder...' : 'Initialize Subject Folder'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeTab === 'qa' && (
                <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle>Q&A Library Explorer</CardTitle>
                        <CardDescription>
                          Review, search, edit, deactivate, and delete the answer pairs stored inside {selectedSubject?.name}.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone="accent">
                          {isLoadingSelectedPairs
                            ? 'Loading pairs...'
                            : `${filteredPairs.length} visible pair${filteredPairs.length === 1 ? '' : 's'}`}
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!selectedSubjectId || busyAction === `reload-subject-${selectedSubjectId}`}
                          onClick={() => void handleReloadSelectedSubjectLibrary()}
                        >
                          {busyAction === `reload-subject-${selectedSubjectId}` ? 'Reloading...' : 'Reload subject'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Input
                      value={pairSearch}
                      onChange={(event) => setPairSearch(event.target.value)}
                      placeholder="Search this subject folder by question, answer, or keyword..."
                      className="h-12 text-base rounded-[20px] bg-background/50 border-border/80 focus-visible:ring-accent"
                    />


                    {/* Sort + Count Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Showing {Math.min(paginatedPairs.length, QA_PAGE_SIZE)} of {sortedPairs.length} pair{sortedPairs.length === 1 ? '' : 's'}
                        {pairSearch.trim() ? ` matching ""${pairSearch.trim()}""` : ''}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Sort:</span>
                        {([["sort_order", "Order"], ["date", "Newest"], ["alpha", "A-Z"]] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${qaPairSort === value ? "bg-accent text-accent-foreground" : "bg-background/50 text-muted-foreground border border-border/40 hover:bg-background/80"}`}
                            onClick={() => setQaPairSort(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isLoadingSelectedPairs ? (
                      <div className="rounded-[28px] border border-dashed border-border/60 bg-background/20 p-10 text-center text-sm text-muted-foreground">
                        Loading stored Q&A pairs for this subject folder...
                      </div>
                    ) : !sortedPairs.length ? (
                      <div className="rounded-[28px] border border-dashed border-border/60 bg-background/20 p-10 text-center text-sm text-muted-foreground">
                        {selectedSubjectPairs.length
                          ? 'No stored pairs match your current search.'
                          : 'No Q&A pairs have been added to this subject folder yet. Switch to the "Add Content" tab to begin.'}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {paginatedPairs.map((pair) => (
                          <div key={pair.id} className="group overflow-hidden rounded-[28px] border border-border/40 bg-surface/40 p-1 transition-all hover:border-border/80 hover:shadow-md">
                            <div className="rounded-[24px] bg-background/80 p-5">
                              {inlineEditor?.editingId === pair.id ? (
                                <div className="space-y-5">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">Editing Mode</p>
                                      <p className="mt-1 text-sm text-muted-foreground">Update the fields below and save.</p>
                                    </div>
                                    <Badge tone={inlineEditor.isActive ? 'success' : 'warning'}>{inlineEditor.isActive ? 'Active' : 'Inactive'}</Badge>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="space-y-2 rounded-[24px] border border-border/30 bg-background/50 p-4">
                                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question</label>
                                      <Textarea
                                        value={inlineEditor.questionText}
                                        onChange={(event) => setInlineEditor((current) => (current ? { ...current, questionText: event.target.value } : current))}
                                        className="min-h-[100px] border-none bg-transparent resize-none p-0 focus-visible:ring-0"
                                      />
                                    </div>
                                    <div className="space-y-2 rounded-[24px] border border-border/30 bg-background/50 p-4">
                                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Answer</label>
                                      {inlineEditor.questionType === 'checkbox' ? (
                                        <div className="space-y-2 mt-2 w-full pr-4 pb-4">
                                          {(inlineEditor.answerText || '').split(' | ').map((ans, i, arr) => (
                                            <div key={i} className="flex gap-2 items-center">
                                              <span className="text-muted-foreground/50 opacity-50"><GripVertical size={14} /></span>
                                              <Input
                                                type="text"
                                                value={ans}
                                                placeholder={`Checkbox answer option ${i + 1}`}
                                                className="h-8 text-sm flex w-full rounded-md border border-input bg-background/50 px-3 py-1 shadow-sm"
                                                onChange={(e) => {
                                                  const nextArr = [...arr];
                                                  nextArr[i] = e.target.value;
                                                  setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                                }}
                                              />
                                              <button
                                                type="button"
                                                title="Remove this option"
                                                className="text-muted-foreground hover:text-danger p-1 rounded-md"
                                                onClick={() => {
                                                  const nextArr = arr.filter((_, idx) => idx !== i);
                                                  setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                                }}
                                              >
                                                <XCircle size={16} />
                                              </button>
                                            </div>
                                          ))}
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                              const nextArr = [...(inlineEditor.answerText ? inlineEditor.answerText.split(' | ') : []), ''];
                                              setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                            }}
                                            className="h-8 mt-2 w-full border-dashed border-2 flex items-center justify-center gap-1 text-muted-foreground"
                                          >
                                            <Plus size={14} /> Add an option
                                          </Button>
                                        </div>
                                      ) : inlineEditor.questionType === 'dropdown' ? (
                                        <div className="space-y-3 mt-2 w-full pr-4 pb-4">
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sub-question / Answer Pairs</p>
                                          {(() => {
                                            const pairs = parseDropdownPairs(inlineEditor.answerText) ?? [{ subPrompt: '', answer: '' }];
                                            return (
                                              <>
                                                {pairs.map((dp, i) => (
                                                  <div key={i} className="flex gap-2 items-start">
                                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent mt-1">{i + 1}</span>
                                                    <div className="flex-1 space-y-1.5">
                                                      <Input
                                                        type="text"
                                                        value={dp.subPrompt}
                                                        placeholder={`Sub-question ${i + 1} (e.g. "A device that converts analog to digital")`}
                                                        className="h-8 text-sm"
                                                        onChange={(e) => {
                                                          const nextPairs = [...pairs];
                                                          nextPairs[i] = { ...nextPairs[i]!, subPrompt: e.target.value };
                                                          setInlineEditor((current) => (current ? { ...current, answerText: serializeDropdownPairs(nextPairs) } : current));
                                                        }}
                                                      />
                                                      <Input
                                                        type="text"
                                                        value={dp.answer}
                                                        placeholder={`Answer ${i + 1} (e.g. "Modem")`}
                                                        className="h-8 text-sm border-success/30 focus-visible:ring-success/50"
                                                        onChange={(e) => {
                                                          const nextPairs = [...pairs];
                                                          nextPairs[i] = { ...nextPairs[i]!, answer: e.target.value };
                                                          setInlineEditor((current) => (current ? { ...current, answerText: serializeDropdownPairs(nextPairs) } : current));
                                                        }}
                                                      />
                                                    </div>
                                                    <button
                                                      type="button"
                                                      title="Remove this pair"
                                                      className="text-muted-foreground hover:text-danger p-1 rounded-md mt-1"
                                                      onClick={() => {
                                                        const nextPairs = pairs.filter((_, idx) => idx !== i);
                                                        setInlineEditor((current) => (current ? { ...current, answerText: nextPairs.length > 0 ? serializeDropdownPairs(nextPairs) : '' } : current));
                                                      }}
                                                    >
                                                      <XCircle size={16} />
                                                    </button>
                                                  </div>
                                                ))}
                                                <Button
                                                  type="button"
                                                  variant="secondary"
                                                  size="sm"
                                                  onClick={() => {
                                                    const nextPairs = [...pairs, { subPrompt: '', answer: '' }];
                                                    setInlineEditor((current) => (current ? { ...current, answerText: serializeDropdownPairs(nextPairs) } : current));
                                                  }}
                                                  className="h-8 mt-2 w-full border-dashed border-2 flex items-center justify-center gap-1 text-muted-foreground"
                                                >
                                                  <Plus size={14} /> Add sub-question pair
                                                </Button>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      ) : (
                                      <Textarea
                                        value={inlineEditor.answerText}
                                        onChange={(event) => setInlineEditor((current) => (current ? { ...current, answerText: event.target.value } : current))}
                                        className="min-h-[100px] border-none bg-transparent resize-none p-0 focus-visible:ring-0"
                                      />
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px]">
                                    <div className="space-y-2">
                                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Keywords</label>
                                      <Input value={inlineEditor.keywordsText} onChange={(event) => setInlineEditor((current) => (current ? { ...current, keywordsText: event.target.value } : current))} placeholder="force, current..." />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Short explanation</label>
                                      <Input value={inlineEditor.shortExplanation} onChange={(event) => setInlineEditor((current) => (current ? { ...current, shortExplanation: event.target.value } : current))} placeholder="Optional explanation" />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Sort order</label>
                                      <Input type="number" min={0} value={inlineEditor.sortOrder} onChange={(event) => setInlineEditor((current) => (current ? { ...current, sortOrder: event.target.value } : current))} />
                                    </div>
                                  </div>

                                  {/* Inline question type selector */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question Type</label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {QUESTION_TYPE_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${inlineEditor.questionType === opt.value ? 'bg-accent text-accent-foreground border-accent' : 'bg-background/50 text-muted-foreground border-border/30 hover:bg-background/60'}`}
                                          onClick={() => setInlineEditor((current) => current ? { ...current, questionType: opt.value } : current)}
                                        >
                                          <span>{opt.icon}</span>
                                          <span>{opt.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <label className="flex items-center gap-3 rounded-[20px] border border-border/30 bg-background/40 px-4 py-3 text-sm text-foreground cursor-pointer transition-colors hover:bg-background/60">
                                    <input type="checkbox" className="h-4 w-4 accent-accent rounded" checked={inlineEditor.isActive} onChange={(event) => setInlineEditor((current) => (current ? { ...current, isActive: event.target.checked } : current))} />
                                    Use this pair in extension retrieval immediately
                                  </label>

                                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Updated {formatTimestamp(pair.updated_at)}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button size="sm" variant="secondary" onClick={resetInlineEditor}>Cancel</Button>
                                      <Button size="sm" onClick={() => void handleSaveInlinePair()} disabled={busyAction === `inline-save-pair-${pair.id}`}>
                                        {busyAction === `inline-save-pair-${pair.id}` ? 'Saving changes...' : 'Save changes'}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">Q</div>
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question</p>
                                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{getQuestionTypeBadge(pair.question_type ?? 'multiple_choice')}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 pl-8">{pair.question_text}</p>
                                    </div>
                                    <div className="space-y-3 relative before:absolute before:inset-y-0 before:-left-2 before:w-px before:bg-border/30 xl:pl-4 xl:before:block before:hidden">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 text-xs font-bold text-success">A</div>
                                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Answer</p>
                                        </div>
                                        <Badge tone={pair.is_active ? 'success' : 'warning'} className="scale-90 opacity-80 group-hover:opacity-100 transition-opacity">
                                          {pair.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </div>
                                                                            {pair.question_type === 'checkbox' ? (
                                        <ul className="pl-12 space-y-2 mt-1">
                                          {(pair.answer_text || '').split(' | ').filter(Boolean).map((ans, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                              <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                                              <span className="text-[15px] leading-snug font-medium text-foreground">{ans.trim()}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : pair.question_type === 'picture' && pair.answer_text.startsWith('[IMG:') ? (
                                        <div className="flex items-center gap-2 pl-8 mt-1">
                                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-sm">🖼️</span>
                                          <code className="text-sm font-mono bg-surface/60 px-2 py-1 rounded-lg text-foreground">
                                            {pair.answer_text.slice(5, -1)}
                                          </code>
                                          <span className="text-[10px] text-muted-foreground/60">(image filename)</span>
                                        </div>
                                      ) : pair.question_type === 'dropdown' && pair.answer_text.startsWith(DROPDOWN_PAIRS_HEADER) ? (
                                        <div className="pl-8 space-y-1.5 mt-1">
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Dropdown Sub-Pairs ({(parseDropdownPairs(pair.answer_text) ?? []).length})</p>
                                          {(parseDropdownPairs(pair.answer_text) ?? []).map((dp, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm">
                                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">{i + 1}</span>
                                              <span className="text-foreground/70 min-w-0 truncate max-w-[180px]" title={dp.subPrompt}>{dp.subPrompt}</span>
                                              <span className="text-muted-foreground/50">→</span>
                                              <span className="font-medium text-foreground truncate min-w-0" title={dp.answer}>{dp.answer}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="whitespace-pre-wrap text-[15px] cursor-text selection:bg-accent/30 leading-relaxed text-foreground font-medium pl-8">
                                          {pair.answer_text}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-6 flex flex-wrap gap-2 pl-8">
                                    <Badge tone="neutral" className="bg-background/50 border-border/30">Sort {pair.sort_order}</Badge>
                                    {pair.keywords.map((keyword) => (
                                      <Badge key={`${pair.id}-${keyword}`} tone="neutral" className="bg-background/50 border-border/30">{keyword}</Badge>
                                    ))}
                                  </div>

                                  {pair.short_explanation && (
                                    <p className="mt-4 text-sm italic text-muted-foreground pl-8 border-l-2 border-accent/30 ml-8">{pair.short_explanation}</p>
                                  )}

                                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Updated {formatTimestamp(pair.updated_at)}</p>
                                    <div className="flex flex-wrap gap-2 opacity-50 transition-opacity group-hover:opacity-100">
                                      <Button size="sm" variant="secondary" className="h-8 shadow-sm" onClick={() => startEditingPair(pair)}>Edit</Button>
                                      <Button size="sm" variant="secondary" className="h-8 shadow-sm" disabled={busyAction === `toggle-pair-${pair.id}`} onClick={() => void handleTogglePair(pair)}>
                                        {busyAction === `toggle-pair-${pair.id}` ? '...' : pair.is_active ? 'Deactivate' : 'Activate'}
                                      </Button>
                                      <Button size="sm" variant="danger" className="h-8 shadow-sm" disabled={busyAction === `delete-pair-${pair.id}`} onClick={() => void handleDeletePair(pair)}>
                                        {busyAction === `delete-pair-${pair.id}` ? '...' : 'Delete'}
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pagination controls */}
                    {totalQaPairPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={qaPairPage === 0}
                          onClick={() => setQaPairPage((p) => Math.max(0, p - 1))}
                          className="h-8 px-3"
                        >
                          ← Prev
                        </Button>
                        <span className="text-sm text-muted-foreground px-3">
                          Page {qaPairPage + 1} of {totalQaPairPages}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={qaPairPage >= totalQaPairPages - 1}
                          onClick={() => setQaPairPage((p) => Math.min(totalQaPairPages - 1, p + 1))}
                          className="h-8 px-3"
                        >
                          Next →
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeTab === 'add' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* â”€â”€ Unified Add Q&A Pairs â”€â”€ */}
                  <Card className="shadow-lg border-accent/20">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle>Add Q&A Pairs</CardTitle>
                          <CardDescription>
                            Add one or more question-answer pairs to {selectedSubject?.name}. Fill in each pair then click &quot;Save All&quot; to store them.
                          </CardDescription>
                        </div>
                        <Badge tone="accent">{unifiedPairs.length} pair{unifiedPairs.length === 1 ? '' : 's'} queued</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {unifiedPairs.map((pair, index) => (
                        <div key={index} className="rounded-[24px] border border-border/40 bg-surface/20 p-5 space-y-4 transition-all hover:border-border/60">
                          {/* Pair header */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground shadow-sm">{index + 1}</span>
                              <span className="text-sm font-semibold text-foreground">Pair {index + 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={pair.isActive ? 'success' : 'warning'} className="scale-90">
                                {pair.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {unifiedPairs.length > 1 && (
                                <button
                                  type="button"
                                  className="p-1.5 text-muted-foreground hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                                  onClick={() => setUnifiedPairs((current) => current.filter((_, i) => i !== index))}
                                >
                                  <XCircle size={18} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Question Type */}
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Question Type</label>
                            <div className="flex flex-wrap gap-1.5">
                              {QUESTION_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${pair.questionType === opt.value ? 'bg-accent text-accent-foreground border-accent shadow-sm' : 'bg-background/50 text-muted-foreground border-border/40 hover:bg-background/80'}`}
                                  onClick={() => setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, questionType: opt.value } : p))}
                                  disabled={!selectedRootFolder}
                                >
                                  <span>{opt.icon}</span>
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Question + Answer */}
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground font-bold">Q</span> Question
                              </label>
                              <Textarea
                                value={pair.questionText}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, questionText: value } : p));
                                }}
                                placeholder="Enter the question text..."
                                className="min-h-[90px] text-sm resize-none"
                                disabled={!selectedRootFolder}
                              />
                              {pair.questionType === 'picture' && (
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 cursor-pointer group">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors">
                                      📷 Upload question image
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp,image/gif"
                                      className="hidden"
                                      disabled={!selectedRootFolder}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        try {
                                          const res = await fetch('/api/admin/question-images', { method: 'POST', body: formData });
                                          const data = await res.json() as { url?: string; error?: string };
                                          if (!res.ok) throw new Error(data.error ?? 'Upload failed');
                                          // Append [IMG_URL:...] to question text
                                          setUnifiedPairs((current) => current.map((p, i) => i === index ? {
                                            ...p,
                                            questionText: (p.questionText ? p.questionText + '\n' : '') + `[IMG_URL:${data.url}]`,
                                          } : p));
                                          pushToast({ tone: 'success', title: 'Image uploaded', description: 'Question image added.' });
                                        } catch (err) {
                                          pushToast({ tone: 'danger', title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error' });
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                  {/* Show preview of uploaded question images */}
                                  {pair.questionText.includes('[IMG_URL:') && (
                                    <div className="flex flex-wrap gap-2">
                                      {(pair.questionText.match(/\[IMG_URL:([^\]]+)\]/g) ?? []).map((match, imgIdx) => {
                                        const url = match.slice(9, -1);
                                        return (
                                          <div key={imgIdx} className="relative group/img">
                                            <img src={url} alt="Question" className="h-16 w-auto rounded-lg border border-border/40 object-contain bg-white" />
                                            <button
                                              type="button"
                                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                              onClick={() => {
                                                setUnifiedPairs((current) => current.map((p, i) => i === index ? {
                                                  ...p,
                                                  questionText: p.questionText.replace(match, '').replace(/\n{2,}/g, '\n').trim(),
                                                } : p));
                                              }}
                                            >✕</button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                                    💡 Upload an image if the <strong>question itself</strong> is a picture. You can also type <code className="bg-surface/60 px-1 py-0.5 rounded text-[10px] font-mono">[IMG:filename.png]</code> for filename-based matching.
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground font-bold">A</span>
                                {pair.questionType === 'picture' ? 'Answer (upload correct image)' : 'Answer'}
                              </label>
                              {pair.questionType === 'picture' ? (
                                <div className="space-y-3">
                                  {/* Image upload area */}
                                  {pair.answerText && (pair.answerText.startsWith('[IMG_URL:') || pair.answerText.startsWith('http')) ? (
                                    <div className="relative group/ans-img">
                                      <div className="rounded-xl border-2 border-success/30 bg-white p-3 flex items-center gap-3">
                                        <img
                                          src={pair.answerText.startsWith('[IMG_URL:') ? pair.answerText.slice(9, -1) : pair.answerText}
                                          alt="Answer"
                                          className="h-20 w-auto rounded-lg object-contain"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-success">✓ Answer image uploaded</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{pair.answerText.startsWith('[IMG_URL:') ? pair.answerText.slice(9, -1).split('/').pop() : pair.answerText.split('/').pop()}</p>
                                        </div>
                                        <button
                                          type="button"
                                          className="p-1.5 text-muted-foreground hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                                          onClick={() => setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: '' } : p))}
                                        >
                                          <XCircle size={18} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-success/30 bg-success/5 p-6 hover:bg-success/10 transition-colors">
                                      <span className="text-3xl">📤</span>
                                      <span className="text-sm font-medium text-success">Click to upload the correct answer image</span>
                                      <span className="text-[11px] text-muted-foreground">PNG, JPEG, WebP • Max 5MB</span>
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        className="hidden"
                                        disabled={!selectedRootFolder}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const formData = new FormData();
                                          formData.append('file', file);
                                          try {
                                            const res = await fetch('/api/admin/question-images', { method: 'POST', body: formData });
                                            const data = await res.json() as { url?: string; error?: string };
                                            if (!res.ok) throw new Error(data.error ?? 'Upload failed');
                                            setUnifiedPairs((current) => current.map((p, i) => i === index ? {
                                              ...p,
                                              answerText: `[IMG_URL:${data.url}]`,
                                            } : p));
                                            pushToast({ tone: 'success', title: 'Image uploaded', description: 'Answer image saved.' });
                                          } catch (err) {
                                            pushToast({ tone: 'danger', title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error' });
                                          }
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  )}
                                  {/* Fallback: manual filename entry */}
                                  {!pair.answerText.startsWith('[IMG_URL:') && !pair.answerText.startsWith('http') && (
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Or enter image filename manually:</p>
                                      <div className="flex gap-2 items-center">
                                        <span className="text-xs text-muted-foreground font-mono shrink-0">[IMG:</span>
                                        <Input
                                          value={
                                            pair.answerText.startsWith('[IMG:') && pair.answerText.endsWith(']')
                                              ? pair.answerText.slice(5, -1)
                                              : pair.answerText
                                          }
                                          onChange={(event) => {
                                            const raw = event.target.value.trim();
                                            const value = raw ? `[IMG:${raw}]` : '';
                                            setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: value } : p));
                                          }}
                                          placeholder="e.g. multivalu att.PNG"
                                          className="text-sm font-mono h-8"
                                          disabled={!selectedRootFolder}
                                        />
                                        <span className="text-xs text-muted-foreground font-mono shrink-0">]</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : pair.questionType === 'checkbox' ? (
                                <div className="space-y-2">
                                  {(pair.answerText || '').split(' | ').map((ans, ansIdx, arr) => (
                                    <div key={ansIdx} className="flex gap-2 items-center">
                                      <span className="text-muted-foreground/30"><GripVertical size={14} /></span>
                                      <Input
                                        type="text"
                                        value={ans}
                                        placeholder={`Checkbox option ${ansIdx + 1}`}
                                        className="text-sm"
                                        disabled={!selectedRootFolder}
                                        onChange={(e) => {
                                          const nextArr = [...arr];
                                          nextArr[ansIdx] = e.target.value;
                                          setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: nextArr.join(' | ') } : p));
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="p-1 text-muted-foreground hover:text-danger rounded-md"
                                        onClick={() => {
                                          const nextArr = arr.filter((_, idx) => idx !== ansIdx);
                                          setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: nextArr.join(' | ') } : p));
                                        }}
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!selectedRootFolder}
                                    onClick={() => {
                                      const nextArr = [...(pair.answerText ? pair.answerText.split(' | ') : []), ''];
                                      setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: nextArr.join(' | ') } : p));
                                    }}
                                    className="w-full border-dashed border-2 flex items-center justify-center gap-1 text-muted-foreground"
                                  >
                                    <Plus size={14} /> Add checkbox option
                                  </Button>
                                </div>
                              ) : pair.questionType === 'dropdown' ? (
                                <div className="space-y-3">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sub-question / Answer Pairs</p>
                                  {(() => {
                                    const dpPairs = parseDropdownPairs(pair.answerText) ?? [{ subPrompt: '', answer: '' }];
                                    return (
                                      <>
                                        {dpPairs.map((dp, dpIdx) => (
                                          <div key={dpIdx} className="flex gap-2 items-start">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent mt-1">{dpIdx + 1}</span>
                                            <div className="flex-1 space-y-1.5">
                                              <Input
                                                type="text"
                                                value={dp.subPrompt}
                                                placeholder={`Sub-question ${dpIdx + 1} (e.g. "A device that converts analog to digital")`}
                                                className="h-8 text-sm"
                                                disabled={!selectedRootFolder}
                                                onChange={(e) => {
                                                  const nextPairs = [...dpPairs];
                                                  nextPairs[dpIdx] = { ...nextPairs[dpIdx]!, subPrompt: e.target.value };
                                                  setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: serializeDropdownPairs(nextPairs) } : p));
                                                }}
                                              />
                                              <Input
                                                type="text"
                                                value={dp.answer}
                                                placeholder={`Answer ${dpIdx + 1} (e.g. "Modem")`}
                                                className="h-8 text-sm border-success/30 focus-visible:ring-success/50"
                                                disabled={!selectedRootFolder}
                                                onChange={(e) => {
                                                  const nextPairs = [...dpPairs];
                                                  nextPairs[dpIdx] = { ...nextPairs[dpIdx]!, answer: e.target.value };
                                                  setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: serializeDropdownPairs(nextPairs) } : p));
                                                }}
                                              />
                                            </div>
                                            {dpPairs.length > 1 && (
                                              <button
                                                type="button"
                                                className="p-1 text-muted-foreground hover:text-danger rounded-md mt-1"
                                                onClick={() => {
                                                  const nextPairs = dpPairs.filter((_, idx) => idx !== dpIdx);
                                                  setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: nextPairs.length > 0 ? serializeDropdownPairs(nextPairs) : '' } : p));
                                                }}
                                              >
                                                <XCircle size={16} />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          disabled={!selectedRootFolder}
                                          onClick={() => {
                                            const nextPairs = [...dpPairs, { subPrompt: '', answer: '' }];
                                            setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: serializeDropdownPairs(nextPairs) } : p));
                                          }}
                                          className="w-full border-dashed border-2 flex items-center justify-center gap-1 text-muted-foreground"
                                        >
                                          <Plus size={14} /> Add sub-question pair
                                        </Button>
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <Textarea
                                  value={pair.answerText}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, answerText: value } : p));
                                  }}
                                  placeholder="Enter the precise answer..."
                                  className="min-h-[90px] text-sm resize-none"
                                  disabled={!selectedRootFolder}
                                />
                              )}
                            </div>
                          </div>

                          {/* Advanced toggle */}
                          <button
                            type="button"
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, showAdvanced: !p.showAdvanced } : p))}
                          >
                            <span className={`transition-transform ${pair.showAdvanced ? 'rotate-90' : ''}`}>â–¶</span>
                            {pair.showAdvanced ? 'Hide advanced options' : 'Show advanced options (keywords, explanation)'}
                          </button>

                          {pair.showAdvanced && (
                            <div className="grid gap-4 lg:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Keywords (comma-separated)</label>
                                <Input
                                  value={pair.keywordsText}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, keywordsText: value } : p));
                                  }}
                                  placeholder="force, current, volts..."
                                  disabled={!selectedRootFolder}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Short explanation</label>
                                <Input
                                  value={pair.shortExplanation}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, shortExplanation: value } : p));
                                  }}
                                  placeholder="Optional context for this pair..."
                                  disabled={!selectedRootFolder}
                                />
                              </div>
                              <div className="col-span-full">
                                <label className="flex items-center gap-3 rounded-[20px] border border-border/40 bg-background/50 px-4 py-3 text-sm text-foreground cursor-pointer transition-colors hover:bg-background/80">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-accent rounded"
                                    checked={pair.isActive}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      setUnifiedPairs((current) => current.map((p, i) => i === index ? { ...p, isActive: checked } : p));
                                    }}
                                    disabled={!selectedRootFolder}
                                  />
                                  Use this pair in extension retrieval immediately
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add Another Pair button */}
                      <Button
                        variant="secondary"
                        className="w-full h-12 rounded-[20px] border-dashed border-2 border-border/60 hover:border-accent/60 hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all"
                        onClick={() => setUnifiedPairs((current) => [...current, createEmptyPairRow()])}
                        disabled={!selectedRootFolder}
                      >
                        <Plus size={16} className="mr-2" /> Add Another Pair
                      </Button>

                      {/* Save progress */}
                      {batchSaveProgress && (
                        <div className="space-y-2">
                          <div className="rounded-[16px] bg-accent/10 border border-accent/30 px-5 py-3 text-sm text-accent font-medium">
                            Saving {batchSaveProgress.saved} / {batchSaveProgress.total} pairs...
                          </div>
                          <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-300"
                              style={{ width: `${(batchSaveProgress.saved / batchSaveProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/40">
                        <Button
                          variant="secondary"
                          className="px-6"
                          onClick={() => setUnifiedPairs([createEmptyPairRow()])}
                          disabled={isSavingBatch}
                        >
                          Reset All
                        </Button>
                        <Button
                          className="px-8 shadow-lg shadow-accent/20"
                          disabled={
                            !selectedSubject ||
                            !selectedRootFolder ||
                            isSavingBatch ||
                            unifiedPairs.every((p) => !p.questionText.trim() || !p.answerText.trim())
                          }
                          onClick={async () => {
                            if (!selectedSubject) return;
                            const validPairs = unifiedPairs.filter((p) => p.questionText.trim() && p.answerText.trim());
                            if (validPairs.length === 0) {
                              pushToast({ tone: 'warning', title: 'No valid pairs', description: 'Fill in at least one question and answer.' });
                              return;
                            }
                            setIsSavingBatch(true);
                            setBatchSaveProgress({ saved: 0, total: validPairs.length });
                            const baseSortOrder = getNextSortOrder(selectedSubjectPairs);
                            try {
                              const response = await fetch('/api/admin/subject-qa/batch', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  pairs: validPairs.map((p, i) => ({
                                    subjectId: selectedSubject.id,
                                    categoryId: null,
                                    questionText: p.questionText.trim(),
                                    answerText: p.answerText.trim(),
                                    shortExplanation: p.shortExplanation.trim() || null,
                                    keywords: parseKeywordInput(p.keywordsText),
                                    sortOrder: baseSortOrder + i,
                                    isActive: p.isActive,
                                    questionType: p.questionType ?? 'multiple_choice',
                                  })),
                                }),
                              });
                              const result = await response.json() as { savedCount: number; failedCount: number; pairIds: string[]; message: string };
                              const savedCount = result.savedCount ?? 0;
                              const failedCount = result.failedCount ?? 0;
                              setBatchSaveProgress({ saved: savedCount, total: validPairs.length });

                              const newPairs: SubjectQaPairRecord[] = (result.pairIds ?? []).map((pairId: string, i: number) => ({
                                id: pairId,
                                subject_id: selectedSubject.id,
                                category_id: null,
                                question_type: validPairs[i]!.questionType ?? 'multiple_choice',
                                question_image_url: null,
                                question_text: validPairs[i]!.questionText.trim(),
                                answer_text: validPairs[i]!.answerText.trim(),
                                short_explanation: validPairs[i]!.shortExplanation.trim() || null,
                                keywords: parseKeywordInput(validPairs[i]!.keywordsText),
                                sort_order: baseSortOrder + i,
                                is_active: validPairs[i]!.isActive,
                                deleted_at: null,
                                updated_at: new Date().toISOString(),
                                subjects: { name: selectedSubject.name },
                                categories: null,
                              }));

                              if (newPairs.length > 0) {
                                setQaPairCache((current) => ({
                                  ...current,
                                  [selectedSubject.id]: [...newPairs, ...(current[selectedSubject.id] ?? [])],
                                }));
                                setQaPairCountsBySubjectId((current) => ({
                                  ...current,
                                  [selectedSubject.id]: (current[selectedSubject.id] ?? 0) + newPairs.length,
                                }));
                                setRecentlyAddedPairs((current) => [...newPairs, ...current]);
                              }

                              setUnifiedPairs([createEmptyPairRow()]);
                              pushToast({
                                tone: failedCount === 0 ? 'success' : 'warning',
                                title: 'Pairs saved',
                                description: `${savedCount} pair${savedCount === 1 ? '' : 's'} saved${failedCount > 0 ? `, ${failedCount} failed` : ''} to ${selectedSubject.name}.`,
                              });
                            } catch (error) {
                              pushToast({
                                tone: 'danger',
                                title: 'Save failed',
                                description: error instanceof Error ? error.message : 'Unknown error.',
                              });
                            }
                            setBatchSaveProgress(null);
                            setIsSavingBatch(false);
                          }}
                        >
                          {isSavingBatch ? 'Saving...' : `Save All ${unifiedPairs.filter((p) => p.questionText.trim() && p.answerText.trim()).length} Pair${unifiedPairs.filter((p) => p.questionText.trim() && p.answerText.trim()).length === 1 ? '' : 's'}`}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* â”€â”€ Recently Added Pairs â”€â”€ */}
                  {recentlyAddedPairs.length > 0 && (
                    <Card className="shadow-lg border-success/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <CardTitle>Recently Added</CardTitle>
                            <CardDescription>
                              Pairs added during this session. They are saved to the database and will be used by the extension.
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone="success">{recentlyAddedPairs.length} added</Badge>
                            <Button size="sm" variant="secondary" onClick={() => setRecentlyAddedPairs([])}>Clear list</Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {recentlyAddedPairs.map((pair) => (
                          <div key={pair.id} className="rounded-[20px] border border-success/20 bg-success/5 p-4 transition-all hover:bg-success/10">
                            <div className="grid gap-4 xl:grid-cols-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] uppercase tracking-[0.15em] text-success font-semibold">Question</p>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{getQuestionTypeBadge(pair.question_type ?? 'multiple_choice')}</span>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{pair.question_text}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-success font-semibold">Answer</p>
                                <p className="text-sm text-foreground font-medium whitespace-pre-wrap">{pair.answer_text}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge tone="success" className="scale-90">Saved âœ“</Badge>
                              {pair.short_explanation && <span className="text-xs text-muted-foreground italic">{pair.short_explanation}</span>}
                              {pair.keywords.length > 0 && <span className="text-xs text-muted-foreground">Keywords: {pair.keywords.join(', ')}</span>}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === 'files' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="shadow-lg mb-6">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Supporting File Sources</CardTitle>
                          <CardDescription>
                            Upload and manage documents to supplement Q&A pairs for this subject.
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedSubjectFiles.length > 0 && (
                            <Badge tone="neutral">
                              {selectedSubjectFiles.filter((f) => f.source_status === 'active').length} active / {selectedSubjectFiles.length} total
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] rounded-[24px] bg-background/30 p-5 border border-border/40">
                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Choose file</label>
                          <Input key={uploadInputKey} type="file" className="cursor-pointer file:cursor-pointer pb-2" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} disabled={!selectedRootFolder} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Display title</label>
                          <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="Optional custom title" disabled={!selectedRootFolder} />
                        </div>
                        <div className="space-y-2 flex flex-col justify-end">
                          <Button className="w-full shadow-md" disabled={!selectedRootFolder || !uploadFile || busyAction === `upload-${selectedSubjectId}`} onClick={() => void handleUploadFile()}>
                            {busyAction === `upload-${selectedSubjectId}` ? 'Uploading...' : 'Upload File'}
                          </Button>
                        </div>
                      </div>

                      {!selectedSubjectFiles.length ? (
                        <div className="rounded-[28px] border border-dashed border-border/60 bg-background/20 p-12 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border/40 bg-background text-muted-foreground mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                          </div>
                          <p className="text-sm font-medium text-foreground">No files uploaded yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">Upload PDFs, documents, or text files to supplement the Q&A library.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedSubjectFiles.map((file) => (
                            <div key={file.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border/40 bg-surface/30 p-5 transition-all hover:bg-surface/50 hover:shadow-sm">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📄</span>
                                  <p className="truncate font-semibold text-foreground text-base">{file.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground pl-7">
                                  Updated {formatTimestamp(file.updated_at)}
                                  {file.processing_error ? ` — Error: ${file.processing_error}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={getStatusTone(file.source_status)}>{file.source_status}</Badge>
                                <Button size="sm" variant="secondary" className="h-8" disabled={busyAction === `file-${file.id}` || file.source_status === 'processing'} onClick={() => void handleFileAction(file, { action: 'set_activation', active: file.source_status !== 'active' }, file.source_status === 'active' ? 'File deactivated' : 'File activated')}>
                                  {file.source_status === 'active' ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button size="sm" variant="secondary" className="h-8" disabled={busyAction === `file-${file.id}` || file.source_status === 'archived'} onClick={() => void handleFileAction(file, { action: 'archive' }, 'File archived')}>
                                  Archive
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Folder Statistics */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle>Folder Overview</CardTitle>
                      <CardDescription>Quick statistics for the {selectedRootFolder.name} folder.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-[20px] border border-border/40 bg-background/50 p-5 text-center">
                          <p className="text-3xl font-bold text-accent">{selectedSubjectPairs.length}</p>
                          <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Q&A Pairs</p>
                        </div>
                        <div className="rounded-[20px] border border-border/40 bg-background/50 p-5 text-center">
                          <p className="text-3xl font-bold text-success">{selectedSubjectPairs.filter((p) => p.is_active).length}</p>
                          <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Pairs</p>
                        </div>
                        <div className="rounded-[20px] border border-border/40 bg-background/50 p-5 text-center">
                          <p className="text-3xl font-bold text-warning">{selectedSubjectPairs.filter((p) => !p.is_active).length}</p>
                          <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Inactive Pairs</p>
                        </div>
                        <div className="rounded-[20px] border border-border/40 bg-background/50 p-5 text-center">
                          <p className="text-3xl font-bold text-foreground">{selectedSubjectFiles.length}</p>
                          <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Supporting Files</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Folder Configuration */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle>Folder Configuration</CardTitle>
                      <CardDescription>Manage the {selectedRootFolder.name} folder settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4 rounded-[28px] border border-border/50 bg-background/40 p-6">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <div className="space-y-2 w-full max-w-md">
                            <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Folder Name</label>
                            {isRenamingFolder ? (
                              <div className="flex flex-wrap gap-2">
                                <Input value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} placeholder="Folder name" className="flex-1" />
                                <Button size="sm" onClick={() => void handleRenameSubjectFolder()} disabled={busyAction === `rename-folder-${selectedRootFolder.id}`}>
                                  {busyAction === `rename-folder-${selectedRootFolder.id}` ? 'Saving...' : 'Save'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setIsRenamingFolder(false)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <p className="font-display text-lg font-semibold">{selectedRootFolder.name}</p>
                                <Button size="sm" variant="secondary" onClick={() => setIsRenamingFolder(true)}>Change Name</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bulk Actions */}
                      <div className="space-y-4 rounded-[28px] border border-accent/20 bg-accent/5 p-6">
                        <div>
                          <h4 className="font-semibold text-accent">Bulk Actions</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Quickly activate or deactivate all Q&A pairs in this subject folder at once.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="secondary"
                            disabled={
                              !selectedSubject ||
                              busyAction === 'bulk-activate' ||
                              selectedSubjectPairs.every((p) => p.is_active)
                            }
                            onClick={async () => {
                              if (!selectedSubject) return;
                              const inactivePairs = selectedSubjectPairs.filter((p) => !p.is_active);
                              if (inactivePairs.length === 0) {
                                pushToast({ tone: 'info', title: 'All pairs are already active', description: 'No changes needed.' });
                                return;
                              }
                              setBusyAction('bulk-activate');
                              try {
                                for (const pair of inactivePairs) {
                                  await fetch(`/api/admin/subject-qa/${pair.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'set_active', isActive: true }),
                                  });
                                }
                                setQaPairCache((current) => ({
                                  ...current,
                                  [selectedSubject.id]: (current[selectedSubject.id] ?? []).map((p) => ({ ...p, is_active: true })),
                                }));
                                pushToast({ tone: 'success', title: 'All pairs activated', description: `${inactivePairs.length} pair${inactivePairs.length === 1 ? '' : 's'} activated.` });
                              } catch (error) {
                                pushToast({ tone: 'danger', title: 'Bulk activate failed', description: error instanceof Error ? error.message : 'Unknown error.' });
                              }
                              setBusyAction(null);
                            }}
                          >
                            {busyAction === 'bulk-activate' ? 'Activating...' : `Activate All (${selectedSubjectPairs.filter((p) => !p.is_active).length} inactive)`}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={
                              !selectedSubject ||
                              busyAction === 'bulk-deactivate' ||
                              selectedSubjectPairs.every((p) => !p.is_active)
                            }
                            onClick={async () => {
                              if (!selectedSubject) return;
                              const activePairs = selectedSubjectPairs.filter((p) => p.is_active);
                              if (activePairs.length === 0) {
                                pushToast({ tone: 'info', title: 'All pairs are already inactive', description: 'No changes needed.' });
                                return;
                              }
                              const confirmed = window.confirm(`Deactivate all ${activePairs.length} active Q&A pairs? They will stop appearing in extension answers until reactivated.`);
                              if (!confirmed) return;
                              setBusyAction('bulk-deactivate');
                              try {
                                for (const pair of activePairs) {
                                  await fetch(`/api/admin/subject-qa/${pair.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'set_active', isActive: false }),
                                  });
                                }
                                setQaPairCache((current) => ({
                                  ...current,
                                  [selectedSubject.id]: (current[selectedSubject.id] ?? []).map((p) => ({ ...p, is_active: false })),
                                }));
                                pushToast({ tone: 'success', title: 'All pairs deactivated', description: `${activePairs.length} pair${activePairs.length === 1 ? '' : 's'} deactivated.` });
                              } catch (error) {
                                pushToast({ tone: 'danger', title: 'Bulk deactivate failed', description: error instanceof Error ? error.message : 'Unknown error.' });
                              }
                              setBusyAction(null);
                            }}
                          >
                            {busyAction === 'bulk-deactivate' ? 'Deactivating...' : `Deactivate All (${selectedSubjectPairs.filter((p) => p.is_active).length} active)`}
                          </Button>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="space-y-4 rounded-[28px] border border-danger/20 bg-danger/5 p-6">
                        <div>
                          <h4 className="font-semibold text-danger">Danger Zone</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Deleting this subject removes the folder from the sidebar and deletes all Q&A pairs and optional files stored under it permanently.
                          </p>
                        </div>
                        <Button variant="danger" disabled={busyAction === `delete-subject-${selectedSubject?.id ?? ''}`} onClick={() => void handleDeleteSubjectFolder()}>
                          {busyAction === `delete-subject-${selectedSubject?.id ?? ''}` ? 'Deleting Subject...' : 'Delete Subject Folder'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
