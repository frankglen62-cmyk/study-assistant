import type { ExtensionActionType, ExtensionPageSignals, ExtensionState } from '@study-assistant/shared-types';

export interface ExtensionMessage<TPayload = undefined> {
  type: ExtensionActionType;
  payload?: TPayload;
}

export interface ExtensionResponse<TData = undefined> {
  ok: boolean;
  data?: TData;
  error?: string;
}

export interface PairExtensionPayload {
  appBaseUrl: string;
  pairingCode: string;
  deviceName: string;
}

export interface AnalyzeCurrentPagePayload {
  mode: 'analyze' | 'detect' | 'suggest';
  includeScreenshot?: boolean;
  source?: 'current' | 'captured';
  searchScope?: 'subject_first' | 'all_subjects';
}

export interface ManualOverridePayload {
  subject: string;
  category: string;
}

export interface RequestPermissionPayload {
  appBaseUrl: string;
}

export interface LiveAssistPayload {
  enabled: boolean;
}

export interface LiveAssistSignalPayload {
  digest: string;
  pageTitle: string;
}

export interface ExtractSignalsPayload {
  includeQuestionContext?: boolean;
}

export interface AutoClickAnswerPayload {
  questionId: string;
  answerText: string;
  suggestedOption: string | null;
  options: string[];
}

export interface AutoClickResult {
  questionId: string;
  clicked: boolean;
  clickedText: string | null;
  matchMethod: string;
}

export type StateResponse = ExtensionResponse<ExtensionState>;
export type PageSignalsResponse = ExtensionResponse<ExtensionPageSignals>;
