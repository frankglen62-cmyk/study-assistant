import { z } from 'zod';

export const subjectDetectionSchema = z.object({
  subjectId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const extractedQuestionSchema = z.object({
  questionText: z.string().nullable(),
  options: z.array(z.string()).default([]),
  answerType: z.enum(['multiple_choice', 'true_false', 'short_form']).default('short_form'),
});

export const answerSuggestionSchema = z.object({
  answerText: z.string().nullable(),
  shortExplanation: z.string().nullable(),
  suggestedOption: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  warning: z.string().nullable(),
});

export const detectionJsonSchema = {
  name: 'subject_detection',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      subjectId: { type: ['string', 'null'] },
      categoryId: { type: ['string', 'null'] },
      confidence: { type: 'number' },
      reasoning: { type: 'string' },
    },
    required: ['subjectId', 'categoryId', 'confidence', 'reasoning'],
  },
} as const;

export const questionExtractionJsonSchema = {
  name: 'question_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      questionText: { type: ['string', 'null'] },
      options: {
        type: 'array',
        items: { type: 'string' },
      },
      answerType: {
        type: 'string',
        enum: ['multiple_choice', 'true_false', 'short_form'],
      },
    },
    required: ['questionText', 'options', 'answerType'],
  },
} as const;

export const answerJsonSchema = {
  name: 'answer_suggestion',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      answerText: { type: ['string', 'null'] },
      shortExplanation: { type: ['string', 'null'] },
      suggestedOption: { type: ['string', 'null'] },
      confidence: { type: 'number' },
      warning: { type: ['string', 'null'] },
    },
    required: ['answerText', 'shortExplanation', 'suggestedOption', 'confidence', 'warning'],
  },
} as const;
