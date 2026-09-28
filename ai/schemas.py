from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class CitizenRequest:
    category: str
    description: str
    location: Optional[str]
    language: str
    priority: str
    confidence: float
    needs_review: bool

    def to_dict(self):
        return asdict(self)