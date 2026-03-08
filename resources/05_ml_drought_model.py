"""
GramSaarthi — Script 05: ML Drought Prediction Model
======================================================
Trains a Gradient Boosting classifier to predict drought risk level
per Mandal for the NEXT month, using historical rainfall features.

INPUT  : outputs/mandal_drought_risk.csv    (from Script 01)
OUTPUT : outputs/ml_model_report.txt        — accuracy, classification report
         outputs/mandal_next_month_forecast.csv — predictions for upcoming month
         outputs/feature_importance.csv     — which features matter most

Run:
    python 05_ml_drought_model.py --output_dir ./outputs
"""

import os
import argparse
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
import pickle
import warnings
warnings.filterwarnings("ignore")

# ── CONSTANTS ─────────────────────────────────────────────────────────────────
FEATURES = [
    "total_rain_mm",
    "rain_days",
    "max_daily_rain",
    "avg_min_humidity",
    "avg_max_humidity",
    "max_dry_streak",
    "normal_rain_mm",
    "rain_deviation_pct",
    "Month",          # seasonality signal
    "prev_month_rain",        # lag feature
    "prev_month_risk_score",  # lag feature
]
TARGET = "drought_risk_level"
RISK_ORDER = ["NORMAL", "MILD", "MODERATE", "SEVERE"]


# ── STEP 1: LOAD & PREPARE DATA ───────────────────────────────────────────────
def prepare_ml_data(risk_path: str) -> pd.DataFrame:
    df = pd.read_csv(risk_path)
    df = df.dropna(subset=["drought_risk_level"])

    # Sort for lag features
    df = df.sort_values(["District", "Mandal", "Year", "Month"]).reset_index(drop=True)

    # LAG FEATURE: previous month's rain and risk score per Mandal
    df["prev_month_rain"] = (df.groupby(["District", "Mandal"])["total_rain_mm"]
                               .shift(1))
    df["prev_month_risk_score"] = (df.groupby(["District", "Mandal"])["drought_risk_score"]
                                     .shift(1))

    # Fill first-month NaN lags with 0
    df["prev_month_rain"]       = df["prev_month_rain"].fillna(0)
    df["prev_month_risk_score"] = df["prev_month_risk_score"].fillna(0)

    # Fill any remaining NaN in features
    for f in FEATURES:
        if f in df.columns:
            df[f] = df[f].fillna(df[f].median())

    print(f"[✓] ML data: {len(df):,} rows | "
          f"class distribution:\n{df[TARGET].value_counts().to_string()}")
    return df


