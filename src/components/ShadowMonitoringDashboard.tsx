"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import MLShadowHeader from "./ml-shadow/MLShadowHeader";
import EvaluationControls from "./ml-shadow/EvaluationControls";
import MetricsOverview from "./ml-shadow/MetricsOverview";
import TemperaturePerformanceCard from "./ml-shadow/TemperaturePerformanceCard";
import RainPerformanceCard from "./ml-shadow/RainPerformanceCard";
import ConfusionMatrix from "./ml-shadow/ConfusionMatrix";
import ModelLineage from "./ml-shadow/ModelLineage";
import PredictionHistoryTable from "./ml-shadow/PredictionHistoryTable";
import ShadowNotice from "./ml-shadow/ShadowNotice";
import { ShadowMetrics, ShadowRecord, HistoryPagination } from "./ml-shadow/types";

export default function ShadowMonitoringDashboard() {
  const [range, setRange] = useState<string>("24h");
  const [metrics, setMetrics] = useState<ShadowMetrics | null>(null);
  const [history, setHistory] = useState<ShadowRecord[]>([]);
  const [pagination, setPagination] = useState<HistoryPagination>({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evalMessage, setEvalMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(
    async (selectedRange: string, pageNum: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/weather/ml-shadow?range=${selectedRange}&page=${pageNum}&limit=10`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMetrics(data.metrics);
        setHistory(data.history?.records || []);
        if (data.history?.pagination) {
          setPagination(data.history.pagination);
        }
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load shadow metrics:", err);
        setError("Unable to load shadow monitoring metrics. Ensure MongoDB is connected.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
    }
    fetchData(range, 1);
  }, [range, fetchData]);

  const handleTriggerEvaluation = async () => {
    setEvaluating(true);
    setEvalMessage(null);
    try {
      const res = await fetch("/api/weather/ml-shadow/evaluate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEvalMessage({
          type: "success",
          text: `Evaluation cycle complete. Evaluated: ${data.result?.evaluated || 0}, Incomplete: ${data.result?.incomplete || 0}, Pending: ${data.result?.skipped || 0}`,
        });
        fetchData(range, pagination.page);
      } else {
        setEvalMessage({
          type: "error",
          text: `Evaluation failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err) {
      setEvalMessage({
        type: "error",
        text: `Error invoking evaluation: ${String(err)}`,
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchData(range, newPage);
  };

  const handleRefresh = () => {
    fetchData(range, pagination.page);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        paddingTop: 14,
        paddingBottom: 24,
      }}
    >
      {/* 1. Header (Title, Status Badge, Last Updated, Refresh) */}
      <MLShadowHeader
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        loading={loading}
      />

      {/* Error Alert if API failed */}
      {error && (
        <div className="alert alert-error">
          <span style={{ fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* 2. Evaluation Controls & Preset Filter */}
      <EvaluationControls
        range={range}
        onRangeChange={(newRange) => {
          setRange(newRange);
          setEvalMessage(null);
        }}
        onRunEvaluation={handleTriggerEvaluation}
        evaluating={evaluating}
        evalMessage={evalMessage}
      />

      {/* 3. KPI Overview Cards (4 compact cards styled with design system tokens) */}
      <MetricsOverview metrics={metrics} loading={loading} />

      {/* 4. Model Analytical Performance (Temperature & Rain 2-column balanced grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <TemperaturePerformanceCard metrics={metrics} />
        <RainPerformanceCard metrics={metrics} />
      </div>

      {/* 5. Confusion Matrix & Lineage (2-column balanced grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <ConfusionMatrix metrics={metrics} />
        <ModelLineage metrics={metrics} />
      </div>

      {/* 6. Recent Shadow Predictions Table */}
      <PredictionHistoryTable
        history={history}
        pagination={pagination}
        loading={loading}
        onPageChange={handlePageChange}
      />

      {/* 7. Shadow Monitoring Protocol Notice */}
      <ShadowNotice disclaimer={metrics?.metadata?.disclaimer} />
    </div>
  );
}
