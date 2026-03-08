import glob
import json
import logging
import os
import pickle
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3
import numpy as np
import pandas as pd
from botocore.exceptions import BotoCoreError, ClientError
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder

from config import settings

logger = logging.getLogger(__name__)

RAIN_COL = "Rain (mm)"
MIN_HUM_COL = "Min Humidity (%)"
MAX_HUM_COL = "Max Humidity (%)"
DISTRICT_COL = "District"
MANDAL_COL = "Mandal"
DATE_COL = "Date"

FEATURES = [
    "total_rain_mm",
    "rain_days",
    "max_daily_rain",
    "avg_min_humidity",
    "avg_max_humidity",
    "max_dry_streak",
    "normal_rain_mm",
    "rain_deviation_pct",
    "Month",
    "prev_month_rain",
    "prev_month_risk_score",
]

RISK_ORDER = ["NORMAL", "MILD", "MODERATE", "SEVERE"]
RISK_SCORE_MAP = {"NORMAL": 10.0, "MILD": 30.0, "MODERATE": 55.0, "SEVERE": 80.0}
RAIN_MULTIPLIER_MAP = {"NORMAL": 1.05, "MILD": 0.9, "MODERATE": 0.75, "SEVERE": 0.55}


@dataclass
class ForecastResult:
    selected_mandal: str
    district: str
    history: List[Dict[str, Any]]
    forecast: List[Dict[str, Any]]
    chart_data: List[Dict[str, Any]]
    suggested_crops: str
    available_mandals: List[str]
    model_info: Dict[str, Any]