# ── STEP 2: TRAIN MODEL ───────────────────────────────────────────────────────
def train_model(df: pd.DataFrame):
    # Encode target
    le = LabelEncoder()
    le.fit(RISK_ORDER)
    df["target_encoded"] = le.transform(df[TARGET])

    avail_features = [f for f in FEATURES if f in df.columns]
    X = df[avail_features].values
    y = df["target_encoded"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Cross-val score
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")

    # Test report
    y_pred = model.predict(X_test)
    report = classification_report(
        y_test, y_pred,
        target_names=le.classes_,
        zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n[✓] Model trained")
    print(f"    CV Accuracy : {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
    print(f"    Test Report:\n{report}")

    return model, le, avail_features, report, cv_scores, cm


# ── STEP 3: FEATURE IMPORTANCE ────────────────────────────────────────────────
def feature_importance_df(model, feature_names: list) -> pd.DataFrame:
    fi = pd.DataFrame({
        "feature":    feature_names,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False).reset_index(drop=True)
    fi["importance_pct"] = (fi["importance"] * 100).round(2)
    return fi


# ── STEP 4: FORECAST NEXT MONTH ───────────────────────────────────────────────
def forecast_next_month(df: pd.DataFrame, model, le, feature_names: list) -> pd.DataFrame:
    """
    For each Mandal, use the latest available month's data to predict
    what the NEXT month's drought risk will be.
    """
    # Get latest row per Mandal
    latest = (df.sort_values(["Year", "Month"])
                .groupby(["District", "Mandal"])
                .last()
                .reset_index())

    # Shift lag features: current month becomes "previous" for next month
    latest["prev_month_rain"]       = latest["total_rain_mm"]
    latest["prev_month_risk_score"] = latest["drought_risk_score"]

    # Advance Month by 1 (for seasonality feature)
    latest["Month"] = (latest["Month"] % 12) + 1

    avail = [f for f in feature_names if f in latest.columns]
    X_next = latest[avail].fillna(0).values

    preds_encoded = model.predict(X_next)
    preds_proba   = model.predict_proba(X_next)

    latest["predicted_risk_level"] = le.inverse_transform(preds_encoded)
    latest["confidence_pct"]       = (preds_proba.max(axis=1) * 100).round(1)

    # Add probability per class
    for i, cls in enumerate(le.classes_):
        latest[f"prob_{cls.lower()}"] = (preds_proba[:, i] * 100).round(1)

    out_cols = ["District", "Mandal", "Year", "Month",
                "total_rain_mm", "drought_risk_level",
                "predicted_risk_level", "confidence_pct",
                "prob_normal", "prob_mild", "prob_moderate", "prob_severe"]
    out_cols = [c for c in out_cols if c in latest.columns]

    forecast = latest[out_cols].copy()
    forecast = forecast.rename(columns={"drought_risk_level": "current_risk_level"})
    forecast = forecast.sort_values("prob_severe", ascending=False).reset_index(drop=True)

    print(f"\n[✓] Next-month forecast distribution:")
    print(forecast["predicted_risk_level"].value_counts().to_string())
    return forecast


# ── STEP 5: SAVE EVERYTHING ───────────────────────────────────────────────────
def save_outputs(model, le, feature_names, report, cv_scores, cm,
                 fi_df, forecast_df, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    # Save model
    model_path = os.path.join(output_dir, "drought_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump({"model": model, "label_encoder": le,
                     "features": feature_names}, f)
    print(f"[✓] Model saved: {model_path}")

    # Save feature importance
    fi_path = os.path.join(output_dir, "feature_importance.csv")
    fi_df.to_csv(fi_path, index=False)
    print(f"[✓] Feature importance: {fi_path}")

    # Save forecast
    fc_path = os.path.join(output_dir, "mandal_next_month_forecast.csv")
    forecast_df.to_csv(fc_path, index=False)
    print(f"[✓] Forecast: {fc_path}")

    # Save text report
    report_text = f"""
GramSaarthi — ML Drought Prediction Model Report
==================================================
Model        : Gradient Boosting Classifier
Features     : {', '.join(feature_names)}
Target       : drought_risk_level (NORMAL / MILD / MODERATE / SEVERE)

CROSS-VALIDATION (5-fold)
--------------------------
Mean Accuracy : {cv_scores.mean():.4f}
Std Dev       : {cv_scores.std():.4f}
All Folds     : {[round(s,4) for s in cv_scores]}

CLASSIFICATION REPORT (held-out 20% test set)
----------------------------------------------
{report}

CONFUSION MATRIX
-----------------
Classes: {list(le.classes_)}
{cm}

TOP FEATURES BY IMPORTANCE
---------------------------
{fi_df[['feature','importance_pct']].to_string(index=False)}

NEXT-MONTH FORECAST SUMMARY
-----------------------------
{forecast_df['predicted_risk_level'].value_counts().to_string()}
"""
    rpt_path = os.path.join(output_dir, "ml_model_report.txt")
    with open(rpt_path, "w") as f:
        f.write(report_text)
    print(f"[✓] Model report: {rpt_path}")


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main(output_dir: str):
    risk_path = os.path.join(output_dir, "mandal_drought_risk.csv")
    if not os.path.exists(risk_path):
        print("[ERROR] mandal_drought_risk.csv not found. Run Script 01 first.")
        return

    print("\n━━━ STEP 1: Prepare ML Data ━━━")
    df = prepare_ml_data(risk_path)

    print("\n━━━ STEP 2: Train Model ━━━")
    model, le, feature_names, report, cv_scores, cm = train_model(df)

    print("\n━━━ STEP 3: Feature Importance ━━━")
    fi_df = feature_importance_df(model, feature_names)
    print(fi_df[["feature", "importance_pct"]].to_string(index=False))

    print("\n━━━ STEP 4: Forecast Next Month ━━━")
    forecast_df = forecast_next_month(df, model, le, feature_names)
    print("\nTop 10 Mandals most likely to hit SEVERE next month:")
    print(forecast_df[["District", "Mandal", "predicted_risk_level",
                        "confidence_pct", "prob_severe"]].head(10).to_string(index=False))

    print("\n━━━ STEP 5: Save Outputs ━━━")
    save_outputs(model, le, feature_names, report, cv_scores, cm,
                 fi_df, forecast_df, output_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GramSaarthi ML Drought Model")
    parser.add_argument("--output_dir", default="./outputs")
    args = parser.parse_args()
    main(args.output_dir)
