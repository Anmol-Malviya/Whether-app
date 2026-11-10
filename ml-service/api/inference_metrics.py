"""
Thread-safe in-memory inference metrics store for the WeatherPulse ML service.
Tracks request counts, latency percentiles, and uptime for operational observability.
"""
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, Any, Optional

import statistics


class InferenceMetricsStore:
    """
    Thread-safe store for ML inference metrics.

    Tracks total/successful/failed request counts, a rolling window of the
    last 1 000 successful inference latencies (ms), and wall-clock uptime.
    """

    _MAX_LATENCY_SAMPLES: int = 1_000
    _P95_MIN_SAMPLES: int = 20

    def __init__(self) -> None:
        self._lock: threading.Lock = threading.Lock()
        self.total_requests: int = 0
        self.successful_requests: int = 0
        self.failed_requests: int = 0
        self.start_time: datetime = datetime.now(timezone.utc)
        self._latencies: Deque[float] = deque(maxlen=self._MAX_LATENCY_SAMPLES)
        self._last_success_at: Optional[str] = None
        self._last_failure_at: Optional[str] = None

    # ------------------------------------------------------------------
    # Public recording API
    # ------------------------------------------------------------------

    def record_success(self, latency_ms: float) -> None:
        """Increment total and success counters; append latency to the rolling window."""
        with self._lock:
            self.total_requests += 1
            self.successful_requests += 1
            self._latencies.append(latency_ms)
            self._last_success_at = datetime.now(timezone.utc).isoformat()

    def record_failure(self) -> None:
        """Increment total and failure counters."""
        with self._lock:
            self.total_requests += 1
            self.failed_requests += 1
            self._last_failure_at = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def get_summary(self) -> Dict[str, Any]:
        """
        Return a snapshot of all current metrics.

        Returns
        -------
        dict with keys:
            total_requests, successful_requests, failed_requests,
            success_rate (None if 0 total), failure_rate (None if 0 total),
            avg_latency_ms (None if no latency data),
            p95_latency_ms (None if < 20 samples),
            uptime_seconds, last_success_at, last_failure_at
        """
        with self._lock:
            total = self.total_requests
            success = self.successful_requests
            failed = self.failed_requests
            latencies = list(self._latencies)
            last_success_at = self._last_success_at
            last_failure_at = self._last_failure_at

        uptime_seconds: float = (
            datetime.now(timezone.utc) - self.start_time
        ).total_seconds()

        success_rate: Optional[float] = (success / total) if total > 0 else None
        failure_rate: Optional[float] = (failed / total) if total > 0 else None

        avg_latency_ms: Optional[float] = (
            statistics.mean(latencies) if latencies else None
        )

        p95_latency_ms: Optional[float] = None
        if len(latencies) >= self._P95_MIN_SAMPLES:
            sorted_latencies = sorted(latencies)
            # 95th-percentile index (nearest-rank method)
            idx = int(0.95 * len(sorted_latencies)) - 1
            idx = max(idx, 0)
            p95_latency_ms = sorted_latencies[idx]

        return {
            "total_requests": total,
            "successful_requests": success,
            "failed_requests": failed,
            "success_rate": success_rate,
            "failure_rate": failure_rate,
            "avg_latency_ms": avg_latency_ms,
            "p95_latency_ms": p95_latency_ms,
            "uptime_seconds": uptime_seconds,
            "last_success_at": last_success_at,
            "last_failure_at": last_failure_at,
        }


# Module-level singleton — imported by main.py and test helpers
metrics_store = InferenceMetricsStore()
