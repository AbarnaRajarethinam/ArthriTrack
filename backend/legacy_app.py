from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
import numpy as np
from sklearn.ensemble import IsolationForest

DATABASE_URL = "sqlite:///./arthritrack.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    assessment_type: Mapped[str] = mapped_column(index=True)
    hand: Mapped[str] = mapped_column(index=True)
    recorded_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    duration_seconds: Mapped[float] = mapped_column(default=0.0)
    repetition_count: Mapped[int] = mapped_column(default=0)
    range_of_motion: Mapped[float] = mapped_column(default=0.0)
    finger_flexion: Mapped[float] = mapped_column(default=0.0)
    finger_extension: Mapped[float] = mapped_column(default=0.0)
    movement_speed: Mapped[float] = mapped_column(default=0.0)
    movement_consistency: Mapped[float] = mapped_column(default=0.0)
    tracking_quality: Mapped[float] = mapped_column(default=0.0)
    notes: Mapped[str] = mapped_column(default="")


class SymptomRecord(Base):
    __tablename__ = "symptom_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recorded_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    pain_level: Mapped[int] = mapped_column(default=0)
    stiffness_level: Mapped[int] = mapped_column(default=0)
    morning_stiffness_minutes: Mapped[int] = mapped_column(default=0)
    swelling: Mapped[str] = mapped_column(default="mild")
    daily_difficulty: Mapped[str] = mapped_column(default="none")
    notes: Mapped[str] = mapped_column(default="")


Base.metadata.create_all(bind=engine)


class AssessmentCreate(BaseModel):
    assessment_type: str
    hand: str
    duration_seconds: float = 0.0
    repetition_count: int = 0
    range_of_motion: float = 0.0
    finger_flexion: float = 0.0
    finger_extension: float = 0.0
    movement_speed: float = 0.0
    movement_consistency: float = 0.0
    tracking_quality: float = 0.0
    notes: str = ""


