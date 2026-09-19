import React, { useState, useEffect, useRef } from 'react';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BasemapTileLayer } from '../../components/map/BasemapTileLayer';
import { useGraph } from '../../graph';
import type { LocationPreset } from '../../graph/types';
import {
  runAlgorithm,
  compareAll,
} from '../../algorithms';
import type {
  AlgorithmType,
  SearchResult,
  SearchEvent,
} from '../../algorithms/types';
import { RouteVisualizerLayer } from '../../components/map/RouteVisualizerLayer';
import {
  Cpu,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  ArrowRightLeft,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Zap,
  Split,
  Eye,
} from 'lucide-react';

export const AlgorithmLabPage: React.FC = () => {
  const { graphEngine, locationPresets, loading, error } = useGraph();

  // Route endpoints
  const [startPresetId, setStartPresetId] = useState<string>('preset_gachibowli');
  const [goalPresetId, setGoalPresetId] = useState<string>('preset_hitec');

  // Algorithm selection
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>('ASTAR');
  const [enableXRay, setEnableXRay] = useState<boolean>(true);

  // Results & Compare All state
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<Record<AlgorithmType, SearchResult> | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Search X-Ray Playback state
  const [traceEvents, setTraceEvents] = useState<SearchEvent[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 4x
  const animationFrameRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPreset = locationPresets.find((p) => p.id === startPresetId) || locationPresets[0];
  const goalPreset = locationPresets.find((p) => p.id === goalPresetId) || locationPresets[2] || locationPresets[0];

  const handleSwapEndpoints = () => {
    setStartPresetId(goalPresetId);
    setGoalPresetId(startPresetId);
  };

  // Run Selected Algorithm
  const handleRunAlgorithm = () => {
    if (!graphEngine || !startPreset || !goalPreset) return;

    setIsRunning(true);
    setIsPlaying(false);

    try {
      const res = runAlgorithm(selectedAlgo, graphEngine, {
        startNodeId: startPreset.nearestNodeId,
        goalNodeId: goalPreset.nearestNodeId,
        traceEnabled: enableXRay,
      });

      setActiveResult(res);
      setComparisonResults(null);

      if (res.trace && res.trace.events.length > 0) {
        setTraceEvents(res.trace.events);
        setCurrentStepIndex(0); // Initialized at Step 0
      } else {
        setTraceEvents([]);
        setCurrentStepIndex(0);
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Run Compare All
  const handleCompareAll = () => {
    if (!graphEngine || !startPreset || !goalPreset) return;

    setIsRunning(true);
    setIsPlaying(false);

    try {
      const results = compareAll(
        graphEngine,
        startPreset.nearestNodeId,
        goalPreset.nearestNodeId
      );

      setComparisonResults(results);
      setActiveResult(results[selectedAlgo]);
      setTraceEvents([]);
      setCurrentStepIndex(0);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run on mount or preset change once graphEngine is ready
  useEffect(() => {
    if (graphEngine && startPreset && goalPreset) {
      handleRunAlgorithm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphEngine, startPresetId, goalPresetId, selectedAlgo, enableXRay]);

  // Clean up playback on algorithm or route change
  useEffect(() => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      clearInterval(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [selectedAlgo, startPresetId, goalPresetId]);

  // X-Ray Playback Loop
  useEffect(() => {
    if (!isPlaying || traceEvents.length === 0) {
      if (animationFrameRef.current) {
        clearInterval(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Adaptive step pacing based on trace length & speed multiplier
    // At 1x: smooth progression through trace in ~5-6 seconds
    const intervalMs = 25;
    const baseStepsPerTick = Math.max(1, Math.round((traceEvents.length / 220) * playbackSpeed));

    animationFrameRef.current = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + baseStepsPerTick;
        if (next >= traceEvents.length - 1) {
          setIsPlaying(false);
          return traceEvents.length - 1;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (animationFrameRef.current) {
        clearInterval(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, traceEvents.length]);

  const activeEvent: SearchEvent | null =
    traceEvents.length > 0 && currentStepIndex < traceEvents.length
      ? traceEvents[currentStepIndex]
      : null;

  const isAtFinalStep = traceEvents.length > 0 && currentStepIndex >= traceEvents.length - 1;

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (isAtFinalStep) {
        // Reset to beginning and animate immediately
        setCurrentStepIndex(0);
      }
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden text-slate-200">
      {/* Module Header */}
      <div className="bg-obsidian-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-950/40 border border-logix-amber/50 text-logix-amber">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-tech text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
                AI Algorithm Lab
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                AI SEARCH BENCHMARK ENGINE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Corridor Routing: BFS · Uniform Cost Search · Greedy Best-First · A* Search
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunAlgorithm}
            disabled={isRunning || loading || !graphEngine}
            className="px-3.5 py-1.5 rounded-lg font-mono text-xs font-semibold bg-logix-amber hover:bg-amber-500 text-obsidian-950 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>RUN SELECTED</span>
          </button>

          <button
            onClick={handleCompareAll}
            disabled={isRunning || loading || !graphEngine}
            className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Split className="w-4 h-4 text-emerald-400" />
            <span>COMPARE ALL</span>
          </button>

          <button
            onClick={() => setEnableXRay(!enableXRay)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all flex items-center gap-1.5 ${
              enableXRay
                ? 'bg-amber-950/40 text-amber-300 border-logix-amber'
                : 'bg-obsidian-850 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Search X-Ray: {enableXRay ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Split Layout: Controls + Map */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side Control & Analysis Deck */}
        <div className="w-full lg:w-96 xl:w-[420px] bg-obsidian-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto z-20">
          <div className="p-4 space-y-4">
            {/* 1. Origin & Destination Selector */}
            <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-logix-amber" />
                Origin & Destination Hubs
              </span>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-emerald-400 font-semibold block mb-1">
                    STARTING LOCATION (A)
                  </label>
                  <select
                    value={startPresetId}
                    onChange={(e) => setStartPresetId(e.target.value)}
                    className="w-full bg-obsidian-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {locationPresets.map((preset: LocationPreset) => (
                      <option key={`start_${preset.id}`} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleSwapEndpoints}
                    title="Swap Endpoints"
                    className="p-1 rounded-full bg-obsidian-850 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500 transition-all"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-rose-400 font-semibold block mb-1">
                    DESTINATION TARGET (B)
                  </label>
                  <select
                    value={goalPresetId}
                    onChange={(e) => setGoalPresetId(e.target.value)}
                    className="w-full bg-obsidian-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    {locationPresets.map((preset: LocationPreset) => (
                      <option key={`goal_${preset.id}`} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Algorithm Selector Tabs */}
            <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-logix-amber" />
                Select Routing Algorithm
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {(['BFS', 'UCS', 'GREEDY', 'ASTAR'] as AlgorithmType[]).map((algo) => {
                  const isSelected = selectedAlgo === algo;
                  const labelMap: Record<AlgorithmType, string> = {
                    BFS: 'Breadth-First',
                    UCS: 'Uniform Cost',
                    GREEDY: 'Greedy Heuristic',
                    ASTAR: 'A* Search',
                  };
                  return (
                    <button
                      key={algo}
                      onClick={() => setSelectedAlgo(algo)}
                      className={`px-3 py-2 rounded-lg text-xs font-mono text-left border transition-all ${
                        isSelected
                          ? 'bg-amber-950/50 border-logix-amber text-amber-300 font-semibold shadow-sm'
                          : 'bg-obsidian-850 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{algo}</div>
                      <div className="text-[10px] text-slate-400 truncate">{labelMap[algo]}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Real Route Metrics Card */}
            {activeResult && (
              <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-logix-amber" />
                    {activeResult.algorithm} Telemetry
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      activeResult.found
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                    }`}
                  >
                    {activeResult.found ? 'PATH FOUND' : 'DISCONNECTED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-obsidian-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Distance</span>
                    <strong className="text-slate-100 text-sm">
                      {(activeResult.distanceMeters / 1000).toFixed(2)} km
                    </strong>
                    <span className="text-[10px] text-slate-400 block">
                      ({activeResult.distanceMeters.toLocaleString()} m)
                    </span>
                  </div>

                  <div className="bg-obsidian-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Effective Cost</span>
                    <strong className="text-amber-400 text-sm">
                      {activeResult.effectiveCost.toLocaleString()}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">weighted meters</span>
                  </div>

                  <div className="bg-obsidian-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Topological Hops</span>
                    <strong className="text-slate-100 text-sm">{activeResult.hopCount}</strong>
                    <span className="text-[10px] text-slate-400 block">road segments</span>
                  </div>

                  <div className="bg-obsidian-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Nodes Explored</span>
                    <strong className="text-cyan-400 text-sm">
                      {activeResult.exploredCount.toLocaleString()}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">graph nodes</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Execution Runtime:
                  </span>
                  <strong className="text-emerald-400">{activeResult.executionMs} ms</strong>
                </div>
              </div>
            )}

            {/* 4. Search X-Ray Interactive Controller & Scrubber */}
            {enableXRay && traceEvents.length > 0 && (
              <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Search X-Ray Scrubber
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Step {currentStepIndex + 1} / {traceEvents.length}
                  </span>
                </div>

                {/* Progress bar */}
                <input
                  type="range"
                  min="0"
                  max={traceEvents.length - 1}
                  value={currentStepIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentStepIndex(Number(e.target.value));
                  }}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-obsidian-850 rounded-lg"
                />

                {/* Playback Controls */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex(0);
                      }}
                      title="Restart"
                      className="p-1.5 rounded bg-obsidian-850 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
                      }}
                      title="Step Back"
                      className="p-1.5 rounded bg-obsidian-850 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleTogglePlay}
                      title={isPlaying ? 'Pause Animation' : isAtFinalStep ? 'Replay Search Animation' : 'Animate Search Exploration'}
                      className={`p-1.5 px-3 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                        isPlaying
                          ? 'bg-amber-500 hover:bg-amber-400 text-obsidian-950'
                          : isAtFinalStep
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>PAUSE</span>
                        </>
                      ) : isAtFinalStep ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>REPLAY SEARCH</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>ANIMATE SEARCH</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex((prev) => Math.min(traceEvents.length - 1, prev + 1));
                      }}
                      title="Step Forward"
                      className="p-1.5 rounded bg-obsidian-850 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {[0.5, 1, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-1.5 py-1 rounded border ${
                          playbackSpeed === spd
                            ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-obsidian-850 border-slate-800 text-slate-400'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Academic State Inspector */}
                {activeEvent && (
                  <div className="bg-obsidian-900 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-1">
                      <span className="text-cyan-400 font-bold">{activeEvent.type}</span>
                      <code className="text-[10px] text-slate-400">{activeEvent.nodeId}</code>
                    </div>

                    {selectedAlgo === 'ASTAR' && (
                      <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                        <div className="bg-obsidian-950 p-1 rounded">
                          <span className="text-[9px] text-slate-400 block">g(n)</span>
                          <span className="text-amber-400 font-bold">{activeEvent.cost ?? 0}m</span>
                        </div>
                        <div className="bg-obsidian-950 p-1 rounded">
                          <span className="text-[9px] text-slate-400 block">h(n)</span>
                          <span className="text-cyan-400 font-bold">{activeEvent.heuristic ?? 0}m</span>
                        </div>
                        <div className="bg-obsidian-950 p-1 rounded">
                          <span className="text-[9px] text-slate-400 block">f(n)</span>
                          <span className="text-emerald-400 font-bold">{activeEvent.fCost ?? 0}m</span>
                        </div>
                      </div>
                    )}

                    {selectedAlgo === 'UCS' && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400">g(n) Cost:</span>
                        <strong className="text-amber-400">{activeEvent.cost ?? 0}m</strong>
                      </div>
                    )}

                    {selectedAlgo === 'GREEDY' && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400">h(n) Heuristic:</span>
                        <strong className="text-cyan-400">{activeEvent.heuristic ?? 0}m</strong>
                      </div>
                    )}

                    {selectedAlgo === 'BFS' && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400">Hop Depth:</span>
                        <strong className="text-slate-200">{activeEvent.depth ?? 0}</strong>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Frontier (Open): {activeEvent.frontierSize}</span>
                      <span>Settled (Closed): {activeEvent.visitedSize}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Map & Compare Table Area */}
        <div className="flex-1 flex flex-col relative h-full min-h-[500px]">
          {loading && (
            <div className="absolute inset-0 z-30 bg-obsidian-950/90 flex flex-col items-center justify-center text-slate-300">
              <div className="w-10 h-10 border-2 border-logix-amber/20 border-t-logix-amber rounded-full animate-spin mb-4" />
              <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                Loading Hyderabad Operational Vector Graph...
              </span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-30 bg-obsidian-950/95 flex flex-col items-center justify-center text-rose-300 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
              <h3 className="font-tech text-base font-bold uppercase text-slate-100">Dataset Load Exception</h3>
              <p className="text-xs font-mono text-slate-400 mt-1">{error}</p>
            </div>
          )}

          <div className="flex-1 relative w-full h-full">
            <MapContainer
              center={[17.4435, 78.3772]}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full z-10"
              style={{ background: '#070b12' }}
            >
              <BasemapTileLayer />

              <RouteVisualizerLayer
                graph={graphEngine}
                searchResult={activeResult}
                traceEvents={traceEvents}
                currentStepIndex={currentStepIndex}
                enableXRay={enableXRay}
                startNodeId={startPreset ? startPreset.nearestNodeId : ''}
                goalNodeId={goalPreset ? goalPreset.nearestNodeId : ''}
              />
            </MapContainer>
          </div>

          {/* Bottom Compare All Table Overlay */}
          {comparisonResults && (
            <div className="absolute bottom-4 left-4 right-4 z-20 bg-obsidian-950/95 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur max-h-72 overflow-x-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="font-tech font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Split className="w-4 h-4 text-logix-amber" />
                  Algorithm Benchmark Matrix ({startPreset?.label.split(' ')[0]} → {goalPreset?.label.split(' ')[0]})
                </span>
                <button
                  onClick={() => setComparisonResults(null)}
                  className="text-xs font-mono text-slate-400 hover:text-slate-200"
                >
                  ✕ Close
                </button>
              </div>

              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                    <th className="py-2 px-3">Algorithm</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Distance</th>
                    <th className="py-2 px-3">Effective Cost</th>
                    <th className="py-2 px-3">Hops</th>
                    <th className="py-2 px-3">Nodes Explored</th>
                    <th className="py-2 px-3">Runtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(['BFS', 'UCS', 'GREEDY', 'ASTAR'] as AlgorithmType[]).map((algo) => {
                    const row = comparisonResults[algo];
                    const isAStarOrUCS = algo === 'ASTAR' || algo === 'UCS';
                    return (
                      <tr
                        key={algo}
                        onClick={() => {
                          setSelectedAlgo(algo);
                          setActiveResult(row);
                          if (enableXRay && graphEngine && startPreset && goalPreset) {
                            const res = runAlgorithm(algo, graphEngine, {
                              startNodeId: startPreset.nearestNodeId,
                              goalNodeId: goalPreset.nearestNodeId,
                              traceEnabled: true,
                            });
                            setTraceEvents(res.trace?.events || []);
                            setCurrentStepIndex(0);
                            setIsPlaying(false);
                          }
                        }}
                        className={`cursor-pointer hover:bg-obsidian-900 transition-colors ${
                          selectedAlgo === algo ? 'bg-amber-950/20 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-slate-200 flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              algo === 'ASTAR'
                                ? 'bg-emerald-400'
                                : algo === 'UCS'
                                ? 'bg-amber-400'
                                : algo === 'GREEDY'
                                ? 'bg-cyan-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          {algo}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              row.found
                                ? 'bg-emerald-950/60 text-emerald-400'
                                : 'bg-rose-950/60 text-rose-400'
                            }`}
                          >
                            {row.found ? 'Optimal / Valid' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {(row.distanceMeters / 1000).toFixed(2)} km
                        </td>
                        <td className={`py-2 px-3 ${isAStarOrUCS ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                          {row.effectiveCost.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-slate-300">{row.hopCount}</td>
                        <td className="py-2 px-3 text-cyan-400">{row.exploredCount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-emerald-400">{row.executionMs} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
