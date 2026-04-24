import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime
from database import Base


class MatchRun(Base):
    __tablename__ = "match_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    use_case = Column(String, nullable=False)  # name_match | company_org | company_name
    file_a_rows = Column(Integer)
    file_b_rows = Column(Integer)
    file_a_name = Column(String)
    file_b_name = Column(String)
    threshold = Column(Integer)
    processing_time_sec = Column(Float)
    matches_above_threshold = Column(Integer)
    avg_match_score = Column(Float)
    exact_matches = Column(Integer)
    client_ip_hash = Column(String)
