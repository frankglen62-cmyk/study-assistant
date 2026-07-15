import { createHash, randomUUID } from 'node:crypto';
import { inflateRawSync, inflateSync } from 'node:zlib';

import type { SourceStatus } from '@study-assistant/shared-types';

import { slugify } from '@study-assistant/shared-utils';

import { createEmbedding, extractTextFromImageDataUrl } from '@/lib/ai/openai';
import { env } from '@/lib/env/server';
import { RouteError } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

const SOURCE_BUCKET = 'private-sources';
const MAX_CHUNK_CHARS = 1400;
const CHUNK_OVERLAP_CHARS = 220;
const MAX_ARCHIVE_ENTRIES = 512;
const MAX_ARCHIVE_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_PDF_STREAMS = 2048;
const MAX_EXTRACTED_TEXT_CHARS = 2_500_000;
const MAX_SOURCE_CHUNKS = 2200;

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface SourceRecord {
  id: string;
  folder_id: string;
  subject_id: string;
  category_id: string | null;
  title: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  source_status: SourceStatus;
  source_priority: number;
  tags: string[];
  description: string | null;
}

interface AuditContext {
  actorUserId: string;
  actorRole: 'super_admin' | 'admin' | 'client';
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface SourceUploadInput extends AuditContext {
  file: File;
  title: string;
  subjectId: string;
  folderId: string;
  categoryId: string | null;
  description: string | null;
  tags: string[];
  sourcePriority: number;
  activateOnSuccess: boolean;
}

interface SourceMutationResult {
  sourceId: string;
  status: SourceStatus;
  processedChunks: number;
  message: string;
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

function toDataUrl(mimeType: string, buffer: Buffer) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function sanitizeStorageName(input: string) {
  const dotIndex = input.lastIndexOf('.');
  const base = dotIndex >= 0 ? input.slice(0, dotIndex) : input;
  const ext = dotIndex >= 0 ? input.slice(dotIndex).toLowerCase() : '';
  const normalizedBase = slugify(base).slice(0, 80) || 'source';
  return `${normalizedBase}${ext}`;
}

function assertSupportedUpload(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  const supportedExtensions = new Set(['pdf', 'docx', 'pptx', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp']);

  if (file.size <= 0) {
    throw new RouteError(400, 'empty_file', 'Uploaded source files must not be empty.');
  }

  if (file.size > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    throw new RouteError(400, 'file_too_large', `File exceeds the ${env.MAX_UPLOAD_SIZE_MB} MB upload limit.`);
  }

  if (!allowedMimeTypes.has(file.type || 'application/octet-stream') && !supportedExtensions.has(extension)) {
    throw new RouteError(400, 'unsupported_file_type', 'This file type is not supported for ingestion.');
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\n')
    .replace(/&#xA;/gi, '\n')
    .replace(/&#xD;/gi, '\n');
}

function stripXml(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<\/(w:p|a:p|p:txBody|text:p|w:tr)>/g, '\n')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function extractPrintableText(buffer: Buffer) {
  const printable = buffer
    .toString('latin1')
    .match(/[A-Za-z0-9][A-Za-z0-9 .,;:?!()[\]{}"'`/@%&*+\-_=\n\r]{4,}/g);

  return normalizeWhitespace((printable ?? []).join('\n'));
}

function assertExtractedTextBudget(value: string) {
  if (value.length > MAX_EXTRACTED_TEXT_CHARS) {
    throw new RouteError(
      422,
      'source_expanded_too_large',
      `Extracted source text exceeds the ${MAX_EXTRACTED_TEXT_CHARS.toLocaleString()}-character safety limit.`,
    );
  }

  return value;
}

function assertCompressionBudget(params: { compressedBytes: number; expandedBytes: number }) {
  if (params.expandedBytes > MAX_ARCHIVE_ENTRY_BYTES) {
    throw new RouteError(422, 'archive_entry_too_large', 'A compressed document entry exceeds the expanded-size limit.');
  }

  const ratio = params.expandedBytes / Math.max(1, params.compressedBytes);
  if (ratio > MAX_COMPRESSION_RATIO) {
    throw new RouteError(422, 'archive_ratio_too_large', 'A compressed document entry exceeds the safe expansion ratio.');
  }
}

function readZipEntries(buffer: Buffer, includeEntry: (filename: string) => boolean) {
  const entries = new Map<string, Buffer>();
  let eocdOffset = -1;

  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new RouteError(422, 'zip_parse_failed', 'The Office document could not be parsed as a zip archive.');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new RouteError(422, 'archive_entry_limit', `Compressed documents may contain at most ${MAX_ARCHIVE_ENTRIES} entries.`);
  }

  if (centralDirectoryOffset < 0 || centralDirectoryOffset >= buffer.length) {
    throw new RouteError(422, 'zip_parse_failed', 'The Office document central directory offset is invalid.');
  }

  let pointer = centralDirectoryOffset;
  let expandedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (pointer < 0 || pointer + 46 > buffer.length) {
      throw new RouteError(422, 'zip_parse_failed', 'The Office document central directory is truncated.');
    }

    if (buffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw new RouteError(422, 'zip_parse_failed', 'The Office document central directory is invalid.');
    }

    const compressionMethod = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const declaredExpandedSize = buffer.readUInt32LE(pointer + 24);
    const fileNameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localHeaderOffset = buffer.readUInt32LE(pointer + 42);
    const nextPointer = pointer + 46 + fileNameLength + extraLength + commentLength;
    if (nextPointer > buffer.length) {
      throw new RouteError(422, 'zip_parse_failed', 'The Office document entry metadata is truncated.');
    }
    const filename = buffer.slice(pointer + 46, pointer + 46 + fileNameLength).toString('utf8');

    if (!includeEntry(filename)) {
      pointer = nextPointer;
      continue;
    }

    assertCompressionBudget({ compressedBytes: compressedSize, expandedBytes: declaredExpandedSize });
    if (expandedBytes + declaredExpandedSize > MAX_ARCHIVE_EXPANDED_BYTES) {
      throw new RouteError(422, 'archive_expanded_too_large', 'The compressed document exceeds the total expanded-size limit.');
    }

    if (localHeaderOffset < 0 || localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new RouteError(422, 'zip_parse_failed', 'The Office document local entry header is invalid.');
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart < 0 || dataStart + compressedSize > buffer.length) {
      throw new RouteError(422, 'zip_parse_failed', 'The Office document entry data is truncated.');
    }
    const compressedData = buffer.slice(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedData, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
    } else {
      pointer = nextPointer;
      continue;
    }

    assertCompressionBudget({ compressedBytes: compressedSize, expandedBytes: data.length });
    expandedBytes += data.length;
    if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
      throw new RouteError(422, 'archive_expanded_too_large', 'The compressed document exceeds the total expanded-size limit.');
    }

    entries.set(filename, data);
    pointer = nextPointer;
  }

  return entries;
}

function extractOfficeDocumentText(buffer: Buffer, kind: 'docx' | 'pptx') {
  const includeEntry =
    kind === 'docx'
      ? (name: string) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name)
      : (name: string) => /^ppt\/slides\/slide\d+\.xml$/i.test(name);
  const entries = readZipEntries(buffer, includeEntry);
  const relevantPaths =
    kind === 'docx'
      ? [...entries.keys()]
          .filter((name) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name))
          .sort()
      : [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort();

  const content = relevantPaths
    .map((path) => entries.get(path)?.toString('utf8') ?? '')
    .map(stripXml)
    .join('\n\n');

  return assertExtractedTextBudget(normalizeWhitespace(content));
}

function decodePdfLiteralString(input: string) {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractPdfText(buffer: Buffer) {
  const binary = buffer.toString('latin1');
  const collected: string[] = [];
  let collectedChars = 0;
  let cursor = 0;
  let streamCount = 0;
  let totalExpandedBytes = 0;

  while (cursor < binary.length) {
    const streamIndex = binary.indexOf('stream', cursor);
    if (streamIndex < 0) {
      break;
    }

    streamCount += 1;
    if (streamCount > MAX_PDF_STREAMS) {
      throw new RouteError(422, 'pdf_stream_limit', `PDF sources may contain at most ${MAX_PDF_STREAMS} streams.`);
    }

    const lineBreakLength = binary[streamIndex + 6] === '\r' && binary[streamIndex + 7] === '\n' ? 2 : 1;
    const dataStart = streamIndex + 6 + lineBreakLength;
    const endStreamIndex = binary.indexOf('endstream', dataStart);

    if (endStreamIndex < 0) {
      break;
    }

    const headerSlice = binary.slice(Math.max(0, streamIndex - 250), streamIndex);
    const streamBuffer = buffer.slice(dataStart, endStreamIndex);
    let decodedStream: string;

    if (/FlateDecode/.test(headerSlice)) {
      try {
        decodedStream = inflateSync(streamBuffer, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES }).toString('latin1');
      } catch {
        try {
          decodedStream = inflateRawSync(streamBuffer, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES }).toString('latin1');
        } catch {
          throw new RouteError(422, 'pdf_stream_decode_failed', 'A compressed PDF stream could not be decoded safely.');
        }
      }
    } else {
      decodedStream = streamBuffer.toString('latin1');
    }

    assertCompressionBudget({ compressedBytes: streamBuffer.length, expandedBytes: decodedStream.length });
    totalExpandedBytes += decodedStream.length;
    if (totalExpandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
      throw new RouteError(422, 'pdf_expanded_too_large', 'The PDF exceeds the total expanded-stream limit.');
    }

    const literalMatches = decodedStream.match(/\((?:\\.|[^\\)])+\)/g) ?? [];
    for (const literal of literalMatches) {
      const decoded = decodePdfLiteralString(literal.slice(1, -1)).trim();
      if (decoded.length >= 2) {
        collected.push(decoded);
        collectedChars += decoded.length;
        if (collectedChars > MAX_EXTRACTED_TEXT_CHARS) {
          throw new RouteError(422, 'source_expanded_too_large', 'The PDF exceeds the extracted-text safety limit.');
        }
      }
    }

    cursor = endStreamIndex + 'endstream'.length;
  }

  const extracted = assertExtractedTextBudget(normalizeWhitespace(collected.join('\n')));
  if (extracted.length >= 40) {
    return extracted;
  }

  return assertExtractedTextBudget(extractPrintableText(buffer));
}

async function extractSourceText(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}) {
  const extension = params.filename.includes('.') ? params.filename.split('.').pop()?.toLowerCase() ?? '' : '';
  const mimeType = params.mimeType || 'application/octet-stream';

  if (mimeType.startsWith('text/') || ['txt', 'md', 'csv'].includes(extension)) {
    return assertExtractedTextBudget(normalizeWhitespace(params.buffer.toString('utf8')));
  }

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return assertExtractedTextBudget(normalizeWhitespace(
      await extractTextFromImageDataUrl({
        imageDataUrl: toDataUrl(mimeType.startsWith('image/') ? mimeType : `image/${extension === 'jpg' ? 'jpeg' : extension}`, params.buffer),
      }),
    ));
  }

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return normalizeWhitespace(extractPdfText(params.buffer));
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return normalizeWhitespace(extractOfficeDocumentText(params.buffer, 'docx'));
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    extension === 'pptx'
  ) {
    return normalizeWhitespace(extractOfficeDocumentText(params.buffer, 'pptx'));
  }

