export type UserRole = 'super_admin' | 'admin' | 'client';

export type AccountStatus = 'active' | 'suspended' | 'pending_verification' | 'banned';

export type PaymentProvider = 'stripe' | 'paymongo';

export type WalletStatus = 'active' | 'locked';

export type CreditTransactionType =
  | 'purchase'
  | 'usage_debit'
  | 'admin_adjustment_add'
  | 'admin_adjustment_subtract'
  | 'refund'
  | 'promo'
  | 'expiration'
  | 'restoration';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';

export type PaymentType = 'topup' | 'subscription';

export type FolderType = 'subject_root' | 'category' | 'custom';

export type SourceStatus = 'draft' | 'processing' | 'active' | 'archived' | 'failed';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type SessionStatus = 'active' | 'paused' | 'ended' | 'timed_out' | 'no_credit' | 'no_match' | 'failed';

export type DetectionMode = 'auto' | 'manual';

export type InstallationStatus = 'active' | 'revoked';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type AnswerStyle = 'concise' | 'detailed';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type AnalyzeSearchScope = 'subject_first' | 'all_subjects';

export type QuestionType = 'multiple_choice' | 'fill_in_blank' | 'checkbox' | 'dropdown' | 'picture';

export type ExtensionSourceScope = 'subject_folder' | 'all_subject_folders' | 'file_sources' | 'no_match';

export interface ExtensionQuestionCandidate {
  id: string;
  prompt: string;
  options: string[];
  contextLabel: string | null;
  questionType: QuestionType | null;
  /** For dropdown sub-candidates: the parent .que container's candidate ID */
  parentQuestionId?: string | null;
  /** For dropdown sub-candidates: 0-based index within the parent question's dropdowns */
  dropdownSubIndex?: number | null;
}

export interface ExtensionExtractionDiagnostics {
  explicitQuestionBlockCount: number;
  structuredQuestionBlockCount: number;
  groupedInputCount: number;
  promptCandidateCount: number;
  questionCandidateCount: number;
  visibleOptionCount: number;
  courseCodeCount: number;
}

export type AutoClickStatus = 'pending' | 'clicked' | 'suggested_only' | 'no_match' | 'skipped';

export interface ExtensionQuestionSuggestion {
  questionId: string;
  questionText: string;
  answerText: string | null;
  suggestedOption: string | null;
  shortExplanation: string | null;
  confidence: number | null;
  warning: string | null;
  retrievalStatus: string;
  matchedSubject: string | null;
  matchedCategory: string | null;
  sourceScope: ExtensionSourceScope;
  clickStatus: AutoClickStatus;
  clickedText: string | null;
  questionType: QuestionType | null;
  /** For dropdown sub-items: the parent question's candidate ID */
  parentQuestionId?: string | null;
  /** For dropdown sub-items: 0-based index within the parent question's dropdowns */
  dropdownSubIndex?: number | null;
}

export interface ExtensionCapturedSection {
  id: string;
  digest: string;
  pageUrl: string;
  pageTitle: string;
  questionCount: number;
  capturedAt: string;
  pageSignals: ExtensionPageSignals;
}

export interface NavItem {
  href: string;
  label: string;
  badge?: string;
  iconName?:
    | 'dashboard'
    | 'sessions'
    | 'buy_credits'
    | 'usage_logs'
    | 'settings'
    | 'account'
    | 'extension_guide'
    | 'sources'
    | 'subjects'
    | 'categories'
    | 'users'
    | 'payments'
    | 'reports'
    | 'audit_logs';
}

export type ExtensionPairingStatus = 'not_paired' | 'paired' | 'revoked';

export type ExtensionUiStatus =
  | 'ready'
  | 'not_connected'
  | 'maintenance'
  | 'no_credits'
  | 'scanning_page'
  | 'detecting_subject'
  | 'searching_sources'
  | 'suggestion_ready'
  | 'low_confidence'
  | 'no_match_found'
  | 'error';

export type ExtensionSessionStateStatus =
  | 'session_inactive'
  | 'session_active'
  | 'session_paused'
  | 'session_expired';

export interface ExtensionPageSignals {
  pageUrl: string;
  pageDomain: string;
  pageTitle: string;
  headings: string[];
  breadcrumbs: string[];
  visibleLabels: string[];
  visibleTextExcerpt: string;
  questionText: string | null;
  options: string[];
  questionCandidates: ExtensionQuestionCandidate[];
  diagnostics: ExtensionExtractionDiagnostics;
  courseCodes: string[];
  quizTitle: string | null;
  quizNumber: string | null;
  totalQuestionsDetected: number;
  extractedAt: string;
}

