"""
GramSaarthi — Module 1: Rainfall Data Ingestion & Feature Engineering
=====================================================================
INPUT  : rainfalldataset/ (monthly CSVs, 2023–2026)
OUTPUT : outputs/rainfall_master.csv
         outputs/mandal_drought_risk.csv

Run:
    python 01_rainfall_ingestion.py --data_dir ./rainfalldataset --output_dir ./outputs
"""

import os
import glob
import argparse
import pandas as pd
import numpy as np
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────
RAIN_COL      = "Rain (mm)"
MIN_HUM_COL   = "Min Humidity (%)"
MAX_HUM_COL   = "Max Humidity (%)"
DISTRICT_COL  = "District"
MANDAL_COL    = "Mandal"
DATE_COL      = "Date"

# Drought thresholds (mm/month) — adjust based on Telangana normals
DROUGHT_THRESH_SEVERE  = 20    # <20mm in a month = severe
DROUGHT_THRESH_MODERATE = 60   # <60mm           = moderate
DRY_STREAK_THRESH      = 7     # consecutive dry days to flag


# ── STEP 1: LOAD & MERGE ALL CSVs ─────────────────────────────────────────────
def load_all_rainfall(data_dir: str) -> pd.DataFrame:
    """Recursively load all monthly CSV files and combine into one DataFrame."""
    pattern = os.path.join(data_dir, "**", "*.csv")
    files   = glob.glob(pattern, recursive=True)
    
    if not files:
        raise FileNotFoundError(f"No CSVs found under {data_dir}")
    
    dfs = []
    for f in sorted(files):
        try:
            df = pd.read_csv(f, encoding="utf-8")
            # Normalise column names (strip spaces)
            df.columns = df.columns.str.strip()
            # Tag source file for debugging
            df["_source_file"] = os.path.basename(f)
            dfs.append(df)
        except Exception as e:
            print(f"  [WARN] Skipping {f}: {e}")
    
    master = pd.concat(dfs, ignore_index=True)
    print(f"[✓] Loaded {len(files)} files → {len(master):,} rows")
    return master


# ── STEP 2: CLEAN & PARSE ─────────────────────────────────────────────────────
def clean_rainfall(df: pd.DataFrame) -> pd.DataFrame:
    """Parse dates, strip whitespace, drop duplicates."""
    df = df.copy()
    
    # Standardise column names
    df.columns = df.columns.str.strip()
    df[DISTRICT_COL] = df[DISTRICT_COL].str.strip().str.title()
    df[MANDAL_COL]   = df[MANDAL_COL].str.strip().str.title()
    
    # Parse dates (handles dd-Mon-yy and dd-Mon-yyyy)
    df[DATE_COL] = pd.to_datetime(df[DATE_COL], dayfirst=True, errors="coerce")
    df = df.dropna(subset=[DATE_COL])
    
    # Numeric coercion
    for col in [RAIN_COL, MIN_HUM_COL, MAX_HUM_COL]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # Clip negatives (data entry errors)
    df[RAIN_COL] = df[RAIN_COL].clip(lower=0)
    
    # Add time features
    df["Year"]  = df[DATE_COL].dt.year
    df["Month"] = df[DATE_COL].dt.month
    df["Week"]  = df[DATE_COL].dt.isocalendar().week.astype(int)
    
    # Remove exact duplicates
    df = df.drop_duplicates(subset=[DISTRICT_COL, MANDAL_COL, DATE_COL])
    df = df.sort_values([DISTRICT_COL, MANDAL_COL, DATE_COL]).reset_index(drop=True)
    
    print(f"[✓] After cleaning: {len(df):,} rows | "
          f"{df[DISTRICT_COL].nunique()} districts | "
          f"{df[MANDAL_COL].nunique()} mandals")
    return df


# ── STEP 3: FEATURE ENGINEERING ───────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add ML-ready features per District+Mandal."""
    df = df.copy()
    key = [DISTRICT_COL, MANDAL_COL]
    
    # Rolling 7-day and 30-day cumulative rain
    df = df.sort_values(key + [DATE_COL])
    df["rain_7d_rolling"]  = (df.groupby(key)[RAIN_COL]
                                .transform(lambda x: x.rolling(7,  min_periods=1).sum()))
    df["rain_30d_rolling"] = (df.groupby(key)[RAIN_COL]
                                .transform(lambda x: x.rolling(30, min_periods=1).sum()))
    
    # Humidity range (indicator of evaporation stress)
    df["humidity_range"] = df[MAX_HUM_COL] - df[MIN_HUM_COL]
    
    # Is it a dry day?
    df["is_dry_day"] = (df[RAIN_COL] == 0).astype(int)
    
    # Consecutive dry days streak per Mandal
    def dry_streak(series):
        streak, streaks = 0, []
        for v in series:
            streak = streak + 1 if v == 1 else 0
            streaks.append(streak)
        return streaks
    
    df["dry_streak_days"] = (df.groupby(key)["is_dry_day"]
                               .transform(dry_streak))
    
    return df


