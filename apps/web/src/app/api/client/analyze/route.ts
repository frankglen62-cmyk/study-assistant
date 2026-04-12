import { z } from 'zod';

import type { AnalyzeRequestPayload } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { analyzeStudyPage } from '@/lib/ai/analyze';
import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { requireActiveSession, settleActiveSessionUsage } from '@/lib/sessions/service';
import { assertRateLimit } from '@/lib/security/rate-limit';

const requestSchema = z.object({
  mode: z.enum(['analyze', 'detect', 'suggest']),
  pageSignals: z
    .object({
      pageUrl: z.string().url(),
      pageDomain: z.string().optional().default(''),
      pageTitle: z.string().optional().default(''),
      headings: z.array(z.string()).optional().default([]),
      breadcrumbs: z.array(z.string()).optional().default([]),
      visibleLabels: z.array(z.string()).optional().default([]),
      visibleTextExcerpt: z.string().optional().default(''),
      questionText: z.string().nullable().optional().default(null),
      options: z.array(z.string()).optional().default([]),
      questionCandidates: z
        .array(
          z.object({
            id: z.string(),
            prompt: z.string(),
            options: z.array(z.string()).optional().default([]),
            contextLabel: z.string().nullable().optional().default(null),
            questionType: z.enum(['multiple_choice', 'fill_in_blank', 'checkbox', 'dropdown', 'picture'] as const).nullable().optional(),
          }),
        )
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
      courseCodes: z.array(z.string()).optional().default([]),
      quizTitle: z.string().nullable().optional().default(null),
      quizNumber: z.string().nullable().optional().default(null),
      totalQuestionsDetected: z.number().int().nonnegative().optional().default(0),
      extractedAt: z.string().optional().default(''),
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
  screenshotDataUrl: z.string().nullable().optional().default(null),
  manualSubject: z.string().optional().default(''),
  manualCategory: z.string().optional().default(''),
  searchScope: z.enum(['subject_first', 'all_subjects']).optional().default('subject_first'),
  sessionId: z.string().uuid().nullable().optional().default(null),
  liveAssist: z.boolean().optional().default(false),
  forceRedetect: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    const limiterKey = 'installationId' in context 
      ? `analyze:${context.installationId}`
      : `analyze:${context.userId}`;
      
    assertRateLimit(limiterKey, {
      max: 600,
      windowMs: 60 * 60 * 1000,
    });

    const body = (await parseJsonBody(
      request,
      requestSchema as z.ZodType<AnalyzeRequestPayload>,
    )) as AnalyzeRequestPayload;
    const activeSession = await requireActiveSession(context.userId, body.sessionId);
    const settled = await settleActiveSessionUsage({
      userId: context.userId,
      sessionId: activeSession.id,
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
      walletStatus: context.wallet.status,
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
  }
}