export interface ExtensionAnswerSuggestion {
  answerText: string | null;
  shortExplanation: string | null;
  suggestedOption: string | null;
  questionSuggestions: ExtensionQuestionSuggestion[];
  subject: string | null;
  category: string | null;
  detectedSubject: string | null;
  detectedCategory: string | null;
  sourceSubject: string | null;
  sourceCategory: string | null;
  sourceScope: ExtensionSourceScope;
  searchScope: AnalyzeSearchScope;
  fallbackApplied: boolean;
  confidence: number | null;
  warning: string | null;
  retrievalStatus: string;
}

export interface ExtensionNotice {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  createdAt: string;
}

export interface ExtensionRecentAction {
  id: string;
  label: string;
  createdAt: string;
}

export interface ExtensionSessionSnapshot {
  sessionId: string | null;
  status: ExtensionSessionStateStatus;
  detectionMode: DetectionMode;
  liveAssistEnabled: boolean;
  manualSubject: string;
  manualCategory: string;
  lastActivityAt: string | null;
  cachedSubjectId: string | null;
  cachedSubjectName: string | null;
}

export interface ExtensionState {
  appBaseUrl: string;
  pairingStatus: ExtensionPairingStatus;
  uiStatus: ExtensionUiStatus;
  installationId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceName: string;
  browserName: string;
  extensionVersion: string;
  creditsRemainingSeconds: number;
  sessionCreditExpiresAt: string | null;
  session: ExtensionSessionSnapshot;
  currentPage: ExtensionPageSignals | null;
  capturedSections: ExtensionCapturedSection[];
  lastSuggestion: ExtensionAnswerSuggestion;
  notices: ExtensionNotice[];
  recentActions: ExtensionRecentAction[];
  lastError: string | null;
  permissionOrigin: string;
  autoClickEnabled: boolean;
  autoPilotEnabled: boolean;
}

export type ExtensionActionType =
  | 'EXTENSION/GET_STATE'
  | 'EXTENSION/GET_SUBJECTS'
  | 'EXTENSION/REQUEST_HOST_PERMISSION'
  | 'EXTENSION/PAIR_EXTENSION'
  | 'EXTENSION/UNPAIR_BROWSER'
  | 'EXTENSION/START_SESSION'
  | 'EXTENSION/PAUSE_SESSION'
  | 'EXTENSION/RESUME_SESSION'
  | 'EXTENSION/END_SESSION'
  | 'EXTENSION/ANALYZE_CURRENT_PAGE'
  | 'EXTENSION/CAPTURE_VISIBLE_SECTION'
  | 'EXTENSION/CLEAR_CAPTURED_SECTIONS'
  | 'EXTENSION/TOGGLE_LIVE_ASSIST'
  | 'EXTENSION/SET_MANUAL_OVERRIDE'
  | 'EXTENSION/REFRESH_CREDITS'
  | 'EXTENSION/OPEN_DASHBOARD'
  | 'EXTENSION/REPORT_WRONG_DETECTION'
  | 'EXTENSION/EXTRACT_PAGE_SIGNALS'
  | 'EXTENSION/SET_LIVE_ASSIST'
  | 'EXTENSION/LIVE_ASSIST_SIGNAL'
  | 'EXTENSION/CHECK_SITE_ACCESS'
  | 'EXTENSION/GRANT_SITE_PERMISSION'
  | 'EXTENSION/CLEAR_RESULTS'
  | 'EXTENSION/TOGGLE_AUTO_CLICK'
  | 'EXTENSION/AUTO_CLICK_ANSWER'
  | 'EXTENSION/AUTO_CLICK_ALL'
  | 'EXTENSION/TOGGLE_AUTO_PILOT'
  | 'EXTENSION/AUTO_CLICK_NEXT_PAGE'
  | 'EXTENSION/RESET_EXAM'
  | 'EXTENSION/CANCEL_ANALYZE'
  | 'EXTENSION/DETECT_FROM_PAGE';

export type AnalyzeMode = 'analyze' | 'detect' | 'suggest';

export interface ExtensionPairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
}

export interface ExtensionPairingExchangeResponse {
  installationId: string;
  accessToken: string;
  refreshToken: string | null;
  remainingSeconds: number;
  sessionStatus: ExtensionSessionStateStatus;
}

export interface ExtensionRefreshTokenResponse {
  accessToken: string;
  refreshToken: string | null;
}