class SymptomCreate(BaseModel):
    pain_level: int = Field(ge=0, le=10)
    stiffness_level: int = Field(ge=0, le=10)
    morning_stiffness_minutes: int = 0
    swelling: str = "mild"
    daily_difficulty: str = "none"
    notes: str = ""


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_data(db: Session) -> None:
    if db.query(Assessment).count() > 0:
        return

    anchor = datetime.now(timezone.utc)
    sample_assessments = [
        {
            "assessment_type": "open_close_fist",
            "hand": "left",
            "recorded_at": anchor - timedelta(days=26),
            "duration_seconds": 44.0,
            "repetition_count": 9,
            "range_of_motion": 62.4,
            "finger_flexion": 73.5,
            "finger_extension": 54.0,
            "movement_speed": 11.4,
            "movement_consistency": 81.0,
            "tracking_quality": 92.0,
            "notes": "Stable movement with mild fatigue at the end of the set.",
        },
        {
            "assessment_type": "finger_flexion",
            "hand": "right",
            "recorded_at": anchor - timedelta(days=19),
            "duration_seconds": 38.0,
            "repetition_count": 12,
            "range_of_motion": 69.8,
            "finger_flexion": 81.0,
            "finger_extension": 58.2,
            "movement_speed": 13.6,
            "movement_consistency": 84.0,
            "tracking_quality": 95.0,
            "notes": "Consistent extension, slightly reduced on ring finger.",
        },
        {
            "assessment_type": "thumb_opposition",
            "hand": "left",
            "recorded_at": anchor - timedelta(days=12),
            "duration_seconds": 52.0,
            "repetition_count": 10,
            "range_of_motion": 58.3,
            "finger_flexion": 71.0,
            "finger_extension": 49.5,
            "movement_speed": 10.9,
            "movement_consistency": 78.0,
            "tracking_quality": 89.0,
            "notes": "Thumb opposition more variable on the index and pinky reach.",
        },
        {
            "assessment_type": "finger_abduction",
            "hand": "right",
            "recorded_at": anchor - timedelta(days=6),
            "duration_seconds": 33.0,
            "repetition_count": 14,
            "range_of_motion": 71.4,
            "finger_flexion": 76.9,
            "finger_extension": 61.3,
            "movement_speed": 15.1,
            "movement_consistency": 88.0,
            "tracking_quality": 93.0,
            "notes": "Good spread with strong repeatability.",
        },
        {
            "assessment_type": "open_close_fist",
            "hand": "left",
            "recorded_at": anchor - timedelta(days=1),
            "duration_seconds": 41.0,
            "repetition_count": 11,
            "range_of_motion": 54.6,
            "finger_flexion": 68.3,
            "finger_extension": 43.9,
            "movement_speed": 9.8,
            "movement_consistency": 72.0,
            "tracking_quality": 85.0,
            "notes": "Noticeable reduction in flexion and extension compared with earlier baseline.",
        },
    ]

    for item in sample_assessments:
        db.add(Assessment(**item))

    symptom_rows = [
        {
            "recorded_at": anchor - timedelta(days=14),
            "pain_level": 3,
            "stiffness_level": 4,
            "morning_stiffness_minutes": 22,
            "swelling": "mild",
            "daily_difficulty": "moderate",
            "notes": "Morning stiffness improved after warm-up exercises.",
        },
        {
            "recorded_at": anchor - timedelta(days=7),
            "pain_level": 4,
            "stiffness_level": 5,
            "morning_stiffness_minutes": 30,
            "swelling": "moderate",
            "daily_difficulty": "moderate",
            "notes": "More stiffness after working at the desk or using a keyboard.",
        },
        {
            "recorded_at": anchor - timedelta(days=2),
            "pain_level": 5,
            "stiffness_level": 6,
            "morning_stiffness_minutes": 35,
            "swelling": "moderate",
            "daily_difficulty": "high",
            "notes": "Feeling more limited in hand opening and grip preparation.",
        },
    ]

    for row in symptom_rows:
        db.add(SymptomRecord(**row))

    db.commit()


def safe_avg(items: List[float]) -> float:
    return float(np.mean(items)) if items else 0.0


def assessment_to_dict(assessment: Assessment) -> dict[str, Any]:
    return {
        "id": assessment.id,
        "assessment_type": assessment.assessment_type,
        "hand": assessment.hand,
        "recorded_at": assessment.recorded_at.isoformat(),
        "duration_seconds": assessment.duration_seconds,
        "repetition_count": assessment.repetition_count,
        "range_of_motion": round(assessment.range_of_motion, 2),
        "finger_flexion": round(assessment.finger_flexion, 2),
        "finger_extension": round(assessment.finger_extension, 2),
        "movement_speed": round(assessment.movement_speed, 2),
        "movement_consistency": round(assessment.movement_consistency, 2),
        "tracking_quality": round(assessment.tracking_quality, 2),
        "notes": assessment.notes,
    }