# ── STEP 4: MONTHLY AGGREGATION (per Mandal) ──────────────────────────────────
def monthly_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily data to monthly level — used for ML and reports."""
    key = [DISTRICT_COL, MANDAL_COL, "Year", "Month"]
    
    agg = df.groupby(key).agg(
        total_rain_mm      = (RAIN_COL,           "sum"),
        rain_days          = ("is_dry_day",        lambda x: (x == 0).sum()),
        max_daily_rain     = (RAIN_COL,            "max"),
        avg_min_humidity   = (MIN_HUM_COL,         "mean"),
        avg_max_humidity   = (MAX_HUM_COL,         "mean"),
        max_dry_streak     = ("dry_streak_days",   "max"),
    ).reset_index()
    
    # Monthly normal (mean across all years per Mandal+Month)
    normals = (agg.groupby([DISTRICT_COL, MANDAL_COL, "Month"])["total_rain_mm"]
                  .mean()
                  .rename("normal_rain_mm")
                  .reset_index())
    agg = agg.merge(normals, on=[DISTRICT_COL, MANDAL_COL, "Month"], how="left")
    
    # Deviation from normal (%)
    agg["rain_deviation_pct"] = ((agg["total_rain_mm"] - agg["normal_rain_mm"])
                                  / agg["normal_rain_mm"].replace(0, np.nan) * 100).round(1)
    
    return agg


# ── STEP 5: DROUGHT RISK SCORING ──────────────────────────────────────────────
def compute_drought_risk(monthly: pd.DataFrame) -> pd.DataFrame:
    """
    Compute a simple drought risk score (0–100) per Mandal per Month.
    
    Formula uses:
      - Rain deviation from normal      (40% weight)
      - Max dry streak                  (30% weight)
      - Low humidity (evaporation)      (30% weight)
    
    Higher score = higher drought risk.
    """
    df = monthly.copy()
    
    # Component 1: rainfall deficit (0 = no deficit, 100 = complete drought)
    deficit = (-df["rain_deviation_pct"]).clip(0, 100) / 100  # 0→1
    
    # Component 2: dry streak normalised (assume 30 days max)
    streak  = (df["max_dry_streak"] / 30).clip(0, 1)
    
    # Component 3: low humidity normalised (lower avg_max_humidity → more stress)
    # Normalise: 100% humidity = 0 stress, 0% = full stress
    hum_stress = (1 - df["avg_max_humidity"] / 100).clip(0, 1)
    
    df["drought_risk_score"] = (
        0.40 * deficit +
        0.30 * streak  +
        0.30 * hum_stress
    ) * 100
    df["drought_risk_score"] = df["drought_risk_score"].round(1)
    
    # Risk label
    def risk_label(score):
        if score >= 70: return "SEVERE"
        if score >= 45: return "MODERATE"
        if score >= 20: return "MILD"
        return "NORMAL"
    
    df["drought_risk_level"] = df["drought_risk_score"].apply(risk_label)
    
    return df


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main(data_dir: str, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n━━━ STEP 1: Loading rainfall CSVs ━━━")
    raw = load_all_rainfall(data_dir)
    
    print("\n━━━ STEP 2: Cleaning ━━━")
    clean = clean_rainfall(raw)
    
    print("\n━━━ STEP 3: Feature Engineering ━━━")
    featured = engineer_features(clean)
    out_master = os.path.join(output_dir, "rainfall_master.csv")
    featured.to_csv(out_master, index=False)
    print(f"[✓] Saved: {out_master}")
    
    print("\n━━━ STEP 4: Monthly Aggregation ━━━")
    monthly = monthly_summary(featured)
    
    print("\n━━━ STEP 5: Drought Risk Scoring ━━━")
    risk_df = compute_drought_risk(monthly)
    out_risk = os.path.join(output_dir, "mandal_drought_risk.csv")
    risk_df.to_csv(out_risk, index=False)
    print(f"[✓] Saved: {out_risk}")
    
    # Summary stats
    print("\n━━━ SUMMARY ━━━")
    print(risk_df["drought_risk_level"].value_counts().to_string())
    print(f"\nTop 10 HIGH RISK Mandals (latest month):")
    latest = risk_df[risk_df["Year"] == risk_df["Year"].max()]
    latest = latest[latest["Month"] == latest["Month"].max()]
    top10 = (latest.nlargest(10, "drought_risk_score")
                   [[DISTRICT_COL, MANDAL_COL, "total_rain_mm",
                     "drought_risk_score", "drought_risk_level"]])
    print(top10.to_string(index=False))
    
    return featured, risk_df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GramSaarthi Rainfall Ingestion")
    parser.add_argument("--data_dir",   default="./rainfalldataset", help="Path to rainfalldataset folder")
    parser.add_argument("--output_dir", default="./outputs",          help="Where to save outputs")
    args = parser.parse_args()
    main(args.data_dir, args.output_dir)