export interface ClientWalletResponse {
  remainingSeconds: number;
  nextExpiryAt?: string | null;
  expiringSeconds?: number;
}

export interface ClientSettings {
  answerStyle: AnswerStyle;
  showConfidence: boolean;
  detectionMode: DetectionMode;
  lowCreditNotifications: boolean;
  theme: ThemePreference;
  language: string;
}

export interface ClientSettingsResponse {
  settings: ClientSettings;
}

export interface ClientSettingsUpdateRequest extends ClientSettings {}

export interface ClientSessionMutationResponse {
  sessionId: string;
  status: ExtensionSessionStateStatus;
  remainingSeconds?: number;
  detectionMode: DetectionMode;
}

export interface AnalyzeRequestPayload {
  mode: AnalyzeMode;
  searchScope: AnalyzeSearchScope;
  pageSignals: ExtensionPageSignals;
  screenshotDataUrl: string | null;
  manualSubject: string;
  manualCategory: string;
  sessionId: string | null;
  liveAssist: boolean;
  forceRedetect?: boolean;
}

export interface AnalyzeResponsePayload extends ExtensionAnswerSuggestion {
  remainingSeconds?: number;
}

export interface PaymentCheckoutRequest {
  packageId: string;
  provider: PaymentProvider;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentCheckoutResponse {
  checkoutUrl: string;
  checkoutSessionId: string;
  paymentId: string;
  provider: PaymentProvider;
}

export interface PaymentHistoryItem {
  id: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  createdAt: string;
  paidAt: string | null;
  packageCode: string | null;
  packageName: string | null;
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
}

export interface DeviceRevokeRequest {
  installationId: string;
}

export interface DeviceRevokeResponse {
  revoked: boolean;
}

export interface ClientDeviceSummary {
  id: string;
  installationStatus: InstallationStatus;
  deviceName: string | null;
  browserName: string | null;
  extensionVersion: string | null;
  lastSeenAt: string | null;
}

export interface ClientDevicesResponse {
  devices: ClientDeviceSummary[];
}

export interface PublicPaymentPackageSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  secondsToCredit: number;
  minutesToCredit: number;
  amountMinor: number;
  currency: string;
  priceDisplay: string;
  durationLabel: string;
  durationSummary: string;
  hasDistinctName: boolean;
  creditExpiresAfterDays: number | null;
}

export interface PublicPaymentPackagesResponse {
  packages: PublicPaymentPackageSummary[];
}

export interface MetricSummary {
  label: string;
  value: string;
  delta: string;
  tone: 'accent' | 'success' | 'warning';
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  walletBalance: string;
  walletStatus: WalletStatus;
  sessionCount: number;
  lastSessionAt: string;
  joinedAt: string;
  joinedAtIso: string | null;
  hasActiveSession: boolean;
  remainingSeconds: number;
  lifetimeSecondsPurchased: number;
  lifetimeSecondsUsed: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  lowCredit: boolean;
  packageName: string | null;
  paymentStatus: PaymentStatus | null;
  nextCreditExpiryAt: string | null;
  expiringCreditSeconds: number;
  flags: AdminUserFlagSummary[];
}

export type AdminUsersQuickFilter = 'all' | 'live' | 'suspended' | 'banned' | 'low_credit';

export type AdminUsersRoleFilter = 'all' | UserRole;

export type AdminUsersSortMode =
  | 'recent_joined'
  | 'name_az'
  | 'credits_low'
  | 'credits_high'
  | 'activity_recent';

export interface AdminUsersFilterState {
  q: string;
  role: AdminUsersRoleFilter;
  quickFilter: AdminUsersQuickFilter;
  sort: AdminUsersSortMode;
}

export interface AdminUsersSummary {
  totalUsers: number;
  liveNow: number;
  lowCredits: number;
  suspended: number;
  adminsCount: number;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filters: AdminUsersFilterState;
  summary: AdminUsersSummary;
}

export interface AdminUserDetailMetric {
  label: string;
  value: string;
  helper: string;
}

export interface AdminUserCreditTransactionSummary {
  id: string;
  createdAt: string;
  transactionType: CreditTransactionType;
  deltaLabel: string;
  balanceAfterLabel: string;
  description: string;
}

export interface AdminUserDeviceSummary {
  id: string;
  installationStatus: InstallationStatus;
  deviceName: string | null;
  browserName: string | null;
  extensionVersion: string | null;
  lastSeenAt: string | null;
}

export interface AdminUserNoteSummary {
  id: string;
  note: string;
  createdAt: string;
  createdByName: string;
  createdByEmail: string;
}