def compute_dashboard(db: Session) -> dict[str, Any]:
    assessments = db.scalars(select(Assessment).order_by(Assessment.recorded_at.asc())).all()
    if not assessments:
        return {
            "latest": None,
            "trend": [],
            "left_vs_right": {"left": 0.0, "right": 0.0},
            "completion_history": [],
            "recent_activity": [],
            "baseline_delta": 0.0,
            "alerts": [],
            "summary": {
                "total_assessments": 0,
                "baseline_range": 0.0,
                "tracking_quality": 0.0,
            },
        }

    timeline = [assessment_to_dict(item) for item in assessments]
    latest = timeline[-1]
    baseline_values = [item["range_of_motion"] for item in timeline[:-1]]
    baseline_mean = safe_avg(baseline_values)
    latest_value = latest["range_of_motion"]
    baseline_delta = latest_value - baseline_mean

    left_values = [item["range_of_motion"] for item in timeline if item["hand"] == "left"]
    right_values = [item["range_of_motion"] for item in timeline if item["hand"] == "right"]
    completion_history = []
    for item in timeline:
        completion_history.append({
            "name": item["assessment_type"],
            "value": item["repetition_count"],
        })

    alerts = []
    if len(timeline) >= 2 and baseline_delta < -8:
        alerts.append({
            "title": "Functional change alert",
            "message": "Your average finger extension range has decreased relative to your recent baseline. Consider discussing persistent changes with your healthcare professional.",
            "severity": "warning",
        })
    if latest["tracking_quality"] < 80:
        alerts.append({
            "title": "Tracking quality",
            "message": "Recent camera tracking quality was lower than ideal. Repeat the assessment with a clearer hand position.",
            "severity": "info",
        })

    recent_activity = list(reversed(timeline[-5:]))

    return {
        "latest": latest,
        "trend": [{"date": item["recorded_at"][:10], "value": item["range_of_motion"]} for item in timeline],
        "left_vs_right": {
            "left": round(safe_avg(left_values), 2),
            "right": round(safe_avg(right_values), 2),
        },
        "completion_history": completion_history,
        "recent_activity": recent_activity,
        "baseline_delta": round(baseline_delta, 2),
        "alerts": alerts,
        "summary": {
            "total_assessments": len(timeline),
            "baseline_range": round(baseline_mean, 2),
            "tracking_quality": round(safe_avg([item["tracking_quality"] for item in timeline]), 2),
        },
    }


def compute_analytics(db: Session) -> dict[str, Any]:
    assessments = db.scalars(select(Assessment).order_by(Assessment.recorded_at.asc())).all()
    timeline = [assessment_to_dict(item) for item in assessments]

    left_data = [item for item in timeline if item["hand"] == "left"]
    right_data = [item for item in timeline if item["hand"] == "right"]
    weekly = []
    for item in timeline:
        weekly.append({
            "date": item["recorded_at"][:10],
            "range": item["range_of_motion"],
            "speed": item["movement_speed"],
            "consistency": item["movement_consistency"],
        })

    return {
        "trend": weekly,
        "range_of_motion": weekly,
        "movement_speed": [{"date": item["recorded_at"][:10], "value": item["movement_speed"]} for item in timeline],
        "hand_comparison": {
            "left": [
                {"date": item["recorded_at"][:10], "value": item["range_of_motion"]}
                for item in left_data
            ],
            "right": [
                {"date": item["recorded_at"][:10], "value": item["range_of_motion"]}
                for item in right_data
            ],
        },
        "baseline_delta": round(
            (timeline[-1]["range_of_motion"] if timeline else 0) - safe_avg([item["range_of_motion"] for item in timeline[:-1]]), 2
        ),
    }


def compute_insights(db: Session) -> dict[str, Any]:
    assessments = db.scalars(select(Assessment).order_by(Assessment.recorded_at.asc())).all()
    if len(assessments) < 3:
        return {
            "status": "insufficient_history",
            "message": "More assessments are needed to establish a stable baseline for trend analysis.",
            "cards": [],
        }

    values = np.array([assessment.range_of_motion for assessment in assessments], dtype=float)
    recent = values[-1]
    baseline = values[:-1].mean()
    delta = recent - baseline

    cards = []
    if delta < -5:
        cards.append({
            "title": "Range-of-motion reduction",
            "direction": "down",
            "message": "Your average finger extension range has decreased compared with your previous assessments. Consider discussing persistent changes with your healthcare professional.",
        })
    else:
        cards.append({
            "title": "Range-of-motion stability",
            "direction": "steady",
            "message": "Your recent measurements remain within your typical variation. Continue monitoring for sustained changes over time.",
        })

    if len(assessments) >= 6:
        model = IsolationForest(contamination=0.2, random_state=42)
        model.fit(values.reshape(-1, 1))
        score = model.predict(np.array([[recent]])).item()
        if score == -1:
            cards.append({
                "title": "Anomaly check",
                "direction": "alert",
                "message": "The most recent observation is outside the expected pattern for your recent data. This is not a diagnosis, but it may merit an additional check-in.",
            })

    cards.append({
        "title": "Tracking quality check",
        "direction": "info",
        "message": f"Average tracking quality is {round(float(np.mean([a.tracking_quality for a in assessments])), 1)}%. This is used to interpret the signal and avoid over-weighting low-quality recordings.",
    })

    return {
        "status": "ok" if cards else "insufficient_history",
        "message": "Interpretable trend monitoring using recent and historical measurements.",
        "cards": cards,
    }


