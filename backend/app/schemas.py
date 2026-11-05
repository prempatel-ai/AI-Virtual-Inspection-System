"""Pydantic schemas for the Virtual Inspection System API."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str


# --- Auth Schemas ---


class UserSummary(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    district: Optional[str] = None
    taluka: Optional[str] = None


class ScopeInfo(BaseModel):
    level: str
    district: Optional[str] = None
    taluka: Optional[str] = None
    inspector_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: UserSummary
    permissions: List[str]
    scope: ScopeInfo


class LogoutResponse(BaseModel):
    status: str = "ok"


# --- Meta & Summary Schemas ---


class MetaResponse(BaseModel):
    synthetic: bool
    weeks: List[str]
    latest_week: str
    districts: List[str]
    talukas: Dict[str, List[str]]
    shops_count: int
    has_run: bool


class EvaluationSummary(BaseModel):
    on_synthetic_data: bool
    precision_at_k: float
    recall_at_2k: float
    outage_false_alarm_rate: float
    k: int


class SummaryResponse(BaseModel):
    week: str
    shops_monitored: int
    flagged: int
    high: int
    medium: int
    open_cases: int = 0
    overdue_cases: int = 0
    evaluation: EvaluationSummary
    visits_recorded: int
    confirmed_rate: Optional[float] = None


class SignalSummary(BaseModel):
    key: str
    label: str
    points: float


class CaseSummary(BaseModel):
    case_id: str
    status: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None


class RankedShopItem(BaseModel):
    rank: int
    shop_id: str
    name: str
    district: str
    taluka: str
    risk_score: float
    band: str
    top_signals: List[SignalSummary]
    trend: List[float]
    case: Optional[CaseSummary] = None


class RankedShopsResponse(BaseModel):
    week: str
    total: int
    items: List[RankedShopItem]


class ShopMeta(BaseModel):
    shop_id: str
    name: str
    district: str
    taluka: str
    cards_count: int
    vulnerability_index: float
    inspector_id: Optional[str] = None


class BreakdownItem(BaseModel):
    key: str
    label: str
    points: float
    value: float
    unit: str
    own_median: Optional[float] = None
    peer_median: Optional[float] = None
    z: Optional[float] = None


class SeriesData(BaseModel):
    shop: List[float]
    peer_median: List[float]


class HistoryData(BaseModel):
    weeks: List[str]
    series: Dict[str, SeriesData]


class StockReconciliation(BaseModel):
    opening_kg: float
    received_kg: float
    sold_kg: float
    closing_kg: float
    gap_kg: float
    gap_pct: float
    direction: str


class BoardCheck(BaseModel):
    board_kg: float
    sold_kg: float
    mismatch_pct: float


class ComplaintCategoryCount(BaseModel):
    category: str
    count: int


class EvidenceItem(BaseModel):
    fact_id: str
    statement: str


class ChecklistItem(BaseModel):
    action: str
    why: str
    fact_id: str


class ExplanationData(BaseModel):
    source: str
    reason: str
    evidence: List[EvidenceItem]
    checklist: List[ChecklistItem]


class FeedbackItem(BaseModel):
    outcome: str
    note: Optional[str] = None
    created_at: str


class ShopDetailResponse(BaseModel):
    shop: ShopMeta
    week: str
    risk_score: float
    band: str
    rank: int
    breakdown: List[BreakdownItem]
    history: HistoryData
    stock_reconciliation: StockReconciliation
    board_check: BoardCheck
    complaints: List[ComplaintCategoryCount]
    explanation: ExplanationData
    feedback: List[FeedbackItem]
    case: Optional[CaseSummary] = None


class RunRequest(BaseModel):
    week: Optional[str] = None
    top_k: Optional[int] = 20


class RunResponse(BaseModel):
    run_id: int
    week: str
    shops_scored: int
    explained: int
    cases_created: int = 0
    cases_updated: int = 0
    duration_ms: int


class FeedbackRequest(BaseModel):
    week: str
    outcome: Literal["confirmed", "not_confirmed"]
    note: Optional[str] = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    id: int
    shop_id: str
    week_start: str
    outcome: str
    note: Optional[str]
    created_at: str


class ChecklistResultItem(BaseModel):
    item_action: str
    result: Literal["ok", "issue", "not_checked"]
    note: Optional[str] = None


class CaseListItem(BaseModel):
    case_id: str
    shop_id: str
    shop_name: str
    district: str
    taluka: str
    status: str
    risk_score_latest: float
    band_latest: str
    opened_week: str
    last_flagged_week: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    is_overdue: bool
    last_action_at: str
    created_at: str


class CaseListResponse(BaseModel):
    total: int
    items: List[CaseListItem]


class CaseDetail(BaseModel):
    case_id: str
    shop_id: str
    shop_name: str
    district: str
    taluka: str
    status: str
    risk_score_latest: float
    band_latest: str
    opened_week: str
    last_flagged_week: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    is_overdue: bool
    closed_at: Optional[str] = None
    last_action_at: str
    created_at: str


class CaseActionItem(BaseModel):
    id: int
    case_id: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_role: str
    type: str
    payload: Dict[str, Any]
    risk_score_at_action: Optional[float] = None
    created_at: str


class CaseDetailResponse(BaseModel):
    case: CaseDetail
    allowed_actions: List[str]
    actions: List[CaseActionItem]


class CaseActionRequest(BaseModel):
    type: str
    note: Optional[str] = None
    reason: Optional[str] = None
    to_user_id: Optional[str] = None
    outcome: Optional[Literal["confirmed", "not_confirmed"]] = None
    action_taken: Optional[str] = None
    checklist_results: Optional[List[ChecklistResultItem]] = None


class AreaMetricItem(BaseModel):
    name: str
    level: Literal["district", "taluka"]
    shops_count: int
    flagged_count: int
    flag_rate: float
    high_band_count: int
    open_cases: int
    overdue_cases: int
    confirmed_rate: Optional[float] = None


class AreaMetricsResponse(BaseModel):
    items: List[AreaMetricItem]


class OfficerStats(BaseModel):
    assigned_cases: int
    open_cases: int
    overdue_cases: int
    inspected_cases: int
    closed_cases: int
    confirmed_rate: Optional[float] = None
    median_time_to_first_action_hours: Optional[float] = None
    last_action_at: Optional[str] = None


class OfficerListItem(BaseModel):
    user_id: str
    name: str
    role: str
    district: Optional[str] = None
    taluka: Optional[str] = None
    is_active: bool
    stats: OfficerStats


class OfficerListResponse(BaseModel):
    items: List[OfficerListItem]


class OfficerDetailResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    district: Optional[str] = None
    taluka: Optional[str] = None
    is_active: bool
    created_at: str
    permissions: List[str]
    scope: Dict[str, Any]
    stats: OfficerStats
    assigned_cases: List[CaseListItem]
    recent_actions: List[CaseActionItem]
    area_flag_rate: Optional[float] = None


class ActionFeedItem(BaseModel):
    id: int
    case_id: str
    shop_id: str
    shop_name: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_role: str
    type: str
    payload: Dict[str, Any]
    risk_score_at_action: Optional[float] = None
    created_at: str


class ActionFeedResponse(BaseModel):
    total: int
    items: List[ActionFeedItem]


class AdminUserItem(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    district: Optional[str] = None
    taluka: Optional[str] = None
    is_active: bool
    last_login_at: Optional[str] = None
    created_at: str


class AdminUserListResponse(BaseModel):
    items: List[AdminUserItem]


class CreateUserRequest(BaseModel):
    name: str
    email: str
    role: str
    district: Optional[str] = None
    taluka: Optional[str] = None


class CreateUserResponse(BaseModel):
    user: AdminUserItem
    temporary_password: str


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    is_active: Optional[bool] = None


class ResetPasswordResponse(BaseModel):
    user_id: str
    temporary_password: str


class AuditLogItem(BaseModel):
    id: int
    event: str
    actor_id: Optional[str] = None
    target_user_id: Optional[str] = None
    ip: Optional[str] = None
    detail: Dict[str, Any]
    created_at: str


class AuditLogResponse(BaseModel):
    total: int
    items: List[AuditLogItem]