export interface AdminUserFlagSummary {
  id: string;
  flag: string;
  color: string | null;
  createdAt: string;
}

export interface AdminUserAccessOverrideSummary {
  canUseExtension: boolean;
  canBuyCredits: boolean;
  maxActiveDevices: number | null;
  dailyUsageLimitSeconds: number | null;
  monthlyUsageLimitSeconds: number | null;
  featureFlags: string[];
  updatedAt: string | null;
}

export interface AdminUserWalletGrantSummary {
  id: string;
  totalLabel: string;
  remainingLabel: string;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'depleted';
  description: string;
}

export interface AdminUserDetailResponse {
  user: AdminUserSummary & {
    joinedAtFull: string;
    statusReason: string | null;
    suspendedUntil: string | null;
  };
  metrics: AdminUserDetailMetric[];
  transactions: AdminUserCreditTransactionSummary[];
  payments: AdminPaymentSummary[];
  sessions: AdminSessionSummary[];
  devices: AdminUserDeviceSummary[];
  auditLogs: AdminAuditLogSummary[];
  notes: AdminUserNoteSummary[];
  flags: AdminUserFlagSummary[];
  access: AdminUserAccessOverrideSummary;
  walletGrants: AdminUserWalletGrantSummary[];
}

export interface AdminPaymentSummary {
  id: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  provider: PaymentProvider;
  packageName: string;
  amount: string;
  status: PaymentStatus;
}

export interface AdminPaymentPackageSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  minutesToCredit: number;
  amountMinor: number;
  amountDisplay: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  creditExpiresAfterDays: number | null;
}

export interface AdminPaymentsResponse {
  metrics: MetricSummary[];
  packages: AdminPaymentPackageSummary[];
  payments: AdminPaymentSummary[];
}

export interface AdminSessionSummary {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  siteDomain: string;
  pageTitle: string;
  pagePath: string;
  subject: string;
  category: string | null;
  duration: string;
  creditsUsed: string;
  analyzeCount: number;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  suspiciousFlag: string;
  detectionMode: DetectionMode;
  noMatchCount: number;
}

export interface AdminSessionsResponse {
  sessions: AdminSessionSummary[];
}

export interface AdminAuditLogSummary {
  id: string;
  createdAt: string;
  actor: string;
  actorDetail: string;
  event: string;
  entity: string;
  summary: string;
}

export interface AdminAuditLogsResponse {
  logs: AdminAuditLogSummary[];
}

export interface AdminReportFinding {
  id: string;
  subject: string;
  category: string;
  confidence: string;
  createdAt: string;
  noMatchReason: string;
}

export interface AdminReportsResponse {
  metrics: MetricSummary[];
  usageHighlights: string[];
  paymentHighlights: string[];
  recentFindings: AdminReportFinding[];
}

export interface AdminMutationResponse {
  success: boolean;
  message: string;
}

export interface AdminPaymentPackageUpdateRequest {
  code?: string;
  name: string;
  description?: string | null;
  minutesToCredit: number;
  priceMajor: number;
  isActive?: boolean;
  sortOrder?: number;
  creditExpiresAfterDays?: number | null;
}

export interface AdminPaymentPackageCreateRequest {
  code?: string;
  name: string;
  description?: string | null;
  minutesToCredit: number;
  priceMajor: number;
  isActive?: boolean;
  sortOrder?: number;
  creditExpiresAfterDays?: number | null;
}

export interface AdminPaymentPackageMutationResponse extends AdminMutationResponse {
  packageId: string;
  amountMinor: number;
  minutesToCredit: number;
  creditExpiresAfterDays?: number | null;
}

export interface AdminUserCreditAdjustmentRequest {
  deltaSeconds: number;
  description: string;
}

export interface AdminUserCreditAdjustmentResponse extends AdminMutationResponse {
  userId: string;
  remainingSeconds: number;
  lifetimeSecondsPurchased: number;
  lifetimeSecondsUsed: number;
  openSessionsClosed?: number;
}

export interface AdminUserStatusRequest {
  status: Extract<AccountStatus, 'active' | 'suspended' | 'banned'>;
  reason?: string;
  suspendedUntil?: string | null;
}

export interface AdminUserStatusResponse extends AdminMutationResponse {
  userId: string;
  accountStatus: AccountStatus;
  walletStatus: WalletStatus;
  suspendedUntil?: string | null;
  openSessionsClosed?: number;
}

export interface AdminUserNoteCreateRequest {
  note: string;
}

