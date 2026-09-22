import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Search,
  Activity,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Copy,
  X,
  SlidersHorizontal
} from "lucide-react";
import { useTranslation } from "../i18n";
import {
  FormalReport,
  FormalEngineKind,
  FormalResultStatus,
  CounterexampleTrace,
  runFormalVerification,
  injectTraceToWaveform,
  SVA_TEMPLATES,
  SvaTemplateItem,
  formatSignalValueCompact
} from "../engine/formalModel";
import { toast } from "../engine/toast";

interface FormalVerificationViewerProps {
  sourceCode?: string;
  topModule?: string;
  onNavigateToWaveform?: () => void;
  onInsertAssertion?: (snippet: string) => void;
}

export const FormalVerificationViewer: React.FC<FormalVerificationViewerProps> = ({
  sourceCode = "",
  topModule = "top",
  onNavigateToWaveform,
  onInsertAssertion,
}) => {
  const { t } = useTranslation();

  // Formal Configuration State
  const [maxDepth, setMaxDepth] = useState<number>(20);
  const [engineMode, setEngineMode] = useState<FormalEngineKind>("bmc");
  const [clockNet, setClockNet] = useState<string>("");
  const [resetNet, setResetNet] = useState<string>("");
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Verification Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [report, setReport] = useState<FormalReport | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | FormalResultStatus>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Trace Inspector State
  const [scrubbedCycle, setScrubbedCycle] = useState<number>(0);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const selectedGoal = useMemo(() => {
    if (!report || !selectedGoalId) return null;
    return report.goals.find((g) => g.id === selectedGoalId) || null;
  }, [report, selectedGoalId]);

  const activeTrace: CounterexampleTrace | null = useMemo(() => {
    return selectedGoal?.trace || null;
  }, [selectedGoal]);

  // Sync scrubbed cycle when selected goal changes
  useEffect(() => {
    if (activeTrace && activeTrace.steps.length > 0) {
      setScrubbedCycle(activeTrace.cycle_index || activeTrace.steps.length - 1);
    } else {
      setScrubbedCycle(0);
    }
  }, [activeTrace]);

  // Execute Formal Verification
  const handleRunFormal = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const res = await runFormalVerification(
        sourceCode,
        topModule,
        maxDepth,
        engineMode,
        clockNet.trim() ? clockNet.trim() : undefined,
        resetNet.trim() ? resetNet.trim() : undefined
      );
      setReport(res);

      if (res.falsified_count > 0) {
        const firstFalsified = res.goals.find((g) => g.status === "Falsified");
        if (firstFalsified) {
          setSelectedGoalId(firstFalsified.id);
        }
        toast.warning(
          `Formal Check Complete: ${res.falsified_count} assertion(s) falsified with counterexample traces.`
        );
      } else if (res.proven_count > 0) {
        const firstProven = res.goals.find((g) => g.status === "Proven");
        if (firstProven) {
          setSelectedGoalId(firstProven.id);
        }
        toast.success(
          `Formal Check Complete: ${res.proven_count} goal(s) verified bounded to depth ${res.max_depth}.`
        );
      } else {
        toast.info(`Formal Check Complete: ${res.total_goals} goal(s) processed.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Formal Verification failed: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Load Counterexample Trace into Waveforms
  const handleLoadTraceToWaveforms = () => {
    if (!activeTrace) return;
    const { signalCount, cycleCount } = injectTraceToWaveform(activeTrace, topModule);
    toast.success(
      `Counterexample trace loaded: ${signalCount} signals over ${cycleCount} cycles.`
    );
    if (onNavigateToWaveform) {
      onNavigateToWaveform();
    }
  };

  // Insert Template
  const handleInsertTemplate = (template: SvaTemplateItem) => {
    if (onInsertAssertion) {
      onInsertAssertion(template.snippet);
      toast.success(`Inserted assertion: ${template.title}`);
    } else {
      navigator.clipboard.writeText(template.snippet);
      toast.info(`Assertion copied to clipboard: ${template.title}`);
    }
  };

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    if (!report) return [];
    return report.goals.filter((goal) => {
      if (activeFilter !== "all" && goal.status !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          goal.name.toLowerCase().includes(query) ||
          goal.source_text.toLowerCase().includes(query) ||
          (goal.note && goal.note.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [report, activeFilter, searchQuery]);

  // Current step signals in trace inspector
  const currentStepData = useMemo(() => {
    if (!activeTrace || !activeTrace.steps || activeTrace.steps.length === 0) {
      return null;
    }
    const step =
      activeTrace.steps.find((s) => s.cycle === scrubbedCycle) ||
      activeTrace.steps[Math.min(scrubbedCycle, activeTrace.steps.length - 1)];

    const prevStep =
      scrubbedCycle > 0
        ? activeTrace.steps.find((s) => s.cycle === scrubbedCycle - 1)
        : null;

    return { step, prevStep };
  }, [activeTrace, scrubbedCycle]);

  // Status Badge Component
  const renderStatusBadge = (status: FormalResultStatus) => {
    switch (status) {
      case "Proven":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.formal.proven}
          </span>
        );
      case "Falsified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            {t.formal.falsified}
          </span>
        );
      case "Covered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Eye className="w-3.5 h-3.5" />
            {t.formal.covered}
          </span>
        );
      case "Vacuous":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t.formal.vacuous}
          </span>
        );
      case "Unreached":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <HelpCircle className="w-3.5 h-3.5" />
            {t.formal.unreached}
          </span>
        );
      case "Inconclusive":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-600/20 text-slate-300 border border-slate-600/40">
            <RotateCcw className="w-3.5 h-3.5" />
            {t.formal.inconclusive}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0c1017] text-[#c9d1d9] select-none overflow-hidden font-sans">
      {/* Top Header & Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                {t.formal.title}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                {topModule}
              </span>
            </div>
            <p className="text-xs text-[#8b949e]">
              {t.formal.subtitle}
            </p>
          </div>
        </div>

        {/* Verification Settings & Run Action */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Engine Selector */}
          <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
            <button
              onClick={() => setEngineMode("bmc")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                engineMode === "bmc"
                  ? "bg-[#238636] text-white shadow-sm"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              {t.formal.bmc}
            </button>
            <button
              onClick={() => setEngineMode("k_induction")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                engineMode === "k_induction"
                  ? "bg-[#1f6feb] text-white shadow-sm"
                  : "text-[#8b949e] hover:text-white"
              }`}
            >
              {t.formal.kInduction}
            </button>
          </div>

          {/* Bound Depth Input */}
          <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1">
            <span className="text-xs text-[#8b949e] font-mono">{t.formal.depth}:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="w-12 bg-transparent text-xs font-mono font-semibold text-white focus:outline-none text-center"
            />
          </div>

          {/* Config Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            title="Configure Clock & Reset Net Names"
            className={`p-1.5 rounded-lg border transition-colors ${
              showConfig || clockNet || resetNet
                ? "bg-[#1f6feb]/20 border-[#1f6feb] text-blue-400"
                : "bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Template Assistant Button */}
          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.formal.templates}</span>
          </button>

          {/* Run Action */}
          <button
            onClick={handleRunFormal}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
              isRunning
                ? "bg-[#238636]/50 text-white/70 cursor-not-allowed"
                : "bg-[#238636] hover:bg-[#2ea043] text-white hover:shadow"
            }`}
          >
            {isRunning ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? t.formal.verifying : t.formal.runCheck}</span>
          </button>
        </div>
      </div>

      {/* Optional Net Names Configuration Row */}
      {showConfig && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[#0d1117] border-b border-[#30363d] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#8b949e] font-mono">Clock Net:</span>
            <input
              type="text"
              value={clockNet}
              onChange={(e) => setClockNet(e.target.value)}
              placeholder="auto (clk)"
              className="px-2 py-0.5 bg-[#161b22] border border-[#30363d] rounded text-white font-mono text-xs w-28 focus:outline-none focus:border-[#388bfd]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#8b949e] font-mono">Reset Net:</span>
            <input
              type="text"
              value={resetNet}
              onChange={(e) => setResetNet(e.target.value)}
              placeholder="auto (rst_n)"
              className="px-2 py-0.5 bg-[#161b22] border border-[#30363d] rounded text-white font-mono text-xs w-28 focus:outline-none focus:border-[#388bfd]"
            />
          </div>
          <span className="text-[11px] text-[#8b949e] italic">
            Leave blank to enable automatic clock and reset recognition.
          </span>
        </div>
      )}

      {/* KPI Metrics Scorecards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 px-4 py-2.5 bg-[#0d1117] border-b border-[#21262d] shrink-0">
          <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
            <div className="text-[11px] text-[#8b949e]">{t.formal.totalGoals}</div>
            <div className="text-base font-bold text-white font-mono">{report.total_goals}</div>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-emerald-500/20">
            <div className="text-[11px] text-emerald-400">{t.formal.proven}</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{report.proven_count}</div>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-rose-500/20">
            <div className="text-[11px] text-rose-400">{t.formal.falsified}</div>
            <div className="text-base font-bold text-rose-400 font-mono">{report.falsified_count}</div>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-indigo-500/20">
            <div className="text-[11px] text-indigo-400">{t.formal.covered}</div>
            <div className="text-base font-bold text-indigo-400 font-mono">{report.covered_count}</div>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-amber-500/20">
            <div className="text-[11px] text-amber-400">{t.formal.vacuous}</div>
            <div className="text-base font-bold text-amber-400 font-mono">{report.vacuous_count}</div>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
            <div className="text-[11px] text-[#8b949e]">{t.formal.runtime}</div>
            <div className="text-base font-bold text-slate-300 font-mono">
              {report.execution_time_ms.toFixed(1)} ms
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Goals List & Filtering */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#30363d] overflow-hidden">
          {/* Filter Ribbon & Search */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {(
                [
                  "all",
                  "Proven",
                  "Falsified",
                  "Covered",
                  "Vacuous",
                  "Unreached",
                ] as const
              ).map((f) => {
                const count =
                  f === "all"
                    ? report?.total_goals ?? 0
                    : f === "Proven"
                    ? report?.proven_count ?? 0
                    : f === "Falsified"
                    ? report?.falsified_count ?? 0
                    : f === "Covered"
                    ? report?.covered_count ?? 0
                    : f === "Vacuous"
                    ? report?.vacuous_count ?? 0
                    : report?.unreached_count ?? 0;

                const label =
                  f === "all"
                    ? t.formal.allFilter
                    : f === "Proven"
                    ? t.formal.proven
                    : f === "Falsified"
                    ? t.formal.falsified
                    : f === "Covered"
                    ? t.formal.covered
                    : f === "Vacuous"
                    ? t.formal.vacuous
                    : t.formal.unreached;

                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      activeFilter === f
                        ? "bg-[#21262d] text-white border border-[#388bfd]"
                        : "text-[#8b949e] hover:text-[#c9d1d9]"
                    }`}
                  >
                    {label}
                    {report && (
                      <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-[#0d1117] text-[#8b949e]">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-48 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.formal.searchPlaceholder}
                className="w-full pl-8 pr-2 py-1 text-xs bg-[#0d1117] text-white border border-[#30363d] rounded-md focus:outline-none focus:border-[#388bfd]"
              />
            </div>
          </div>

          {/* Goals Table */}
          <div className="flex-1 overflow-y-auto">
            {!report ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <ShieldCheck className="w-12 h-12 text-[#8b949e]/40 mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">
                  {t.formal.readyTitle}
                </h3>
                <p className="text-xs text-[#8b949e] max-w-md mb-4">
                  {t.formal.readyDesc}
                </p>
                <button
                  onClick={handleRunFormal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.formal.runCheck} (Depth {maxDepth})</span>
                </button>
              </div>
            ) : filteredGoals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-[#8b949e] text-xs">
                {t.formal.noGoalsMatch}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#161b22] text-[#8b949e] uppercase font-mono text-[11px] sticky top-0 border-b border-[#30363d] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">{t.formal.goalName}</th>
                    <th className="py-2.5 px-3">{t.formal.kind}</th>
                    <th className="py-2.5 px-3">Depth</th>
                    <th className="py-2.5 px-3">{t.formal.propertyExpr}</th>
                    <th className="py-2.5 px-3">{t.formal.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]">
                  {filteredGoals.map((goal) => {
                    const isSelected = selectedGoalId === goal.id;
                    return (
                      <tr
                        key={goal.id}
                        onClick={() => setSelectedGoalId(goal.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#1f6feb]/15 hover:bg-[#1f6feb]/20"
                            : "hover:bg-[#161b22]/70"
                        }`}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderStatusBadge(goal.status)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white font-mono">
                          {goal.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#21262d] text-[#8b949e]">
                            {goal.kind}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {goal.depth_reached} / {report.max_depth}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300 max-w-xs truncate" title={goal.source_text}>
                          {goal.source_text}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {goal.trace ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGoalId(goal.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-blue-400 font-medium text-[11px]"
                            >
                              <Activity className="w-3 h-3" />
                              {t.formal.inspectTrace}
                            </button>
                          ) : (
                            <span className="text-[#8b949e] text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Trace Inspector & Valuation Details */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-[#0d1117] shrink-0 overflow-hidden">
          {selectedGoal ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Goal Detail Header */}
              <div className="p-3 bg-[#161b22] border-b border-[#30363d]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-white truncate">
                    {selectedGoal.name}
                  </span>
                  {renderStatusBadge(selectedGoal.status)}
                </div>
                <div className="text-[11px] font-mono text-[#8b949e] bg-[#0d1117] p-2 rounded border border-[#21262d] mb-2 break-all">
                  {selectedGoal.source_text}
                </div>
                {selectedGoal.note && (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedGoal.note}
                  </p>
                )}
              </div>

              {/* Counterexample / Witness Trace Panel */}
              {activeTrace ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Trace Actions Bar */}
                  <div className="flex items-center justify-between p-3 bg-[#161b22]/50 border-b border-[#21262d]">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        {selectedGoal.kind === "Cover" ? t.formal.witnessTrace : t.formal.counterexampleTrace}
                      </span>
                    </div>

                    <button
                      onClick={handleLoadTraceToWaveforms}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white shadow-sm transition-colors"
                      title="Load this trace directly into the Waveform Viewer"
                    >
                      <Activity className="w-3 h-3" />
                      <span>{t.formal.loadToWaveforms}</span>
                    </button>
                  </div>

                  {/* Cycle Scrubber Control */}
                  <div className="p-3 bg-[#161b22]/20 border-b border-[#21262d]">
                    <div className="flex items-center justify-between text-xs text-[#8b949e] mb-1.5 font-mono">
                      <span>{t.formal.cycle}: <strong className="text-white">{scrubbedCycle}</strong> / {activeTrace.steps.length - 1}</span>
                      <span>{scrubbedCycle * 10}.000 ns</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScrubbedCycle((c) => Math.max(0, c - 1))}
                        disabled={scrubbedCycle <= 0}
                        className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 text-white"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={activeTrace.steps.length - 1}
                        value={scrubbedCycle}
                        onChange={(e) => setScrubbedCycle(parseInt(e.target.value, 10))}
                        className="flex-1 h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-[#1f6feb]"
                      />

                      <button
                        onClick={() => setScrubbedCycle((c) => Math.min(activeTrace.steps.length - 1, c + 1))}
                        disabled={scrubbedCycle >= activeTrace.steps.length - 1}
                        className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 text-white"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Signal Valuation Snapshot Table */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="text-[11px] font-mono text-[#8b949e] uppercase mb-2">
                      {t.formal.valuationsTitle} (Cycle {scrubbedCycle})
                    </div>

                    {currentStepData && currentStepData.step ? (
                      <div className="space-y-1.5">
                        {Object.entries(currentStepData.step.signals).map(([sig, rawVal]) => {
                          const val = formatSignalValueCompact(rawVal);
                          const prevRaw = currentStepData.prevStep?.signals[sig];
                          const prevVal = prevRaw ? formatSignalValueCompact(prevRaw) : null;
                          const changed = prevVal !== null && prevVal !== val;

                          return (
                            <div
                              key={sig}
                              className={`flex items-center justify-between p-1.5 rounded text-xs font-mono border ${
                                changed
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                  : "bg-[#161b22] border-[#21262d] text-[#c9d1d9]"
                              }`}
                            >
                              <span className="truncate mr-2 font-medium" title={sig}>
                                {sig}
                              </span>
                              <span
                                className={`font-semibold shrink-0 ${
                                  changed ? "text-blue-400" : "text-white"
                                }`}
                              >
                                {val}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-[#8b949e]">{t.formal.noValuations}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#8b949e] text-xs">
                  <ShieldCheck className="w-8 h-8 text-emerald-400/40 mb-2" />
                  <p className="font-semibold text-white mb-1">{t.formal.proven}</p>
                  <p>
                    This property held across all candidate stimulus paths up to depth {selectedGoal.depth_reached}. No counterexample trace exists.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[#8b949e] text-xs">
              Select a formal goal from the table to inspect property details and explore counterexample transitions.
            </div>
          )}
        </div>
      </div>

      {/* SVA Template Assistant Modal / Drawer */}
      {isTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">{t.formal.templatesTitle}</h3>
              </div>
              <button
                onClick={() => setIsTemplatesOpen(false)}
                className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-[#161b22] border-b border-[#21262d] text-xs">
              {["all", "safety", "handshake", "fsm", "structural"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    selectedCategory === cat
                      ? "bg-[#1f6feb] text-white"
                      : "text-[#8b949e] hover:text-[#c9d1d9] bg-[#0d1117]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {SVA_TEMPLATES.filter(
                (tpl) => selectedCategory === "all" || tpl.category === selectedCategory
              ).map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-[#1f6feb]/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{tpl.title}</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e]">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#8b949e] mb-2 leading-relaxed">{tpl.description}</p>
                  <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#161b22] border border-[#21262d] font-mono text-xs text-blue-300">
                    <code className="truncate">{tpl.snippet}</code>
                    <button
                      onClick={() => handleInsertTemplate(tpl)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-white text-[11px] font-sans font-medium shrink-0 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{t.formal.useTemplate}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
              <button
                onClick={() => setIsTemplatesOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] transition-colors"
              >
                {t.formal.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