class RainfallService:
    def __init__(self):
        project_root = Path(__file__).resolve().parents[2]
        self.data_dir = project_root / "resources" / "rainfalldataset"
        self.output_dir = project_root / "resources" / "outputs"
        self.artifact_dir = project_root / "backend" / "artifacts"
        self.model_path = self.artifact_dir / "rainfall_drought_model.pkl"
        self.monthly_path = self.artifact_dir / "rainfall_monthly_features.csv"
        self.script_model_path = self.output_dir / "drought_model.pkl"
        self.script_risk_path = self.output_dir / "mandal_drought_risk.csv"

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.artifact_dir.mkdir(parents=True, exist_ok=True)

        self._model_bundle: Optional[Dict[str, Any]] = None

    def _load_script05_bundle(self) -> Dict[str, Any]:
        """Load script-05 model bundle from resources/outputs."""
        if not self.script_model_path.exists():
            # Fallback to service-trained artifact if script output does not exist yet.
            return self._retrain_script05_bundle()

        try:
            with open(self.script_model_path, "rb") as handle:
                bundle = pickle.load(handle)
        except Exception as exc:
            logger.warning(
                f"Script-05 model could not be loaded ({exc}); retraining a compatible model now."
            )
            return self._retrain_script05_bundle()

        if not {"model", "label_encoder"}.issubset(set(bundle.keys())):
            raise ValueError(f"Invalid script model bundle at {self.script_model_path}")

        features = bundle.get("features") or FEATURES
        bundle["features"] = list(features)
        return bundle

    def _retrain_script05_bundle(self) -> Dict[str, Any]:
        """
        Rebuild Script-05 compatible bundle using risk CSV when pickle is incompatible
        (e.g. sklearn version mismatch like missing '_loss').
        """
        df = self._load_script05_risk_df()
        if "drought_risk_level" not in df.columns:
            raise ValueError("drought_risk_level is missing in risk data")

        work = df.dropna(subset=["drought_risk_level"]).copy()
        work = work[work["drought_risk_level"].isin(RISK_ORDER)].copy()
        if work.empty:
            raise ValueError("No valid drought risk rows available for model retraining")

        # Keep feature preparation aligned to Script-05.
        for feature in FEATURES:
            if feature not in work.columns:
                work[feature] = 0.0
            work[feature] = pd.to_numeric(work[feature], errors="coerce")
            work[feature] = work[feature].replace([np.inf, -np.inf], np.nan)
            work[feature] = work[feature].fillna(work[feature].median() if work[feature].notna().any() else 0.0)

        le = LabelEncoder()
        le.fit(RISK_ORDER)
        y = le.transform(work["drought_risk_level"])
        X = work[FEATURES].values

        model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            random_state=42,
        )
        model.fit(X, y)

        bundle = {
            "model": model,
            "label_encoder": le,
            "features": FEATURES,
            "trained_at": datetime.utcnow().isoformat(),
        }

        try:
            with open(self.script_model_path, "wb") as handle:
                pickle.dump(bundle, handle)
            logger.info(f"Rebuilt Script-05 model saved: {self.script_model_path}")
        except Exception as exc:
            logger.warning(f"Could not persist rebuilt Script-05 model: {exc}")

        return bundle

    def _load_script05_risk_df(self) -> pd.DataFrame:
        """Load Script-05 risk input data from resources/outputs."""
        if self.script_risk_path.exists():
            df = pd.read_csv(self.script_risk_path)
        else:
            # Fallback to service cache if script output is absent.
            df = self._load_monthly_df()

        for col in [DISTRICT_COL, MANDAL_COL]:
            if col not in df.columns:
                raise ValueError(f"Required column missing in risk data: {col}")
            df[col] = df[col].astype(str).str.strip().str.title()

        for col in ["Year", "Month"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.sort_values([DISTRICT_COL, MANDAL_COL, "Year", "Month"], na_position="last").reset_index(drop=True)
        return df

    def _initialize_bedrock_client(self):
        client_kwargs = {"region_name": settings.AWS_REGION}

        if settings.AWS_PROFILE:
            session = boto3.Session(profile_name=settings.AWS_PROFILE)
            client_factory = session.client
        else:
            client_factory = boto3.client

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        if settings.AWS_SESSION_TOKEN:
            client_kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN

        return client_factory("bedrock-runtime", **client_kwargs)

    def _load_all_rainfall(self) -> pd.DataFrame:
        files = sorted(glob.glob(str(self.data_dir / "**" / "*.csv"), recursive=True))
        if not files:
            raise FileNotFoundError(f"No rainfall CSVs found in {self.data_dir}")

        frames = []
        for file_path in files:
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
                df.columns = df.columns.str.strip()
                df["_source_file"] = os.path.basename(file_path)
                frames.append(df)
            except Exception as exc:
                logger.warning(f"Skipping unreadable CSV {file_path}: {exc}")

        if not frames:
            raise RuntimeError("Could not load any rainfall CSVs")

        return pd.concat(frames, ignore_index=True)

    def _clean_rainfall(self, df: pd.DataFrame) -> pd.DataFrame:
        required_cols = {DISTRICT_COL, MANDAL_COL, DATE_COL, RAIN_COL, MIN_HUM_COL, MAX_HUM_COL}
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required rainfall columns: {missing}")

        clean = df.copy()
        clean.columns = clean.columns.str.strip()
        clean[DISTRICT_COL] = clean[DISTRICT_COL].astype(str).str.strip().str.title()
        clean[MANDAL_COL] = clean[MANDAL_COL].astype(str).str.strip().str.title()

        clean[DATE_COL] = pd.to_datetime(clean[DATE_COL], dayfirst=True, errors="coerce")
        clean = clean.dropna(subset=[DATE_COL])

        for col in [RAIN_COL, MIN_HUM_COL, MAX_HUM_COL]:
            clean[col] = pd.to_numeric(clean[col], errors="coerce")

        clean[RAIN_COL] = clean[RAIN_COL].clip(lower=0)
        clean["Year"] = clean[DATE_COL].dt.year
        clean["Month"] = clean[DATE_COL].dt.month

        clean = clean.drop_duplicates(subset=[DISTRICT_COL, MANDAL_COL, DATE_COL])
        clean = clean.sort_values([DISTRICT_COL, MANDAL_COL, DATE_COL]).reset_index(drop=True)

        return clean

    def _engineer_daily(self, df: pd.DataFrame) -> pd.DataFrame:
        daily = df.copy()
        key = [DISTRICT_COL, MANDAL_COL]

        daily["is_dry_day"] = (daily[RAIN_COL] == 0).astype(int)

        def dry_streak(series: pd.Series) -> List[int]:
            streak = 0
            out: List[int] = []
            for value in series:
                streak = streak + 1 if value == 1 else 0
                out.append(streak)
            return out

        daily["dry_streak_days"] = daily.groupby(key)["is_dry_day"].transform(dry_streak)
        return daily

    def _monthly_summary(self, daily: pd.DataFrame) -> pd.DataFrame:
        key = [DISTRICT_COL, MANDAL_COL, "Year", "Month"]
        monthly = daily.groupby(key).agg(
            total_rain_mm=(RAIN_COL, "sum"),
            rain_days=("is_dry_day", lambda x: int((x == 0).sum())),
            max_daily_rain=(RAIN_COL, "max"),
            avg_min_humidity=(MIN_HUM_COL, "mean"),
            avg_max_humidity=(MAX_HUM_COL, "mean"),
            max_dry_streak=("dry_streak_days", "max"),
        ).reset_index()

        normals = (
            monthly.groupby([DISTRICT_COL, MANDAL_COL, "Month"])["total_rain_mm"]
            .mean()
            .rename("normal_rain_mm")
            .reset_index()
        )
        monthly = monthly.merge(normals, on=[DISTRICT_COL, MANDAL_COL, "Month"], how="left")

        monthly["rain_deviation_pct"] = (
            (monthly["total_rain_mm"] - monthly["normal_rain_mm"])
            / monthly["normal_rain_mm"].replace(0, np.nan)
            * 100
        ).round(1)
        monthly["rain_deviation_pct"] = monthly["rain_deviation_pct"].replace([np.inf, -np.inf], np.nan).fillna(0)

        return monthly

    def _compute_risk(self, monthly: pd.DataFrame) -> pd.DataFrame:
        risk = monthly.copy()

        deficit = (-risk["rain_deviation_pct"]).clip(0, 100) / 100
        streak = (risk["max_dry_streak"] / 30).clip(0, 1)
        hum_stress = (1 - risk["avg_max_humidity"] / 100).clip(0, 1)

        risk["drought_risk_score"] = ((0.4 * deficit) + (0.3 * streak) + (0.3 * hum_stress)) * 100
        risk["drought_risk_score"] = risk["drought_risk_score"].round(1)

        def label(score: float) -> str:
            if score >= 70:
                return "SEVERE"
            if score >= 45:
                return "MODERATE"
            if score >= 20:
                return "MILD"
            return "NORMAL"

        risk["drought_risk_level"] = risk["drought_risk_score"].apply(label)

        risk = risk.sort_values([DISTRICT_COL, MANDAL_COL, "Year", "Month"]).reset_index(drop=True)
        risk["prev_month_rain"] = risk.groupby([DISTRICT_COL, MANDAL_COL])["total_rain_mm"].shift(1).fillna(0)
        risk["prev_month_risk_score"] = risk.groupby([DISTRICT_COL, MANDAL_COL])["drought_risk_score"].shift(1).fillna(0)

        for feature in FEATURES:
            if feature in risk.columns:
                risk[feature] = risk[feature].replace([np.inf, -np.inf], np.nan)
                risk[feature] = risk[feature].fillna(risk[feature].median())

        return risk

    def train_and_save_model(self, force: bool = False) -> Dict[str, Any]:
        if self.model_path.exists() and self.monthly_path.exists() and not force:
            return self.load_model_bundle()

        raw = self._load_all_rainfall()
        clean = self._clean_rainfall(raw)
        daily = self._engineer_daily(clean)
        monthly = self._monthly_summary(daily)
        risk = self._compute_risk(monthly)

        risk = risk[risk["drought_risk_level"].isin(RISK_ORDER)].copy()

        label_encoder = LabelEncoder()
        label_encoder.fit(RISK_ORDER)
        risk["target_encoded"] = label_encoder.transform(risk["drought_risk_level"])

        X = risk[FEATURES].values
        y = risk["target_encoded"].values

        model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            random_state=42,
        )
        model.fit(X, y)

        normal_lookup = {
            f"{row[DISTRICT_COL]}::{row[MANDAL_COL]}::{int(row['Month'])}": float(row["normal_rain_mm"])
            for _, row in risk[[DISTRICT_COL, MANDAL_COL, "Month", "normal_rain_mm"]].drop_duplicates().iterrows()
        }

        bundle = {
            "model": model,
            "label_encoder": label_encoder,
            "features": FEATURES,
            "trained_at": datetime.utcnow().isoformat(),
            "normal_lookup": normal_lookup,
            "risk_order": RISK_ORDER,
        }

        with open(self.model_path, "wb") as handle:
            pickle.dump(bundle, handle)

        risk.to_csv(self.monthly_path, index=False)

        # Keep resource outputs aligned with user's scripts request.
        risk.to_csv(self.output_dir / "mandal_drought_risk.csv", index=False)
        with open(self.output_dir / "drought_model.pkl", "wb") as handle:
            pickle.dump(bundle, handle)

        self._model_bundle = bundle
        logger.info(f"Rainfall model trained and saved: {self.model_path}")
        return bundle

    def load_model_bundle(self) -> Dict[str, Any]:
        if self._model_bundle is not None:
            return self._model_bundle

        if not self.model_path.exists() or not self.monthly_path.exists():
            return self.train_and_save_model(force=True)

        try:
            with open(self.model_path, "rb") as handle:
                self._model_bundle = pickle.load(handle)
        except Exception as exc:
            logger.warning(f"Existing rainfall model artifact could not be loaded ({exc}); retraining now.")
            return self.train_and_save_model(force=True)

        return self._model_bundle

    def _load_monthly_df(self) -> pd.DataFrame:
        if not self.monthly_path.exists():
            self.train_and_save_model(force=True)
        return pd.read_csv(self.monthly_path)

    def get_available_mandals(self, district: str) -> List[str]:
        df = self._load_monthly_df()
        mandals = sorted(df[df[DISTRICT_COL].str.lower() == district.lower()][MANDAL_COL].dropna().unique().tolist())
        return mandals

    def _fallback_crop_suggestion(self, district: str, mandal: str, forecast: List[Dict[str, Any]]) -> str:
        severe_months = len([f for f in forecast if f.get("predicted_risk_level") == "SEVERE"])
        moderate_months = len([f for f in forecast if f.get("predicted_risk_level") == "MODERATE"])

        if severe_months >= 2:
            return (
                f"For {mandal}, {district}: prioritise drought-tolerant crops like millets, red gram, green gram, "
                "and short-duration varieties; avoid water-intensive crops in upcoming months."
            )
        if severe_months + moderate_months >= 2:
            return (
                f"For {mandal}, {district}: prefer medium water-demand crops (maize, pulses, groundnut) with moisture-conserving practices."
            )
        return (
            f"For {mandal}, {district}: rainfall outlook is relatively stable; paddy/cotton can be considered where irrigation exists, "
            "otherwise diversify with pulses and oilseeds."
        )

    def _generate_crop_suggestion(self, district: str, mandal: str, forecast: List[Dict[str, Any]]) -> str:
        def _sanitize(text: str) -> str:
            cleaned = (text or "")
            cleaned = cleaned.replace("**", "")
            cleaned = cleaned.replace("###", "").replace("##", "").replace("#", "")
            cleaned = cleaned.replace("\r", "")
            lines = []
            for raw in cleaned.split("\n"):
                line = raw.strip()
                if not line:
                    continue
                line = line.removeprefix("- ").strip()
                line = line.removeprefix("* ").strip()
                lines.append(line)
            return "\n".join(lines).strip()

        try:
            client = self._initialize_bedrock_client()
            model_id = settings.BEDROCK_INFERENCE_PROFILE_ID or settings.BEDROCK_MODEL_ID
            compact = [
                {
                    "month": row["month"],
                    "predicted_rain_mm": row["predicted_rain_mm"],
                    "predicted_risk_level": row["predicted_risk_level"],
                }
                for row in forecast
            ]

            prompt = (
                "You are an agriculture advisory assistant for Telangana. "
                "Given forecasted rainfall and drought risk for the next months, provide crop suggestions. "
                "Respond as plain text only. Do NOT use markdown symbols like -, *, #, or **.\n"
                "Format exactly like this pattern per month:\n"
                "Month: <Month YYYY> (Predicted Rainfall: <mm>, Risk Level: <level>)\n"
                "Crop Suggestion: <text>\n"
                "Action: <text>\n\n"
                "Then add:\n"
                "General Actions:\n"
                "Soil Health Management: <text>\n\n"
                f"District: {district}\nMandal: {mandal}\nForecast: {json.dumps(compact)}"
            )

            body = {
                "schemaVersion": "messages-v1",
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {
                    "maxTokens": 300,
                    "temperature": 0.2,
                },
            }

            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            parsed = json.loads(response["body"].read())
            content = parsed.get("output", {}).get("message", {}).get("content", [])
            parts = [entry.get("text", "") for entry in content if isinstance(entry, dict)]
            suggestion = _sanitize("\n".join([part for part in parts if part]).strip())
            return suggestion or self._fallback_crop_suggestion(district, mandal, forecast)
        except (ClientError, BotoCoreError, Exception) as exc:
            logger.warning(f"Crop suggestion fallback used due to Bedrock error: {exc}")
            return self._fallback_crop_suggestion(district, mandal, forecast)

    def forecast_for_mandal(self, district: str, mandal: str, months_ahead: int = 4) -> ForecastResult:
        bundle = self.load_model_bundle()
        model = bundle["model"]
        le: LabelEncoder = bundle["label_encoder"]
        normal_lookup: Dict[str, float] = bundle.get("normal_lookup", {})

        df = self._load_monthly_df()
        scoped = df[
            (df[DISTRICT_COL].str.lower() == district.lower())
            & (df[MANDAL_COL].str.lower() == mandal.lower())
        ].copy()
        if scoped.empty:
            raise ValueError(f"No rainfall records found for {district} / {mandal}")

        scoped = scoped.sort_values(["Year", "Month"]).reset_index(drop=True)
        history_tail = scoped.tail(12)

        history = []
        for _, row in history_tail.iterrows():
            history.append(
                {
                    "month": f"{int(row['Year'])}-{int(row['Month']):02d}",
                    "rainfall_mm": round(float(row["total_rain_mm"]), 2),
                    "risk_level": row["drought_risk_level"],
                }
            )

        current = scoped.iloc[-1].to_dict()
        forecast_rows = []

        for _ in range(max(1, int(months_ahead))):
            next_month = (int(current["Month"]) % 12) + 1
            next_year = int(current["Year"]) + (1 if next_month == 1 and int(current["Month"]) == 12 else 0)

            key = f"{current[DISTRICT_COL]}::{current[MANDAL_COL]}::{next_month}"
            normal_rain = float(normal_lookup.get(key, current.get("normal_rain_mm", 0.0)))

            feature_row = {
                "total_rain_mm": float(current.get("total_rain_mm", 0.0)),
                "rain_days": float(current.get("rain_days", 0.0)),
                "max_daily_rain": float(current.get("max_daily_rain", 0.0)),
                "avg_min_humidity": float(current.get("avg_min_humidity", 0.0)),
                "avg_max_humidity": float(current.get("avg_max_humidity", 0.0)),
                "max_dry_streak": float(current.get("max_dry_streak", 0.0)),
                "normal_rain_mm": normal_rain,
                "rain_deviation_pct": float(current.get("rain_deviation_pct", 0.0)),
                "Month": float(next_month),
                "prev_month_rain": float(current.get("total_rain_mm", 0.0)),
                "prev_month_risk_score": float(current.get("drought_risk_score", 0.0)),
            }

            X_next = np.array([[feature_row[f] for f in FEATURES]])
            pred_encoded = int(model.predict(X_next)[0])
            proba = model.predict_proba(X_next)[0]
            risk_level = str(le.inverse_transform([pred_encoded])[0])
            confidence = round(float(np.max(proba)) * 100, 1)

            predicted_rain = round(normal_rain * RAIN_MULTIPLIER_MAP.get(risk_level, 1.0), 2)

            forecast_rows.append(
                {
                    "month": f"{next_year}-{next_month:02d}",
                    "predicted_rain_mm": predicted_rain,
                    "predicted_risk_level": risk_level,
                    "confidence_pct": confidence,
                    "probabilities": {
                        cls.lower(): round(float(proba[idx]) * 100, 1)
                        for idx, cls in enumerate(le.classes_)
                    },
                }
            )

            current["Year"] = next_year
            current["Month"] = next_month
            current["total_rain_mm"] = predicted_rain
            current["drought_risk_level"] = risk_level
            current["drought_risk_score"] = RISK_SCORE_MAP.get(risk_level, 40.0)
            current["rain_deviation_pct"] = 0.0 if normal_rain == 0 else round(((predicted_rain - normal_rain) / normal_rain) * 100, 1)
            current["max_daily_rain"] = max(predicted_rain * 0.35, 0.0)
            current["rain_days"] = max(1.0, min(31.0, round(predicted_rain / 8.0, 1)))
            current["max_dry_streak"] = max(0.0, 30.0 - current["rain_days"])
            current["avg_min_humidity"] = float(current.get("avg_min_humidity", 60.0))
            current["avg_max_humidity"] = float(current.get("avg_max_humidity", 80.0))
            current["normal_rain_mm"] = normal_rain

        chart_data: List[Dict[str, Any]] = []
        for row in history:
            chart_data.append(
                {
                    "month": row["month"],
                    "actual_rain_mm": row["rainfall_mm"],
                    "forecast_rain_mm": None,
                }
            )
        for row in forecast_rows:
            chart_data.append(
                {
                    "month": row["month"],
                    "actual_rain_mm": None,
                    "forecast_rain_mm": row["predicted_rain_mm"],
                }
            )

        suggestion = self._generate_crop_suggestion(district=district, mandal=mandal, forecast=forecast_rows)
        mandals = self.get_available_mandals(district)

        return ForecastResult(
            selected_mandal=mandal,
            district=district,
            history=history,
            forecast=forecast_rows,
            chart_data=chart_data,
            suggested_crops=suggestion,
            available_mandals=mandals,
            model_info={
                "trained_at": bundle.get("trained_at"),
                "model_path": str(self.model_path),
            },
        )

    def refresh_forecast(self, district: str, mandal: str, months_ahead: int = 4) -> ForecastResult:
        # Refresh uses saved model artifacts (no retraining), and recomputes forecast.
        self._model_bundle = None
        return self.forecast_for_mandal(district=district, mandal=mandal, months_ahead=months_ahead)

    def district_yearly_drought_analysis(self, district: str, months_ahead: int = 12) -> Dict[str, Any]:
        """
        Predict drought possibility for each mandal in the district for the next year
        using script-05 artifacts in resources/outputs.
        """
        district_name = (district or "").strip().title()
        if not district_name:
            raise ValueError("District is required")

        horizon = max(1, min(12, int(months_ahead)))
        bundle = self._load_script05_bundle()
        model = bundle["model"]
        le: LabelEncoder = bundle["label_encoder"]
        feature_names = bundle.get("features") or FEATURES

        df = self._load_script05_risk_df()
        scoped = df[df[DISTRICT_COL].str.lower() == district_name.lower()].copy()
        if scoped.empty:
            raise ValueError(f"No drought risk data found for district: {district_name}")

        normals = (
            scoped.groupby([DISTRICT_COL, MANDAL_COL, "Month"])["normal_rain_mm"]
            .mean()
            .fillna(0)
            .to_dict()
            if "normal_rain_mm" in scoped.columns
            else {}
        )

        results: List[Dict[str, Any]] = []
        for mandal, group in scoped.groupby(MANDAL_COL):
            group = group.sort_values(["Year", "Month"]).reset_index(drop=True)
            current = group.iloc[-1].to_dict()

            monthly: List[Dict[str, Any]] = []
            drought_probs: List[float] = []
            predicted_levels: List[str] = []

            for _ in range(horizon):
                cur_month = int(current.get("Month", 1))
                cur_year = int(current.get("Year", datetime.utcnow().year))
                next_month = (cur_month % 12) + 1
                next_year = cur_year + (1 if cur_month == 12 else 0)

                normal_rain = float(
                    normals.get((district_name, mandal, next_month), current.get("normal_rain_mm", current.get("total_rain_mm", 0.0)))
                )
                prev_rain = float(current.get("total_rain_mm", 0.0))
                prev_risk_score = float(current.get("drought_risk_score", 0.0))

                feature_row = {
                    "total_rain_mm": prev_rain,
                    "rain_days": float(current.get("rain_days", 0.0)),
                    "max_daily_rain": float(current.get("max_daily_rain", 0.0)),
                    "avg_min_humidity": float(current.get("avg_min_humidity", 0.0)),
                    "avg_max_humidity": float(current.get("avg_max_humidity", 0.0)),
                    "max_dry_streak": float(current.get("max_dry_streak", 0.0)),
                    "normal_rain_mm": normal_rain,
                    "rain_deviation_pct": float(current.get("rain_deviation_pct", 0.0)),
                    "Month": float(next_month),
                    "prev_month_rain": prev_rain,
                    "prev_month_risk_score": prev_risk_score,
                }

                X_next = np.array([[float(feature_row.get(f, 0.0)) for f in feature_names]])
                pred_encoded = int(model.predict(X_next)[0])
                proba = model.predict_proba(X_next)[0]
                classes = list(le.classes_)
                risk_level = str(le.inverse_transform([pred_encoded])[0])

                proba_map = {str(classes[idx]): float(proba[idx]) for idx in range(len(classes))}
                # Weighted drought probability avoids extreme 100% yearly saturation.
                # NORMAL contributes 0, MILD contributes partially, MODERATE/SEVERE contribute strongly.
                drought_prob = float(
                    (0.35 * proba_map.get("MILD", 0.0))
                    + (0.7 * proba_map.get("MODERATE", 0.0))
                    + (1.0 * proba_map.get("SEVERE", 0.0))
                )
                severe_prob = float(proba_map.get("SEVERE", 0.0))

                drought_probs.append(drought_prob)
                predicted_levels.append(risk_level)

                monthly.append(
                    {
                        "year": next_year,
                        "month": next_month,
                        "month_label": f"{next_year}-{next_month:02d}",
                        "predicted_risk_level": risk_level,
                        "drought_probability_pct": round(drought_prob * 100, 2),
                        "severe_probability_pct": round(severe_prob * 100, 2),
                    }
                )

                predicted_rain = round(normal_rain * RAIN_MULTIPLIER_MAP.get(risk_level, 1.0), 2)
                current["Year"] = next_year
                current["Month"] = next_month
                current["total_rain_mm"] = predicted_rain
                current["normal_rain_mm"] = normal_rain
                current["drought_risk_level"] = risk_level
                current["drought_risk_score"] = RISK_SCORE_MAP.get(risk_level, 40.0)
                current["rain_deviation_pct"] = 0.0 if normal_rain == 0 else round(((predicted_rain - normal_rain) / normal_rain) * 100, 1)
                current["max_daily_rain"] = max(predicted_rain * 0.35, 0.0)
                current["rain_days"] = max(1.0, min(31.0, round(predicted_rain / 8.0, 1)))
                current["max_dry_streak"] = max(0.0, 30.0 - current["rain_days"])

            annual_possibility = round(float(np.mean(drought_probs)) * 100, 2) if drought_probs else 0.0
            avg_monthly = round(float(np.mean(drought_probs)) * 100, 2) if drought_probs else 0.0
            max_monthly = round(float(np.max(drought_probs)) * 100, 2) if drought_probs else 0.0
            severe_months = int(sum(1 for m in monthly if m["predicted_risk_level"] == "SEVERE"))
            high_risk_months = int(sum(1 for m in monthly if m["drought_probability_pct"] >= 60))
            predominant = pd.Series(predicted_levels).mode().iloc[0] if predicted_levels else "UNKNOWN"

            risk_band = "Low"
            if annual_possibility >= 70:
                risk_band = "Very High"
            elif annual_possibility >= 50:
                risk_band = "High"
            elif annual_possibility >= 30:
                risk_band = "Moderate"

            results.append(
                {
                    "district": district_name,
                    "mandal": mandal,
                    "annual_drought_possibility_pct": annual_possibility,
                    "avg_monthly_drought_probability_pct": avg_monthly,
                    "max_monthly_drought_probability_pct": max_monthly,
                    "severe_months": severe_months,
                    "high_risk_months": high_risk_months,
                    "predominant_risk_level": predominant,
                    "risk_band": risk_band,
                    "monthly_forecast": monthly,
                }
            )

        results = sorted(results, key=lambda row: row["annual_drought_possibility_pct"], reverse=True)
        summary = {
            "total_mandals": len(results),
            "high_or_very_high_mandals": int(sum(1 for row in results if row["risk_band"] in {"High", "Very High"})),
            "avg_district_annual_possibility_pct": round(float(np.mean([row["annual_drought_possibility_pct"] for row in results])), 2) if results else 0.0,
        }

        return {
            "district": district_name,
            "months_ahead": horizon,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": summary,
            "mandals": results,
            "model_info": {
                "model_path": str(self.script_model_path if self.script_model_path.exists() else self.model_path),
                "features": feature_names,
            },
        }

    def answer_dashboard_question(
        self,
        question: str,
        state: str,
        district: str,
        mandal: str,
        village: str,
        history: List[Dict[str, Any]],
        forecast: List[Dict[str, Any]],
    ) -> str:
        fallback = (
            f"Based on available rainfall forecast for {mandal}, {district}, "
            "prefer drought-resilient crop planning and water-conserving practices. "
            "Please ask a specific question for a more targeted answer."
        )

        if not question.strip():
            return fallback

        try:
            client = self._initialize_bedrock_client()
            model_id = settings.BEDROCK_INFERENCE_PROFILE_ID or settings.BEDROCK_MODEL_ID

            context = {
                "state": state,
                "district": district,
                "mandal": mandal,
                "village": village,
                "history_last_6": history[-6:],
                "forecast_next_months": forecast,
            }

            prompt = (
                "You are an agricultural rainfall assistant. "
                "Answer user questions using only the provided location and rainfall context. "
                "Keep response practical and concise.\n\n"
                f"Question: {question}\n\n"
                f"Context JSON: {json.dumps(context)}"
            )

            body = {
                "schemaVersion": "messages-v1",
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {
                    "maxTokens": 300,
                    "temperature": 0.2,
                },
            }
            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            parsed = json.loads(response["body"].read())
            content = parsed.get("output", {}).get("message", {}).get("content", [])
            parts = [entry.get("text", "") for entry in content if isinstance(entry, dict)]
            answer = "\n".join([part for part in parts if part]).strip()
            return answer or fallback
        except (ClientError, BotoCoreError, Exception) as exc:
            logger.warning(f"Dashboard chat fallback used due to Bedrock error: {exc}")
            return fallback


rainfall_service = RainfallService()
