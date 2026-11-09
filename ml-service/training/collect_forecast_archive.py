"""
WeatherPulse - Historical Forecast Archive Collection Pipeline
Collects archived NWP forecast model runs from Open-Meteo Historical Forecast API.
Preserves forecast model origin, valid time, retrieval timestamp, and explicit provenance limits.

PROVENANCE ARCHITECTURE & DATA LIMITATION CONTRACT:
- Open-Meteo Historical Forecast API returns previous seamless model cycles mapped to VALID TIMESTAMPS.
- Exact operational initialization cycles (e.g., whether a 03:00Z forecast originated from the 00Z or prior 12Z cycle)
  are NOT provided by this API endpoint.
- Therefore, lead_time_hours is marked as UNKNOWN (represented as None / null or NaN) rather than fabricating 0.
- NWP features joined on target valid time (t + horizon) must NOT be claimed as strictly verified at decision time t
  without applying an operational ingestion latency buffer (recommended: >= 2 hours in real-time inference).
"""

import os
import json
import time
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path
import yaml
import requests
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("collect_forecast_archive")

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "locations.yaml"
RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

# Recommended operational ingestion latency buffer for live operational inference (hours)
DEFAULT_OPERATIONAL_LATENCY_BUFFER_HOURS = 2.0

def load_config(config_path: Path = DEFAULT_CONFIG_PATH) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def fetch_forecast_archive_chunk(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    hourly_variables: list[str],
    models: list[str],
    endpoint_url: str = "https://historical-forecast-api.open-meteo.com/v1/forecast",
    retries: int = 5,
    backoff_factor: float = 2.0
) -> dict:
    """
    Fetches historical forecast runs from Open-Meteo Historical Forecast API for a given chunk.
    Handles exponential retry backoff.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(hourly_variables),
        "models": ",".join(models),
        "timezone": "UTC"
    }

    headers = {
        "User-Agent": "WeatherPulse-Pipeline/1.0 (academic-research/weather-prediction)"
    }

    delay = 1.0
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Querying Open-Meteo Forecast Archive ({start_date} to {end_date}) Models={models} - Attempt {attempt}/{retries}")
            response = requests.get(endpoint_url, params=params, headers=headers, timeout=45)
            if response.status_code == 200:
                data = response.json()
                if "hourly" not in data or not data["hourly"].get("time"):
                    raise ValueError(f"Open-Meteo returned invalid payload without hourly series: {data}")
                return data
            elif response.status_code == 429:
                logger.warning(f"Rate limited (429). Backing off for {delay:.1f}s...")
                time.sleep(delay)
                delay *= backoff_factor
            else:
                logger.error(f"HTTP {response.status_code}: {response.text}")
                response.raise_for_status()
        except (requests.RequestException, ValueError) as e:
            logger.warning(f"Request failed on attempt {attempt}: {e}")
            if attempt == retries:
                raise
            time.sleep(delay)
            delay *= backoff_factor

    raise RuntimeError("Failed to fetch forecast archive after maximum retries.")

def parse_forecast_dataframe(
    raw_data: dict,
    location_id: str,
    location_info: dict,
    requested_models: list[str],
    requested_vars: list[str],
    retrieval_iso: str
) -> pd.DataFrame:
    """
    Parses Open-Meteo forecast JSON response into a standardized schema.
    Explicitly documents initialization time and lead time limitations:
    - initialization_time_utc: UNKNOWN_FROM_API
    - lead_time_hours: NaN (unknown / variable across operational cycles)
    """
    hourly = raw_data.get("hourly", {})
    times = hourly.get("time", [])
    if not times:
        return pd.DataFrame()

    records = []
    
    for model in requested_models:
        for var in requested_vars:
            key_with_model = f"{var}_{model}"
            if key_with_model in hourly:
                vals = hourly[key_with_model]
            elif model == "best_match" and var in hourly:
                vals = hourly[var]
            else:
                continue

            for t, val in zip(times, vals):
                records.append({
                    "valid_time_utc": t,
                    "model_id": model,
                    "variable": var,
                    "forecast_value": val
                })

    long_df = pd.DataFrame(records)
    if long_df.empty:
        base_df = pd.DataFrame(hourly)
        base_df.insert(0, "location_id", location_id)
        return base_df

    wide_df = long_df.pivot_table(
        index=["valid_time_utc", "model_id"],
        columns="variable",
        values="forecast_value",
        aggfunc="first"
    ).reset_index()

    wide_df.columns.name = None
    wide_df.insert(0, "location_id", location_id)
    wide_df.insert(1, "latitude", raw_data.get("latitude", location_info.get("latitude")))
    wide_df.insert(2, "longitude", raw_data.get("longitude", location_info.get("longitude")))
    wide_df.insert(3, "elevation", raw_data.get("elevation", None))

    # CRITICAL PROVENANCE CONSTRAINTS
    # The API maps forecasts to valid times; actual run cycle initialization is NOT returned.
    wide_df["initialization_time_utc"] = "UNKNOWN_FROM_OPEN_METEO_API"
    wide_df["lead_time_hours"] = float("nan")  # Unknown exact lead time
    wide_df["lead_time_status"] = "NOMINAL_UNKNOWN_CYCLE"
    wide_df["forecast_source_type"] = "archived_nwp_operational_seamless"
    wide_df["retrieval_timestamp_utc"] = retrieval_iso

    return wide_df

def collect_forecast_archive_range(
    location_id: str,
    location_info: dict,
    start_date: str,
    end_date: str,
    models: list[str],
    variables: list[str],
    endpoint_url: str,
    output_dir: Path = RAW_DATA_DIR,
    partition_by_year: bool = True
) -> list[Path]:
    """
    Downloads forecast archive partitioned by year to enable incremental and resumable execution.
    Preserves all provenance limitations and outputs metadata per yearly file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    years = range(start_dt.year, end_dt.year + 1)
    
    generated_csvs = []

    for y in years:
        y_start = f"{y}-01-01" if y > start_dt.year else start_date
        y_end = f"{y}-12-31" if y < end_dt.year else end_date

        slug = f"{location_id}_historical_forecast_{y}" if partition_by_year else f"{location_id}_historical_forecast_{y_start}_to_{y_end}"
        csv_path = output_dir / f"{slug}.csv"
        json_path = output_dir / f"{slug}.json"
        meta_path = output_dir / f"{slug}_meta.json"

        # Check if already downloaded (incremental resumability)
        if csv_path.exists() and meta_path.exists():
            logger.info(f"Year {y} forecast archive already downloaded ({csv_path.name}). Skipping.")
            generated_csvs.append(csv_path)
            continue

        logger.info(f"Downloading forecast archive for year {y} ({y_start} to {y_end})...")
        raw_data = fetch_forecast_archive_chunk(
            latitude=location_info["latitude"],
            longitude=location_info["longitude"],
            start_date=y_start,
            end_date=y_end,
            hourly_variables=variables,
            models=models,
            endpoint_url=endpoint_url
        )

        retrieval_iso = datetime.now(timezone.utc).isoformat()

        # Save raw JSON
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, indent=2)

        df = parse_forecast_dataframe(raw_data, location_id, location_info, models, variables, retrieval_iso)
        df.to_csv(csv_path, index=False)
        generated_csvs.append(csv_path)

        metadata = {
            "dataset_type": "historical_forecasts_raw_yearly",
            "year": y,
            "data_source": "Open-Meteo Historical Forecast API",
            "data_provenance": "Archived Numerical Weather Prediction (NWP) outputs (ECMWF IFS, GFS, Seamless)",
            "provenance_limitations": {
                "initialization_timestamp": "UNAVAILABLE_FROM_API. Open-Meteo Historical Forecast does not return run initialization times.",
                "lead_time_status": "EXACT_LEAD_TIME_UNKNOWN. Forecast values represent valid-time NWP outputs without run cycle metadata.",
                "leakage_warning": "Do not treat historical post-hoc forecasts as verified available at t without an operational ingestion latency buffer.",
                "recommended_operational_latency_buffer_hours": DEFAULT_OPERATIONAL_LATENCY_BUFFER_HOURS
            },
            "retrieval_timestamp_utc": retrieval_iso,
            "location": {
                "id": location_id,
                "name": location_info.get("name"),
                "region": location_info.get("region"),
                "country": location_info.get("country"),
                "target_lat": location_info.get("latitude"),
                "target_lon": location_info.get("longitude"),
                "returned_lat": raw_data.get("latitude"),
                "returned_lon": raw_data.get("longitude"),
                "elevation": raw_data.get("elevation"),
                "local_timezone": location_info.get("timezone", "Asia/Kolkata")
            },
            "query_range": {"start_date": y_start, "end_date": y_end},
            "models_queried": models,
            "models_present": df["model_id"].unique().tolist() if "model_id" in df.columns else [],
            "variables_queried": variables,
            "hourly_units": raw_data.get("hourly_units", {}),
            "record_count": len(df),
            "output_files": {
                "raw_json": str(json_path),
                "raw_csv": str(csv_path)
            }
        }

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Saved {len(df)} forecast records for {y} to {csv_path.name}")
        time.sleep(1.0)

    return generated_csvs

