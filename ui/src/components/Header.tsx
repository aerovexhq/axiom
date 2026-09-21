import React from "react";
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  RotateCcw,
  Cpu,
  Zap,
  Activity,
  Bug,
  Menu,
  Search,
  Columns,
  Minimize2,
  GraduationCap
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { AxiomProject } from "../engine/projectModel";
import { MobilePanelType } from "./MobileDrawer";
import { useTranslation } from "../i18n";
import { LanguageDropdown } from "./LanguageDropdown";
import { ProjectDropdown } from "./ProjectDropdown";

interface HeaderProps {
  state: SimulationState;
  onCompile: () => void;
  project?: AxiomProject | null;
  onOpenNewProject?: () => void;
  onCloseProject?: () => void;
  onSaveProject?: () => void;
  onExportProjectJson?: () => void;
  onOpenAddSource?: () => void;
  isSaved?: boolean;
  isMobile?: boolean;
  onToggleMobileDrawer?: () => void;
  activeMobilePanel?: MobilePanelType;
  editorWidthPercent?: number;
  onSetEditorWidthPercent?: (pct: number) => void;
  maximizedPanel?: string | null;
  onRestoreMaximizedPanel?: () => void;
  activeCrossProbeSignal?: string | null;
  onOpenOmnibar?: () => void;
  onOpenLabGrader?: () => void;
  isSplitView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onCompile,
  project,
  onOpenNewProject,
  onCloseProject,
  onSaveProject,
  onExportProjectJson,
  onOpenAddSource,
  isSaved = true,
  isMobile = false,
  onToggleMobileDrawer,
  activeMobilePanel: _activeMobilePanel,
  editorWidthPercent,
  onSetEditorWidthPercent,
  maximizedPanel,
  onRestoreMaximizedPanel,
  activeCrossProbeSignal,
  onOpenOmnibar,
  onOpenLabGrader,
  isSplitView = true
}) => {
  const { t } = useTranslation();

  const formatTime = (timePs: number) => {
    if (timePs >= 1_000_000) {
      return `${(timePs / 1_000_000).toFixed(3)}\u00A0μs`;
    } else if (timePs >= 1_000) {
      return `${(timePs / 1_000).toFixed(3)}\u00A0ns`;
    } else {
      return `${timePs}\u00A0ps`;
    }
  };

  if (isMobile) {
    return (
      <header
        style={{
          height: 42,
          minHeight: 42,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          zIndex: 25,
          flexShrink: 0
        }}
      >
        {/* Mobile Left: Hamburger + Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
          <button
            onClick={onToggleMobileDrawer}
            aria-label={t("mobile.menu")}
            title={t("mobile.menu")}
            className="btn btn-secondary btn-icon"
            style={{ width: 32, height: 32 }}
          >
            <Menu size={18} />
          </button>

          <div
            onClick={project ? onCloseProject : undefined}
            title={project ? "Return to Main Menu" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              cursor: project ? "pointer" : "default"
            }}
          >
            <img
              src="/logo.svg"
              alt="Axiom Logo"
              style={{
                width: 20,
                height: 20,
                borderRadius: "var(--radius-sm)"
              }}
            />
            {!project && (
              <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em" }}>
                Axiom
              </span>
            )}
          </div>

          {project ? (
            <span
              className="badge badge-cyan"
              style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}
              title={project.name}
            >
              {project.name}
            </span>
          ) : (
            <span
              style={{
                fontSize: 10.5,
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-tertiary)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)"
              }}
            >
              {t("header.noProject")}
            </span>
          )}
        </div>

        {/* Mobile Right: Simulation Clock & Quick Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Custom Mobile Language Selector (Flag Only) */}
          <LanguageDropdown align="right" />

          {project && (
            <span
              className="mono-num"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--accent-cyan)",
                backgroundColor: "var(--bg-tertiary)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "nowrap"
              }}
              title={`${t("header.simClock")}: ${state.currentSimTimePs} ps (δ=${state.currentDeltaCycle})`}
            >
              {formatTime(state.currentSimTimePs)}
            </span>
          )}

          {project && (
            <>
              {state.isRunning ? (
                <button
                  onClick={() => engineBridge.pause()}
                  aria-label={t("header.pause")}
                  title={t("header.pause")}
                  className="btn btn-danger"
                  style={{ width: 28, height: 28, padding: 0 }}
                >
                  <Pause size={14} />
                </button>
              ) : (
                <button
                  onClick={() => engineBridge.play()}
                  disabled={!state.compiled}
                  aria-label={t("header.run")}
                  title={t("header.run")}
                  className={state.compiled ? "btn btn-success" : "btn btn-secondary"}
                  style={{ width: 28, height: 28, padding: 0 }}
                >
                  <Play size={14} />
                </button>
              )}

              <button
                onClick={onCompile}
                title={t("header.recompile")}
                aria-label={t("header.compile")}
                className="btn btn-secondary btn-icon"
                style={{ width: 28, height: 28 }}
              >
                <Cpu size={14} />
              </button>
            </>
          )}
        </div>
      </header>
    );
  }

  return (
    <header
      style={{
        height: 38,
        minHeight: 38,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        zIndex: 20,
        flexShrink: 0
      }}
    >
      {/* Left: Project Context & Compile (Zero duplicate branding) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
        {project ? (
          <>
            <ProjectDropdown
              project={project}
              onCloseProject={onCloseProject ?? (() => {})}
              onOpenNewProject={onOpenNewProject ?? (() => {})}
              onOpenAddSource={onOpenAddSource ?? (() => {})}
              onExportProjectJson={onExportProjectJson ?? (() => {})}
              onSaveProject={onSaveProject ?? (() => {})}
              isSaved={isSaved}
            />

            {/* Compile Button */}
            <button
              onClick={onCompile}
              title={t("header.recompile")}
              className={state.compiled ? "btn btn-secondary" : "btn btn-primary"}
              style={{ height: 28, fontSize: 12, padding: "0 10px" }}
            >
              <Cpu size={13} />
              <span>{state.compiled ? t("header.recompile") : t("header.compile")}</span>
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-tertiary)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "nowrap"
              }}
            >
              {t("header.noProject")}
            </span>
          </div>
        )}
      </div>

      {/* Center: Modern Aerospace Simulation Transport Ribbon */}
      {project ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            backgroundColor: "var(--bg-primary)",
            padding: "2px 4px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
            flexShrink: 0,
            whiteSpace: "nowrap"
          }}
        >
          {state.isRunning ? (
            <button
              onClick={() => engineBridge.pause()}
              title={t("header.pause")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 26,
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fda4af",
                background: "linear-gradient(180deg, rgba(244, 63, 94, 0.25) 0%, rgba(244, 63, 94, 0.15) 100%)",
                border: "1px solid rgba(244, 63, 94, 0.5)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                boxShadow: "0 0 8px rgba(244, 63, 94, 0.2)"
              }}
            >
              <Pause size={12} fill="#fda4af" />
              <span>{t("header.pause")}</span>
            </button>
          ) : (
            <button
              onClick={() => engineBridge.play()}
              disabled={!state.compiled}
              title={state.compiled ? t("header.run") : t("launchpad.inRamJitDesc")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 26,
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 600,
                color: state.compiled ? "#6ee7b7" : "var(--text-muted)",
                background: state.compiled
                  ? "linear-gradient(180deg, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.12) 100%)"
                  : "transparent",
                border: state.compiled
                  ? "1px solid rgba(16, 185, 129, 0.45)"
                  : "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                cursor: state.compiled ? "pointer" : "not-allowed",
                boxShadow: state.compiled ? "0 0 8px rgba(16, 185, 129, 0.15)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <Play size={12} fill={state.compiled ? "#6ee7b7" : "currentColor"} />
              <span>{t("header.run")}</span>
            </button>
          )}

          <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            onClick={() => engineBridge.tick(1000)}
            disabled={!state.compiled || state.isRunning}
            title={`${t("header.step1ns")} (Physical Time Step)`}
            className="btn btn-ghost"
            style={{ height: 26, padding: "0 7px", fontSize: 11.5, fontWeight: 500 }}
          >
            <FastForward size={12} />
            <span>{t("header.step1ns")}</span>
          </button>

          <button
            onClick={() => engineBridge.tick(100)}
            disabled={!state.compiled || state.isRunning}
            title={`${t("header.step100ps")} (Physical Time Step)`}
            className="btn btn-ghost"
            style={{ height: 26, padding: "0 6px", fontSize: 11.5, fontWeight: 500 }}
          >
            <span>{t("header.step100ps")}</span>
          </button>

          <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            onClick={() => engineBridge.stepDelta()}
            disabled={!state.compiled || state.isRunning}
            title={`${t("header.stepDelta")} (Zero-Time Combinational Cycle)`}
            className="badge badge-purple btn"
            style={{ height: 26, padding: "0 8px", fontSize: 11.5, fontWeight: 600, cursor: state.compiled ? "pointer" : "not-allowed" }}
          >
            <span>{t("header.stepDelta")}</span>
          </button>

          {/* Time Machine Reverse Controls */}
          <button
            onClick={() => engineBridge.stepBackTime(1000)}
            disabled={!state.compiled || state.isRunning || state.currentSimTimePs === 0}
            title="Step -1 ns (Silicon Time-Machine Replay)"
            className="btn btn-ghost"
            style={{ height: 26, padding: "0 6px", fontSize: 11.5, fontWeight: 500 }}
          >
            <Rewind size={12} />
            <span>-1ns</span>
          </button>

          <button
            onClick={() => engineBridge.stepBackDelta()}
            disabled={!state.compiled || state.isRunning || (state.currentSimTimePs === 0 && state.currentDeltaCycle === 0)}
            title="Step -δ (Rewind Zero-Time Delta Cycle)"
            className="badge badge-purple btn"
            style={{ height: 26, padding: "0 6px", fontSize: 11, cursor: state.compiled ? "pointer" : "not-allowed" }}
          >
            <span>-δ</span>
          </button>

          <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            onClick={() => engineBridge.reset()}
            title={t("header.resetSim")}
            className="btn btn-ghost btn-icon"
            style={{ width: 26, height: 26 }}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* Right: Telemetry, Language, Presets & Omnibar */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, whiteSpace: "nowrap" }}>
        {project && (
          <>
            {/* Simulation Clock & Delta */}
            <div
              className="mono-num"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                flexShrink: 0
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--accent-cyan)", whiteSpace: "nowrap" }}>
                {formatTime(state.currentSimTimePs)}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 10.5, whiteSpace: "nowrap" }}>
                δ={state.currentDeltaCycle}
              </span>
            </div>

            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

            {/* Dynamic Telemetry (Power & Sag) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent-amber)" }}
                title="Peak Dynamic Current"
              >
                <Zap size={11} />
                <span className="mono-num">{state.peakCurrentMa.toFixed(1)} mA</span>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent-rose)" }}
                title="Max Voltage Sag"
              >
                <Activity size={11} />
                <span className="mono-num">-{state.maxSagMv.toFixed(1)} mV</span>
              </div>

              {state.glitchCount > 0 && (
                <div
                  className="badge badge-rose pulse-alert"
                  title="Zero-Time Glitches Detected"
                >
                  <Bug size={11} />
                  <span>{state.glitchCount}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Maximize Active Panel Restore Badge */}
        {project && maximizedPanel && onRestoreMaximizedPanel && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <button
              onClick={onRestoreMaximizedPanel}
              className="btn btn-cyan"
              style={{ height: 26, fontSize: 11 }}
            >
              <Minimize2 size={11} />
              <span>{t("header.restore")} {maximizedPanel.toUpperCase()}</span>
            </button>
          </>
        )}

        {/* Quick Layout Presets for Split View */}
        {project && isSplitView && !maximizedPanel && onSetEditorWidthPercent && editorWidthPercent !== undefined && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                backgroundColor: "var(--bg-primary)",
                padding: "2px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <Columns size={11} color="var(--text-muted)" style={{ margin: "0 2px" }} />
              <button
                onClick={() => onSetEditorWidthPercent(42)}
                title={`${t("header.balanced")} (42% / 58%)`}
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 42) < 2 ? 700 : 500,
                  padding: "1px 6px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 42) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 42) < 2 ? "var(--accent-blue)" : "var(--text-muted)",
                  transition: "all var(--transition-fast)"
                }}
              >
                {t("header.balanced")}
              </button>
              <button
                onClick={() => onSetEditorWidthPercent(55)}
                title={`${t("header.codeFocus")} (55% / 45%)`}
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 55) < 2 ? 700 : 500,
                  padding: "1px 6px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 55) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 55) < 2 ? "var(--accent-blue)" : "var(--text-muted)",
                  transition: "all var(--transition-fast)"
                }}
              >
                {t("header.codeFocus")}
              </button>
              <button
                onClick={() => onSetEditorWidthPercent(25)}
                title={`${t("header.visualFocus")} (25% / 75%)`}
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 25) < 2 ? 700 : 500,
                  padding: "1px 6px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 25) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 25) < 2 ? "var(--accent-blue)" : "var(--text-muted)",
                  transition: "all var(--transition-fast)"
                }}
              >
                {t("header.visualFocus")}
              </button>
            </div>
          </>
        )}

        {/* Cross Probe Active Signal */}
        {project && activeCrossProbeSignal && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>Probe:</span>
              <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {activeCrossProbeSignal}
              </span>
            </span>
          </>
        )}

        {/* Curriculum Lab Auto-Grader Button */}
        {project &&
          onOpenLabGrader &&
          (project.templateId === "class_examples_project" ||
            Boolean(project.lessonId) ||
            project.files.some((f) =>
              ["uygulama", "mux_4to1", "alu_4bit", "counter_up_down", "sequence_detector"].some((k) =>
                f.name.toLowerCase().includes(k)
              )
            )) && (
            <>
              <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
              <button
                type="button"
                onClick={onOpenLabGrader}
                title="Verify and grade curriculum laboratory assignment"
                aria-label="Verify and grade curriculum laboratory assignment"
                className="btn btn-secondary"
                style={{
                  height: 28,
                  padding: "0 10px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--accent-cyan)",
                  borderColor: "rgba(6, 182, 212, 0.4)",
                  backgroundColor: "rgba(6, 182, 212, 0.08)"
                }}
              >
                <GraduationCap size={14} />
                <span>Grade Lab</span>
              </button>
            </>
          )}

        {/* Omnibar & Command Palette (Single Icon Button) */}
        {onOpenOmnibar && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <button
              onClick={onOpenOmnibar}
              title={t("header.omnibarTooltip")}
              aria-label={t("header.omnibarTooltip")}
              className="btn btn-secondary btn-icon"
              style={{ width: 28, height: 28, padding: 0 }}
            >
              <Search size={14} color="var(--accent-blue)" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