export interface AdminUserNoteMutationResponse extends AdminMutationResponse {
  noteId: string;
}

export interface AdminUserFlagCreateRequest {
  flag: string;
  color?: string | null;
}

export interface AdminUserFlagDeleteRequest {
  flagId: string;
}

export interface AdminUserFlagMutationResponse extends AdminMutationResponse {
  flagId: string;
}

export interface AdminUserAccessOverrideRequest {
  canUseExtension: boolean;
  canBuyCredits: boolean;
  maxActiveDevices?: number | null;
  dailyUsageLimitSeconds?: number | null;
  monthlyUsageLimitSeconds?: number | null;
  featureFlags: string[];
}

export interface AdminUserAccessOverrideResponse extends AdminMutationResponse {
  userId: string;
  access: AdminUserAccessOverrideSummary;
}

export interface AdminUserDeviceRevokeRequest {
  installationId?: string | null;
  revokeAll?: boolean;
}

export interface AdminUserDeviceRevokeResponse extends AdminMutationResponse {
  userId: string;
  revokedCount: number;
}

export interface AdminBulkUserActionRequest {
  userIds: string[];
  action: 'suspend' | 'add_credits' | 'deduct_credits';
  reason: string;
  minutes?: number;
}

export interface AdminBulkUserActionFailure {
  userId: string;
  error: string;
}

export interface AdminBulkUserActionResponse extends AdminMutationResponse {
  processed: number;
  succeeded: number;
  failures: AdminBulkUserActionFailure[];
}

export interface AdminSubjectMutationRequest {
  name: string;
  slug?: string;
  courseCode?: string | null;
  department?: string | null;
  description?: string | null;
  keywords: string[];
  urlPatterns: string[];
  isActive?: boolean;
}

export interface AdminSubjectMutationResponse extends AdminMutationResponse {
  subjectId: string;
  folderId?: string;
}

export interface AdminCategoryMutationRequest {
  subjectId?: string | null;
  name: string;
  slug?: string;
  description?: string | null;
  defaultKeywords: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface AdminCategoryMutationResponse extends AdminMutationResponse {
  categoryId: string;
}

export interface AdminFolderCreateRequest {
  parentId?: string | null;
  subjectId?: string | null;
  folderType: FolderType;
  name: string;
  slug?: string;
  sortOrder?: number;
}

export interface AdminFolderUpdateRequest {
  action: 'rename' | 'move' | 'archive' | 'delete';
  name?: string;
  slug?: string;
  parentId?: string | null;
}

export interface AdminFolderMutationResponse extends AdminMutationResponse {
  folderId: string;
}

export interface AdminSourceMetadataRequest {
  action: 'rename' | 'move' | 'archive' | 'set_activation';
  title?: string;
  folderId?: string;
  subjectId?: string;
  categoryId?: string | null;
  active?: boolean;
}

export interface AdminSourceMutationResponse extends AdminMutationResponse {
  sourceId: string;
  status: SourceStatus;
  processedChunks?: number;
}

export interface AdminSourceUploadResponse extends AdminSourceMutationResponse {}

export interface AdminSubjectQaPairSummary {
  id: string;
  subjectId: string;
  categoryId: string | null;
  questionText: string;
  answerText: string;
  shortExplanation: string | null;
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  subjectName: string | null;
  categoryName: string | null;
  questionType: QuestionType;
  questionImageUrl: string | null;
}

export interface AdminSubjectQaPairCreateRequest {
  subjectId: string;
  categoryId?: string | null;
  questionText: string;
  answerText: string;
  shortExplanation?: string | null;
  keywords: string[];
  sortOrder?: number;
  isActive?: boolean;
  questionType?: QuestionType;
  questionImageUrl?: string | null;
}

export type AdminSubjectQaPairUpdateRequest =
  | {
      action: 'update';
      subjectId: string;
      categoryId?: string | null;
      questionText: string;
      answerText: string;
      shortExplanation?: string | null;
      keywords: string[];
      sortOrder?: number;
      isActive?: boolean;
      questionType?: QuestionType;
      questionImageUrl?: string | null;
    }
  | {
      action: 'set_activation';
      isActive: boolean;
    }
  | {
      action: 'delete';
    };

export interface AdminSubjectQaPairMutationResponse extends AdminMutationResponse {
  pairId: string;
}

export interface AdminSubjectQaPairListResponse {
  pairs: AdminSubjectQaPairSummary[];
}

export interface AdminSubjectQaCountResponse {
  counts: Record<string, number>;
}
