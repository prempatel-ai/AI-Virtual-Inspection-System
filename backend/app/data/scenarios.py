"""Scenario definitions and constants for synthetic PDS data."""

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class ScenarioDef:
    id: str
    name: str
    share: float
    is_positive: int
    description: str


SCENARIOS = {
    "S1": ScenarioDef(
        id="S1",
        name="stock diversion",
        share=0.01,
        is_positive=1,
        description="Closing stock lower than book records by 8 to 15% of (opening + received)",
    ),
    "S2": ScenarioDef(
        id="S2",
        name="board mismatch",
        share=0.01,
        is_positive=1,
        description="Public board displayed kg is 15% to 35% higher than recorded sales",
    ),
    "S3": ScenarioDef(
        id="S3",
        name="override heavy",
        share=0.01,
        is_positive=1,
        description="Unauthenticated sales share 3x peer median with rising auth failures",
    ),
    "S4": ScenarioDef(
        id="S4",
        name="complaint spike",
        share=0.01,
        is_positive=1,
        description="Complaints 4x to 6x peer median in last 3 weeks, mostly denial/weight",
    ),
    "S5": ScenarioDef(
        id="S5",
        name="severe multi-signal",
        share=0.005,
        is_positive=1,
        description="Combination of stock diversion, override jump, and complaint spike",
    ),
    "S6": ScenarioDef(
        id="S6",
        name="vulnerable mild",
        share=0.005,
        is_positive=1,
        description="High vulnerability index (>= 0.80) with mild stock gap of 3 to 5%",
    ),
    "S7": ScenarioDef(
        id="S7",
        name="outage trap",
        share=0.0,  # 1 full taluka
        is_positive=0,
        description="Area-wide telecom outage causing auth failures across all shops in taluka",
    ),
    "S8": ScenarioDef(
        id="S8",
        name="clean",
        share=0.0,
        is_positive=0,
        description="Normal compliant shop operations",
    ),
}

DISTRICTS: List[str] = [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Mehsana",
    "Bhavnagar",
    "Jamnagar",
    "Gandhinagar",
]

COMPLAINT_CATEGORIES: List[str] = [
    "denied ration",
    "short weight",
    "extra money",
    "poor quality",
    "shop closed",
]
