/**
 * ResQX Experimental Benchmark & Performance Comparison Card
 *
 * Renders measured Baseline vs ResQX travel metrics, stop count reduction,
 * real-time bar visualizations, and JSON experiment export.
 */

import { useState, useMemo } from 'react';
import type { TrafficScenarioType } from '../traffic/scenarios.ts';
import { benchmarkScenario, exportExperimentToJson } from '../benchmarking/benchmarkEngine.ts';
import type { ExperimentComparison } from '../types/benchmark.ts';

export function PerformanceBenchmarkCard() {
  const [scenario, setScenario] = useState<TrafficScenarioType>('NORMAL');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastComparison, setLastComparison] = useState<ExperimentComparison | null>(() => {
    return benchmarkScenario('NORMAL').aggregateComparison ?? null;
  });

  const comparison = useMemo(() => {
    return lastComparison;
  }, [lastComparison]);

  const handleRunBenchmark = () => {
    setIsRunning(true);
    setTimeout(() => {
      const result = benchmarkScenario(scenario);
      setLastComparison(result.aggregateComparison ?? null);
      setIsRunning(false);
    }, 250);
  };

  const handleExportJson = () => {
    if (!comparison) return;
    const jsonStr = exportExperimentToJson(comparison);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resqx-experiment-${scenario.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxTime = Math.max(
    comparison?.baseline.travelTimeSeconds ?? 1,
    comparison?.resqx.travelTimeSeconds ?? 1
  );

  const baselinePercent = comparison
    ? Math.min(100, (comparison.baseline.travelTimeSeconds / maxTime) * 100)
    : 100;
  const resqxPercent = comparison
    ? Math.min(100, (comparison.resqx.travelTimeSeconds / maxTime) * 100)
    : 60;

  return (
    <div className="p-4 border-b border-outline-variant/30 bg-surface-container-low/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-secondary text-sm font-bold">📊</span>
          <span className="font-headline text-xs font-bold text-on-surface tracking-wider uppercase">
            EXPERIMENTAL BENCHMARK
          </span>
        </div>
        <span className="text-[10px] font-data font-bold px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30">
          MEASURED
        </span>
      </div>

      {/* Scenario Selection & Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as TrafficScenarioType)}
          className="text-xs font-data bg-surface-container-high text-on-surface border border-outline-variant/40 rounded px-2 py-1 flex-1 focus:outline-none focus:border-secondary"
        >
          <option value="NORMAL">Normal Scenario</option>
          <option value="HIGH_TRAFFIC">High-Traffic Scenario</option>
          <option value="ROAD_BLOCKAGE">Road-Blockage Scenario</option>
        </select>
        <button
          onClick={handleRunBenchmark}
          disabled={isRunning}
          className="text-xs font-data font-bold px-3 py-1 rounded bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {isRunning ? 'Measuring...' : 'Run Test'}
        </button>
      </div>

      {/* Comparative Metrics Table */}
      {comparison && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5 text-center bg-surface-container-high/60 p-2 rounded-lg border border-outline-variant/30">
            <div className="text-[11px] font-data text-on-surface-variant text-left">METRIC</div>
            <div className="text-[11px] font-data font-bold text-on-surface-variant">BASELINE</div>
            <div className="text-[11px] font-data font-bold text-secondary">RESQX</div>

            <div className="text-xs font-data text-on-surface text-left">Travel Time</div>
            <div className="text-xs font-data text-on-surface font-semibold">
              {comparison.baseline.travelTimeSeconds}s
            </div>
            <div className="text-xs font-data text-secondary font-bold">
              {comparison.resqx.travelTimeSeconds}s
            </div>

            <div className="text-xs font-data text-on-surface text-left">Total Stops</div>
            <div className="text-xs font-data text-on-surface font-semibold">
              {comparison.baseline.stopsCount}
            </div>
            <div className="text-xs font-data text-secondary font-bold">
              {comparison.resqx.stopsCount}
            </div>

            <div className="text-xs font-data text-on-surface text-left">Signal Waiting</div>
            <div className="text-xs font-data text-on-surface font-semibold">
              {comparison.baseline.waitingTimeSeconds}s
            </div>
            <div className="text-xs font-data text-secondary font-bold">
              {comparison.resqx.waitingTimeSeconds}s
            </div>
          </div>

          {/* Visual Bar Comparison */}
          <div className="space-y-1.5 bg-surface-container-high/40 p-2.5 rounded-lg border border-outline-variant/20">
            <div className="text-[10px] font-data text-on-surface-variant uppercase tracking-wider">
              Travel Time Comparison
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-data">
                <span className="w-14 text-on-surface-variant text-[10px]">BASELINE</span>
                <div className="flex-1 bg-surface-container h-3.5 rounded overflow-hidden">
                  <div
                    className="bg-outline h-full rounded transition-all duration-500"
                    style={{ width: `${baselinePercent}%` }}
                  />
                </div>
                <span className="w-10 text-right text-on-surface font-semibold">
                  {comparison.baseline.travelTimeSeconds}s
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-data">
                <span className="w-14 text-secondary text-[10px] font-bold">RESQX</span>
                <div className="flex-1 bg-surface-container h-3.5 rounded overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded transition-all duration-500"
                    style={{ width: `${resqxPercent}%` }}
                  />
                </div>
                <span className="w-10 text-right text-secondary font-bold">
                  {comparison.resqx.travelTimeSeconds}s
                </span>
              </div>
            </div>
          </div>

          {/* Improvement Summary Badge & Export */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-data font-bold text-secondary">
              ⚡ {comparison.timeSavedSeconds}s Saved ({comparison.percentageImprovement}%)
            </span>
            <button
              onClick={handleExportJson}
              className="text-[10px] font-data px-2 py-0.5 rounded bg-surface-container-highest text-on-surface hover:bg-surface-container-high border border-outline-variant/40 transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