app = FastAPI(title="ArthriTrack API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    return compute_dashboard(db)


@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)) -> dict[str, Any]:
    return compute_analytics(db)


@app.get("/api/insights")
def insights(db: Session = Depends(get_db)) -> dict[str, Any]:
    return compute_insights(db)


@app.get("/api/assessments")
def get_assessments(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    assessments = db.scalars(select(Assessment).order_by(Assessment.recorded_at.asc())).all()
    return [assessment_to_dict(item) for item in assessments]


@app.post("/api/assessments")
def create_assessment(payload: AssessmentCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    item = Assessment(
        assessment_type=payload.assessment_type,
        hand=payload.hand,
        duration_seconds=payload.duration_seconds,
        repetition_count=payload.repetition_count,
        range_of_motion=payload.range_of_motion,
        finger_flexion=payload.finger_flexion,
        finger_extension=payload.finger_extension,
        movement_speed=payload.movement_speed,
        movement_consistency=payload.movement_consistency,
        tracking_quality=payload.tracking_quality,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return assessment_to_dict(item)


@app.get("/api/symptoms")
def get_symptoms(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    symptoms = db.scalars(select(SymptomRecord).order_by(SymptomRecord.recorded_at.asc())).all()
    return [
        {
            "id": row.id,
            "recorded_at": row.recorded_at.isoformat(),
            "pain_level": row.pain_level,
            "stiffness_level": row.stiffness_level,
            "morning_stiffness_minutes": row.morning_stiffness_minutes,
            "swelling": row.swelling,
            "daily_difficulty": row.daily_difficulty,
            "notes": row.notes,
        }
        for row in symptoms
    ]


@app.post("/api/symptoms")
def create_symptom(payload: SymptomCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    item = SymptomRecord(
        pain_level=payload.pain_level,
        stiffness_level=payload.stiffness_level,
        morning_stiffness_minutes=payload.morning_stiffness_minutes,
        swelling=payload.swelling,
        daily_difficulty=payload.daily_difficulty,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "recorded_at": item.recorded_at.isoformat(),
        "pain_level": item.pain_level,
        "stiffness_level": item.stiffness_level,
        "morning_stiffness_minutes": item.morning_stiffness_minutes,
        "swelling": item.swelling,
        "daily_difficulty": item.daily_difficulty,
        "notes": item.notes,
    }


@app.get("/api/rehab")
def rehab() -> list[dict[str, Any]]:
    return [
        {
            "name": "Warm-up finger mobility",
            "duration_minutes": 6,
            "focus": "Joint lubrication and range-of-motion readiness",
            "difficulty": "Low",
        },
        {
            "name": "Fist opening and release",
            "duration_minutes": 8,
            "focus": "Flexion and extension coordination",
            "difficulty": "Moderate",
        },
        {
            "name": "Thumb opposition pattern",
            "duration_minutes": 7,
            "focus": "Precision touch and thumb mobility",
            "difficulty": "Moderate",
        },
        {
            "name": "Finger spread recovery",
            "duration_minutes": 5,
            "focus": "Abduction and adduction control",
            "difficulty": "Low",
        },
    ]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