  throw new RouteError(422, 'unsupported_ingestion_format', 'The uploaded file could not be processed by the ingestion pipeline.');
}

function estimateTokenCount(input: string) {
  return Math.max(1, Math.ceil(input.split(/\s+/).filter(Boolean).length * 1.25));
}

function buildChunks(text: string) {
  const normalized = assertExtractedTextBudget(normalizeWhitespace(text));
  if (!normalized) {
    return [];
  }

  const chunks: Array<{ text: string; heading: string | null }> = [];
  let start = 0;

  while (start < normalized.length) {
    const targetEnd = Math.min(start + MAX_CHUNK_CHARS, normalized.length);
    let end = targetEnd;

    if (end < normalized.length) {
      const paragraphBoundary = normalized.lastIndexOf('\n\n', end);
      const sentenceBoundary = normalized.lastIndexOf('. ', end);
      const chosenBoundary = Math.max(paragraphBoundary, sentenceBoundary);

      if (chosenBoundary > start + Math.floor(MAX_CHUNK_CHARS * 0.55)) {
        end = chosenBoundary + 1;
      }
    }

    const chunkText = normalized.slice(start, end).trim();
    if (chunkText) {
      const firstLine = chunkText.split('\n')[0]?.trim() ?? '';
      chunks.push({
        text: chunkText,
        heading: firstLine.length >= 6 ? firstLine.slice(0, 140) : null,
      });
      if (chunks.length > MAX_SOURCE_CHUNKS) {
        throw new RouteError(422, 'source_chunk_limit', `A source may produce at most ${MAX_SOURCE_CHUNKS} chunks.`);
      }
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  const uniqueByHash = new Map<string, { text: string; heading: string | null }>();
  for (const chunk of chunks) {
    const hash = createHash('sha256').update(chunk.text).digest('hex');
    if (!uniqueByHash.has(hash)) {
      uniqueByHash.set(hash, chunk);
    }
  }

  return [...uniqueByHash.values()];
}

async function getSourceRecord(sourceId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('source_files')
    .select(`
      id,
      folder_id,
      subject_id,
      category_id,
      title,
      original_filename,
      storage_bucket,
      storage_path,
      mime_type,
      file_size_bytes,
      source_status,
      source_priority,
      tags,
      description
    `)
    .eq('id', sourceId)
    .is('deleted_at', null)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load source file.');

  if (!data) {
    throw new RouteError(404, 'source_not_found', 'Source file not found.');
  }

  return data as SourceRecord;
}

async function updateProcessingJob(params: {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {
    job_status: params.status,
  };

  if (params.status === 'processing') {
    patch.started_at = new Date().toISOString();
    patch.error_message = null;
  } else {
    patch.completed_at = new Date().toISOString();
    patch.error_message = params.errorMessage ?? null;
  }

  const { error } = await supabase.from('source_processing_jobs').update(patch).eq('id', params.jobId);
  assertSupabaseResult(error, 'Failed to update source processing job.');
}

async function insertChunks(params: {
  source: SourceRecord;
  chunks: Array<{ text: string; heading: string | null }>;
}) {
  if (params.chunks.length > MAX_SOURCE_CHUNKS) {
    throw new RouteError(422, 'source_chunk_limit', `A source may contain at most ${MAX_SOURCE_CHUNKS} chunks.`);
  }
  const supabase = getSupabaseAdmin();
  const rows = [];

  for (const [index, chunk] of params.chunks.entries()) {
    const embedding = await createEmbedding(chunk.text);
    rows.push({
      source_file_id: params.source.id,
      subject_id: params.source.subject_id,
      category_id: params.source.category_id,
      folder_id: params.source.folder_id,
      chunk_index: index,
      page_number: null,
      heading: chunk.heading,
      text_content: chunk.text,
      text_hash: createHash('sha256').update(chunk.text).digest('hex'),
      token_count: estimateTokenCount(chunk.text),
      embedding,
      metadata: {
        sourceTitle: params.source.title,
        originalFilename: params.source.original_filename,
        folderId: params.source.folder_id,
        subjectId: params.source.subject_id,
        categoryId: params.source.category_id,
        tags: params.source.tags,
      },
      is_active: true,
    });
  }

  for (let offset = 0; offset < rows.length; offset += 12) {
    const batch = rows.slice(offset, offset + 12);
    const { error } = await supabase.from('source_chunks').insert(batch);
    assertSupabaseResult(error, 'Failed to insert source chunks.');
  }
}

async function processSource(params: {
  sourceId: string;
  jobId: string;
  desiredStatus: Extract<SourceStatus, 'active' | 'draft'>;
  audit: AuditContext;
  fileBuffer?: Buffer;
}) {
  const supabase = getSupabaseAdmin();
  const source = await getSourceRecord(params.sourceId);

  await updateProcessingJob({
    jobId: params.jobId,
    status: 'processing',
  });

  const setProcessing = await supabase
    .from('source_files')
    .update({
      source_status: 'processing',
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sourceId);
  assertSupabaseResult(setProcessing.error, 'Failed to mark source as processing.');

  try {
    let fileBuffer = params.fileBuffer;

    if (!fileBuffer) {
      const downloaded = await supabase.storage.from(source.storage_bucket).download(source.storage_path);
      assertSupabaseResult(downloaded.error, 'Failed to download the private source file.');

      const downloadedArrayBuffer = await downloaded.data!.arrayBuffer();
      fileBuffer = Buffer.from(downloadedArrayBuffer);
    }

    const extractedText = await extractSourceText({
      buffer: fileBuffer,
      mimeType: source.mime_type,
      filename: source.original_filename,
    });

    if (!extractedText || extractedText.length < 40) {
      throw new RouteError(
        422,
        'source_text_extraction_failed',
        'The source was uploaded, but not enough readable text could be extracted for chunking.',
      );
    }

    const chunks = buildChunks(extractedText);
    if (chunks.length === 0) {
      throw new RouteError(422, 'chunk_generation_failed', 'The source did not produce any searchable chunks.');
    }

    const deactivateExisting = await supabase.from('source_chunks').update({ is_active: false }).eq('source_file_id', source.id).eq('is_active', true);
    assertSupabaseResult(deactivateExisting.error, 'Failed to deactivate previous source chunks.');

    await insertChunks({
      source,
      chunks,
    });

    const { error: sourceUpdateError } = await supabase
      .from('source_files')
      .update({
        source_status: params.desiredStatus,
        processing_error: null,
        activated_at: params.desiredStatus === 'active' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    assertSupabaseResult(sourceUpdateError, 'Failed to finalize source status.');

    await updateProcessingJob({
      jobId: params.jobId,
      status: 'completed',
    });

    await writeAuditLog({
      actorUserId: params.audit.actorUserId,
      actorRole: params.audit.actorRole,
      eventType: 'source.processing.completed',
      entityType: 'source_files',
      entityId: source.id,
      eventSummary: `Processed source ${source.title} into ${chunks.length} chunks.`,
      newValues: {
        chunkCount: chunks.length,
        sourceStatus: params.desiredStatus,
      },
      ipAddress: params.audit.ipAddress,
      userAgent: params.audit.userAgent,
    });

    return {
      sourceId: source.id,
      status: params.desiredStatus,
      processedChunks: chunks.length,
      message: `Processed ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} successfully.`,
    } satisfies SourceMutationResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown ingestion failure.';

    await updateProcessingJob({
      jobId: params.jobId,
      status: 'failed',
      errorMessage,
    });

    const { error: sourceError } = await supabase
      .from('source_files')
      .update({
        source_status: 'failed',
        processing_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    assertSupabaseResult(sourceError, 'Failed to record source processing failure.');

    await writeAuditLog({
      actorUserId: params.audit.actorUserId,
      actorRole: params.audit.actorRole,
      eventType: 'source.processing.failed',
      entityType: 'source_files',
      entityId: source.id,
      eventSummary: `Source processing failed for ${source.title}.`,
      newValues: {
        error: errorMessage,
      },
      ipAddress: params.audit.ipAddress,
      userAgent: params.audit.userAgent,
    });

    throw error;
  }
}

export async function uploadAndProcessSource(params: SourceUploadInput): Promise<SourceMutationResult> {
  assertSupportedUpload(params.file);

  const supabase = getSupabaseAdmin();
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const extensionSafeName = sanitizeStorageName(params.file.name);
  const storagePath = `${params.subjectId}/${params.folderId}/${randomUUID()}-${extensionSafeName}`;

  const upload = await supabase.storage.from(SOURCE_BUCKET).upload(storagePath, fileBuffer, {
    contentType: params.file.type || 'application/octet-stream',
    upsert: false,
  });
  assertSupabaseResult(upload.error, 'Failed to upload the source file to private storage.');

  const insertedSource = await supabase
    .from('source_files')
    .insert({
      folder_id: params.folderId,
      subject_id: params.subjectId,
      category_id: params.categoryId,
      title: params.title,
      original_filename: params.file.name,
      storage_bucket: SOURCE_BUCKET,
      storage_path: storagePath,
      mime_type: params.file.type || 'application/octet-stream',
      file_size_bytes: params.file.size,
      source_status: 'processing',
      source_priority: params.sourcePriority,
      tags: params.tags,
      description: params.description,
      uploaded_by: params.actorUserId,
    })
    .select('id')
    .single();

  assertSupabaseResult(insertedSource.error, 'Failed to create source file row.');

  const sourceId = insertedSource.data!.id;

  const sourceVersion = await supabase.from('source_versions').insert({
    source_file_id: sourceId,
    version_number: 1,
    storage_path: storagePath,
    created_by: params.actorUserId,
    change_note: 'Initial upload',
  });
  assertSupabaseResult(sourceVersion.error, 'Failed to create source version row.');

  const processingJob = await supabase
    .from('source_processing_jobs')
    .insert({
      source_file_id: sourceId,
      job_status: 'queued',
      retries: 0,
    })
    .select('id')
    .single();

  assertSupabaseResult(processingJob.error, 'Failed to create source processing job.');

  await writeAuditLog({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    eventType: 'source.uploaded',
    entityType: 'source_files',
    entityId: sourceId,
    eventSummary: `Uploaded source ${params.title}.`,
    newValues: {
      folderId: params.folderId,
      subjectId: params.subjectId,
      categoryId: params.categoryId,
      storagePath,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return processSource({
    sourceId,
    jobId: processingJob.data!.id,
    desiredStatus: params.activateOnSuccess ? 'active' : 'draft',
    audit: params,
    fileBuffer,
  });
}

export async function retrySourceProcessing(params: AuditContext & { sourceId: string }) {
  const supabase = getSupabaseAdmin();
  const source = await getSourceRecord(params.sourceId);
  const lastJob = await supabase
    .from('source_processing_jobs')
    .select('id, job_status, retries')
    .eq('source_file_id', source.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  assertSupabaseResult(lastJob.error, 'Failed to load prior processing jobs.');

  if (lastJob.data?.job_status === 'queued' || lastJob.data?.job_status === 'processing') {
    throw new RouteError(409, 'source_already_processing', 'This source already has an active processing job.');
  }

  const queuedJob = await supabase
    .from('source_processing_jobs')
    .insert({
      source_file_id: source.id,
      job_status: 'queued',
      retries: (lastJob.data?.retries ?? 0) + 1,
    })
    .select('id')
    .single();

  assertSupabaseResult(queuedJob.error, 'Failed to queue source reprocessing.');

  await writeAuditLog({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    eventType: 'source.processing.retry_requested',
    entityType: 'source_files',
    entityId: source.id,
    eventSummary: `Retry requested for source ${source.title}.`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return processSource({
    sourceId: source.id,
    jobId: queuedJob.data!.id,
    desiredStatus: source.source_status === 'active' ? 'active' : 'draft',
    audit: params,
  });
}