def main():
    parser = argparse.ArgumentParser(description="Collect historical forecast model runs from Open-Meteo")
    parser.add_argument("--location", default="indore", help="Location key in locations.yaml")
    parser.add_argument("--start-date", default=None, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", default=None, help="End date (YYYY-MM-DD)")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to locations.yaml")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    loc_key = args.location
    if loc_key not in config["locations"]:
        raise ValueError(f"Location '{loc_key}' not found in {args.config}")

    loc_info = config["locations"][loc_key]
    start_date = args.start_date or config["historical_full"]["start_date"]
    end_date = args.end_date or config["historical_full"]["end_date"]
    variables = config["variables"]["hourly"]
    models = config.get("models", ["best_match", "ecmwf_ifs", "gfs_seamless"])
    endpoint = config["api_endpoints"]["historical_forecast"]

    logger.info(f"Initiating forecast archive collection for {loc_info['name']} ({start_date} to {end_date})")
    csvs = collect_forecast_archive_range(
        location_id=loc_key,
        location_info=loc_info,
        start_date=start_date,
        end_date=end_date,
        models=models,
        variables=variables,
        endpoint_url=endpoint,
        partition_by_year=True
    )
    logger.info(f"Historical forecast archive collection complete! Processed {len(csvs)} yearly partition(s).")

if __name__ == "__main__":
    main()
