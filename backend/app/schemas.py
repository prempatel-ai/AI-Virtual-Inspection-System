"""Pydantic schemas for the Virtual Inspection System API."""

from typing import Dict, List, Literal, Optional

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
