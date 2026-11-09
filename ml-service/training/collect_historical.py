"""
WeatherPulse - Historical Weather Data Collection Pipeline
Collects hourly historical observations and reanalysis data from Open-Meteo Archive API.
Supports multi-year collection, yearly partitioning, retry handling, and resumability.
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
logger = logging.getLogger("collect_historical")

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "locations.yaml"
RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

def load_config(config_path: Path = DEFAULT_CONFIG_PATH) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def fetch_historical_chunk(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    hourly_variables: list[str],
    endpoint_url: str = "https://archive-api.open-meteo.com/v1/archive",
    retries: int = 5,
    backoff_factor: float = 2.0
) -> dict:
    """
    Fetches historical observations from the Open-Meteo Archive API with exponential retry logic.
    Always requests UTC to normalize raw timestamps reliably.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(hourly_variables),
        "timezone": "UTC"
    }

    headers = {
        "User-Agent": "WeatherPulse-Pipeline/1.0 (academic-research/weather-prediction)"
    }

    delay = 1.0
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Querying Open-Meteo Archive ({start_date} to {end_date}) - Attempt {attempt}/{retries}")
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

    raise RuntimeError("Failed to fetch historical observations after maximum retries.")

def collect_historical_range(
    location_id: str,
    location_info: dict,
    start_date: str,
    end_date: str,
    variables: list[str],
    endpoint_url: str,
    output_dir: Path = RAW_DATA_DIR,
    partition_by_year: bool = True
) -> list[Path]:
    """
    Downloads historical observations partitioned by year to enable incremental and resumable execution.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    years = range(start_dt.year, end_dt.year + 1)

    generated_csvs = []

    for y in years:
        y_start = f"{y}-01-01" if y > start_dt.year else start_date
        y_end = f"{y}-12-31" if y < end_dt.year else end_date

        slug = f"{location_id}_historical_obs_{y}" if partition_by_year else f"{location_id}_historical_obs_{y_start}_to_{y_end}"
        csv_path = output_dir / f"{slug}.csv"
        json_path = output_dir / f"{slug}.json"
        meta_path = output_dir / f"{slug}_meta.json"

        # Check if already downloaded (incremental resumability)
        if csv_path.exists() and meta_path.exists():
            logger.info(f"Year {y} historical observations already downloaded ({csv_path.name}). Skipping.")
            generated_csvs.append(csv_path)
            continue

        logger.info(f"Downloading historical observations for year {y} ({y_start} to {y_end})...")
        raw_data = fetch_historical_chunk(
            latitude=location_info["latitude"],
            longitude=location_info["longitude"],
            start_date=y_start,
            end_date=y_end,
            hourly_variables=variables,
            endpoint_url=endpoint_url
        )

        retrieval_iso = datetime.now(timezone.utc).isoformat()

        # Save raw JSON response
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, indent=2)

        # Convert hourly block to raw tabular CSV
        hourly = raw_data.get("hourly", {})
        df = pd.DataFrame(hourly)
        df.insert(0, "location_id", location_id)
        df.insert(1, "latitude", raw_data.get("latitude", location_info.get("latitude")))
        df.insert(2, "longitude", raw_data.get("longitude", location_info.get("longitude")))
        df.insert(3, "elevation", raw_data.get("elevation", None))
        df.to_csv(csv_path, index=False)
        generated_csvs.append(csv_path)

        metadata = {
            "dataset_type": "historical_observations_raw_yearly",
            "year": y,
            "data_source": "Open-Meteo Historical Weather Archive API",
            "data_provenance": "ECMWF ERA5 / ERA5-Land reanalysis dataset via Open-Meteo",
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
            "hourly_units": raw_data.get("hourly_units", {}),
            "record_count": len(df),
            "output_files": {
                "raw_json": str(json_path),
                "raw_csv": str(csv_path)
            }
        }

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Saved {len(df)} observation records for {y} to {csv_path.name}")
        time.sleep(1.0)

    return generated_csvs

def main():
    parser = argparse.ArgumentParser(description="Collect historical weather observations from Open-Meteo")
    parser.add_argument("--location", default="indore", help="Location key defined in locations.yaml")
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
    endpoint = config["api_endpoints"]["historical_archive"]

    logger.info(f"Initiating historical observation retrieval for {loc_info['name']} ({start_date} to {end_date})")
    csvs = collect_historical_range(
        location_id=loc_key,
        location_info=loc_info,
        start_date=start_date,
        end_date=end_date,
        variables=variables,
        endpoint_url=endpoint,
        partition_by_year=True
    )
    logger.info(f"Historical observations collection complete! Processed {len(csvs)} yearly partition(s).")

if __name__ == "__main__":
    main()
