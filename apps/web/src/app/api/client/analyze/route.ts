import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AnalyzeRequestPayload } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { analyzeStudyPage } from '@/lib/ai/analyze';
import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { requireActiveSession, settleActiveSessionUsage } from '@/lib/sessions/service';
import { assertDistributedRateLimit } from '@/lib/security/rate-limit';
import { acquireSessionAnalysisLease, releaseSessionAnalysisLease } from '@/lib/supabase/sessions';

const MAX_ANALYZE_BODY_BYTES = 5 * 1024 * 1024;
const MAX_QUESTION_CANDIDATES = 100;
const MAX_OPTIONS = 50;
const MAX_CONTEXT_ITEMS = 50;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 4_000_000;

const boundedText = (max: number) => z.string().max(max);
const boundedTextArray = (itemMax: number, arrayMax: number) => z.array(boundedText(itemMax)).max(arrayMax);

const requestSchema = z.object({
  mode: z.enum(['analyze', 'detect', 'suggest']),
  pageSignals: z
    .object({
      pageUrl: z.string().max(2048).url(),
      pageDomain: boundedText(255).optional().default(''),
      pageTitle: boundedText(240).optional().default(''),
      headings: boundedTextArray(180, MAX_CONTEXT_ITEMS).optional().default([]),
      breadcrumbs: boundedTextArray(120, MAX_CONTEXT_ITEMS).optional().default([]),
      visibleLabels: boundedTextArray(120, MAX_CONTEXT_ITEMS).optional().default([]),
      visibleTextExcerpt: boundedText(12_000).optional().default(''),
      questionText: boundedText(2_000).nullable().optional().default(null),
      options: boundedTextArray(800, MAX_OPTIONS).optional().default([]),
      questionCandidates: z
        .array(
          z.object({
            id: boundedText(160),
            prompt: boundedText(2_000),
            options: boundedTextArray(800, MAX_OPTIONS).optional().default([]),
            contextLabel: boundedText(240).nullable().optional().default(null),
            questionType: z.enum(['multiple_choice', 'fill_in_blank', 'checkbox', 'dropdown', 'picture'] as const).nullable().optional(),
            parentQuestionId: boundedText(160).nullable().optional(),
            dropdownSubIndex: z.number().int().min(0).max(1_000).nullable().optional(),
            dropdownSubQuestions: z
              .array(
                z.object({
                  subId: boundedText(160),
                  prompt: boundedText(2_000),
                  options: boundedTextArray(800, MAX_OPTIONS),
                  dropdownId: boundedText(160),
                }),
              )
              .max(50)
              .nullable()
              .optional(),
          }),
        )
        .max(MAX_QUESTION_CANDIDATES)
        .optional()
        .default([]),
      diagnostics: z
        .object({
          explicitQuestionBlockCount: z.number().int().nonnegative().optional().default(0),
          structuredQuestionBlockCount: z.number().int().nonnegative().optional().default(0),
          groupedInputCount: z.number().int().nonnegative().optional().default(0),
          promptCandidateCount: z.number().int().nonnegative().optional().default(0),
          questionCandidateCount: z.number().int().nonnegative().optional().default(0),
          visibleOptionCount: z.number().int().nonnegative().optional().default(0),
          courseCodeCount: z.number().int().nonnegative().optional().default(0),
        })
        .optional()
        .default({
          explicitQuestionBlockCount: 0,
          structuredQuestionBlockCount: 0,
          groupedInputCount: 0,
          promptCandidateCount: 0,
          questionCandidateCount: 0,
          visibleOptionCount: 0,
          courseCodeCount: 0,
        }),
      courseCodes: boundedTextArray(80, 20).optional().default([]),
      quizTitle: boundedText(240).nullable().optional().default(null),
      quizNumber: boundedText(80).nullable().optional().default(null),
      totalQuestionsDetected: z.number().int().nonnegative().optional().default(0),
      extractedAt: boundedText(64).optional().default(''),
    })
    .transform((payload) => {
      const derivedUrl = new URL(payload.pageUrl);

      return {
        ...payload,
        pageDomain: payload.pageDomain || derivedUrl.hostname,
        pageTitle: payload.pageTitle || derivedUrl.hostname,
        extractedAt: payload.extractedAt || new Date().toISOString(),
      };
    }),
  screenshotDataUrl: z
    .string()
    .max(MAX_SCREENSHOT_DATA_URL_LENGTH)
    .refine(
      (value) => /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value),
      'Screenshot must be a PNG, JPEG, or WebP data URL.',
    )
    .nullable()
    .optional()
    .default(null),
  manualSubject: boundedText(120).optional().default(''),
  manualCategory: boundedText(120).optional().default(''),
  searchScope: z.enum(['subject_first', 'all_subjects']).optional().default('subject_first'),
  sessionId: z.string().uuid().nullable().optional().default(null),
  liveAssist: z.boolean().optional().default(false),
  forceRedetect: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);
  let analysisLease: { userId: string; sessionId: string; leaseToken: string } | null = null;

  try {
    const context = await requireClientUser(request);
    const limiterKey = 'installationId' in context 
      ? `analyze:${context.installationId}`
      : `analyze:${context.userId}`;
      
    await assertDistributedRateLimit(limiterKey, {
      max: 600,
      windowMs: 60 * 60 * 1000,
    });

    const body = (await parseJsonBody(
      request,
      requestSchema as z.ZodType<AnalyzeRequestPayload>,
      { maxBytes: MAX_ANALYZE_BODY_BYTES },
    )) as AnalyzeRequestPayload;
    const activeSession = await requireActiveSession(context.userId, body.sessionId);

    // Security: verify the requesting device owns this session.
    // If both the session and the request carry an installation ID, they must match.
    if (
      'installationId' in context &&
      activeSession.extension_installation_id &&
      activeSession.extension_installation_id !== context.installationId
    ) {
      throw new RouteError(
        409,
        'session_device_conflict',
        'This session belongs to a different device. End that session first, then start a new one on this device.',
      );
    }

    const leaseToken = randomUUID();
    await acquireSessionAnalysisLease({
      userId: context.userId,
      sessionId: activeSession.id,
      leaseToken,
      leaseSeconds: 90,
    });
    analysisLease = { userId: context.userId, sessionId: activeSession.id, leaseToken };

    const settled = await settleActiveSessionUsage({
      userId: context.userId,
      sessionId: activeSession.id,
      minimumSeconds: 1,
    });

    if (settled.usageLimitReached) {
      throw new RouteError(
        403,
        settled.usageLimitReached === 'daily' ? 'daily_usage_limit_reached' : 'monthly_usage_limit_reached',
        settled.usageLimitReached === 'daily'
          ? 'Daily usage limit reached for this account.'
          : 'Monthly usage limit reached for this account.',
      );
    }

    assertWalletSpendable({
      walletStatus: settled.wallet.status,
      remainingSeconds: settled.wallet.remaining_seconds,
      requiredSeconds: 1,
      lockedMessage: 'Wallet access is locked. Contact support or an administrator.',
      insufficientMessage: 'No study time remains for this session.',
    });

    if (settled.session.status !== 'active') {
      throw new RouteError(402, 'insufficient_credits', 'No study time remains for this session.');
    }

    const response = await analyzeStudyPage({
      userId: context.userId,
      sessionId: settled.session.id,
      sessionSubjectId: body.forceRedetect ? null : settled.session.current_subject_id,
      sessionCategoryId: body.forceRedetect ? null : settled.session.current_category_id,
      request: body,
    });

    return jsonOk(
      {
        ...response,
        remainingSeconds: settled.wallet.remaining_seconds,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  } finally {
    if (analysisLease) {
      await releaseSessionAnalysisLease(analysisLease).catch(() => undefined);
    }
  }
}
