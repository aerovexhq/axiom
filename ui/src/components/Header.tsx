import React from "react";
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Cpu,
  Zap,
  Activity,
  Bug,
  FolderPlus,
  X,
  Menu,
  Search,
  Columns,
  Minimize2
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { AxiomProject } from "../engine/projectModel";
import { MobilePanelType } from "./MobileDrawer";

interface HeaderProps {
  state: SimulationState;
  onCompile: () => void;
  project?: AxiomProject | null;
  onOpenNewProject?: () => void;
  onCloseProject?: () => void;
  isMobile?: boolean;
  onToggleMobileDrawer?: () => void;
  activeMobilePanel?: MobilePanelType;
  editorWidthPercent?: number;
  onSetEditorWidthPercent?: (pct: number) => void;
  maximizedPanel?: string | null;
  onRestoreMaximizedPanel?: () => void;
  activeCrossProbeSignal?: string | null;
  onOpenOmnibar?: () => void;
  isSplitView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onCompile,
  project,
  onOpenNewProject,
  onCloseProject,
  isMobile = false,
  onToggleMobileDrawer,
  activeMobilePanel: _activeMobilePanel,
  editorWidthPercent,
  onSetEditorWidthPercent,
  maximizedPanel,
  onRestoreMaximizedPanel,
  activeCrossProbeSignal,
  onOpenOmnibar,
  isSplitView = true
}) => {
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexShrink: 1 }}>
          <button
            onClick={onToggleMobileDrawer}
            aria-label="Open Navigation Menu"
            title="Open Project & View Menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0
            }}
          >
            <Menu size={18} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
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
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.1)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                maxWidth: 90,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexShrink: 1
              }}
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
              No Project
            </span>
          )}
        </div>

        {/* Mobile Right: Simulation Clock & Quick Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {project && (
            <span
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: "var(--accent-cyan)",
                backgroundColor: "var(--bg-tertiary)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "nowrap"
              }}
              title={`Current sim time: ${state.currentSimTimePs} ps (δ=${state.currentDeltaCycle})`}
            >
              {formatTime(state.currentSimTimePs)}
            </span>
          )}

          {project && (
            <>
              {state.isRunning ? (
                <button
                  onClick={() => engineBridge.pause()}
                  aria-label="Pause"
                  title="Pause Simulation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    backgroundColor: "var(--accent-rose)",
                    color: "#fff",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <Pause size={14} />
                </button>
              ) : (
                <button
                  onClick={() => engineBridge.play()}
                  disabled={!state.compiled}
                  aria-label="Run"
                  title="Run Simulation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    backgroundColor: state.compiled ? "var(--accent-emerald)" : "var(--bg-tertiary)",
                    color: state.compiled ? "#fff" : "var(--text-muted)",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: state.compiled ? "pointer" : "not-allowed",
                    flexShrink: 0
                  }}
                >
                  <Play size={14} />
                </button>
              )}

              <button
                onClick={onCompile}
                title="Re-Compile JIT"
                aria-label="Compile JIT"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  backgroundColor: state.compiled ? "var(--bg-tertiary)" : "var(--accent-blue)",
                  color: state.compiled ? "var(--text-secondary)" : "#fff",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  flexShrink: 0
                }}
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
        height: 40,
        minHeight: 40,
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
      {/* Left: Brand & Project Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <img
            src="/logo.svg"
            alt="Axiom Logo"
            style={{
              width: 18,
              height: 18,
              borderRadius: "var(--radius-sm)"
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            Axiom EDA
          </span>
          <span
            style={{
              fontSize: 10,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-muted)",
              padding: "1px 5px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              whiteSpace: "nowrap"
            }}
          >
            v0.1.0-jit
          </span>
        </div>

        <div style={{ height: 16, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

        {/* Project Context & Controls */}
        {project ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexShrink: 1 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.08)",
                border: "1px solid rgba(6, 182, 212, 0.22)",
                padding: "2px 7px",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                maxWidth: "clamp(90px, 12vw, 160px)",
                minWidth: 0,
                flexShrink: 1,
                overflow: "hidden"
              }}
              title={`${project.name} (${project.targetDevice})`}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {project.name}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 10.5, flexShrink: 0, whiteSpace: "nowrap" }}>
                ({project.targetDevice.split(" ")[0]})
              </span>
            </span>

            {/* Compile Button */}
            <button
              onClick={onCompile}
              title="Elaborate HDL & JIT compile machine code in RAM"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                backgroundColor: state.compiled ? "var(--bg-tertiary)" : "var(--accent-blue)",
                color: state.compiled ? "var(--text-primary)" : "#fff",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${state.compiled ? "var(--border-subtle)" : "var(--accent-blue)"}`,
                fontWeight: 600,
                fontSize: 11.5,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease"
              }}
            >
              <Cpu size={12} />
              <span>{state.compiled ? "Re-Compile" : "Compile JIT"}</span>
            </button>

            {onCloseProject && (
              <button
                onClick={onCloseProject}
                title="Close active project and return to launchpad"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 6px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 11.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X size={12} />
                <span>Close</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic", whiteSpace: "nowrap" }}>
              No Project Open
            </span>
            {onOpenNewProject && (
              <button
                onClick={onOpenNewProject}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  backgroundColor: "var(--accent-blue)",
                  color: "#fff",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 11.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                <FolderPlus size={13} />
                <span>New Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center: Unified Vivado-style Simulation Control Segment */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          backgroundColor: "var(--bg-tertiary)",
          padding: "2px 4px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          flexShrink: 0,
          whiteSpace: "nowrap"
        }}
      >
        {state.isRunning ? (
          <button
            onClick={() => engineBridge.pause()}
            title="Pause Simulation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              backgroundColor: "var(--accent-rose)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 11.5,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Pause size={12} />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={() => engineBridge.play()}
            disabled={!state.compiled}
            title={state.compiled ? "Run Free Simulation" : "Compile HDL project to simulate"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              backgroundColor: state.compiled ? "var(--accent-emerald)" : "transparent",
              color: state.compiled ? "#fff" : "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 11.5,
              cursor: state.compiled ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Play size={12} />
            <span>Run</span>
          </button>
        )}

        <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

        <button
          onClick={() => engineBridge.tick(1000)}
          disabled={!state.compiled || state.isRunning}
          title="Advance simulation by 1 ns (Physical Time Step)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 6px",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11.5,
            opacity: state.compiled ? 1 : 0.4,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <FastForward size={12} />
          <span>+1ns</span>
        </button>

        <button
          onClick={() => engineBridge.tick(100)}
          disabled={!state.compiled || state.isRunning}
          title="Advance simulation by 100 ps"
          style={{
            padding: "2px 5px",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            opacity: state.compiled ? 1 : 0.4,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          +100ps
        </button>

        <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

        <button
          onClick={() => engineBridge.stepDelta()}
          disabled={!state.compiled || state.isRunning}
          title="Step single discrete delta-cycle (δ-step) in zero simulation time"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 7px",
            backgroundColor: "rgba(139, 92, 246, 0.15)",
            color: "var(--accent-purple)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: 11,
            opacity: state.compiled ? 1 : 0.4,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <span>Step δ</span>
        </button>

        <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

        <button
          onClick={() => engineBridge.reset()}
          title="Reset Simulation (t=0 ps)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2px 5px",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            borderRadius: "var(--radius-sm)",
            flexShrink: 0
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Right: Telemetry, Presets & Omnibar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, whiteSpace: "nowrap" }}>
        {/* Simulation Clock & Delta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            flexShrink: 0,
            whiteSpace: "nowrap"
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
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent-amber)", flexShrink: 0, whiteSpace: "nowrap" }}
            title="Peak Dynamic Current"
          >
            <Zap size={11} />
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{state.peakCurrentMa.toFixed(1)} mA</span>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent-rose)", flexShrink: 0, whiteSpace: "nowrap" }}
            title="Max Voltage Sag"
          >
            <Activity size={11} />
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>-{state.maxSagMv.toFixed(1)} mV</span>
          </div>

          {state.glitchCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                color: "var(--signal-glitch)",
                backgroundColor: "rgba(236, 72, 153, 0.12)",
                padding: "1px 5px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 10.5,
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
              title="Glitches Detected"
            >
              <Bug size={11} />
              <span>{state.glitchCount}</span>
            </div>
          )}
        </div>

        {/* Maximize Active Panel Restore Badge */}
        {project && maximizedPanel && onRestoreMaximizedPanel && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <button
              onClick={onRestoreMaximizedPanel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid var(--accent-blue)",
                color: "var(--accent-blue)",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              <Minimize2 size={11} />
              <span>Restore {maximizedPanel.toUpperCase()} (🗗)</span>
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
                title="Balanced Layout (42% Code / 58% Visuals)"
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 42) < 2 ? 700 : 500,
                  padding: "1px 5px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 42) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 42) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                }}
              >
                Balanced
              </button>
              <button
                onClick={() => onSetEditorWidthPercent(55)}
                title="Code Focus (55% Code / 45% Visuals)"
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 55) < 2 ? 700 : 500,
                  padding: "1px 5px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 55) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 55) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                }}
              >
                Code
              </button>
              <button
                onClick={() => onSetEditorWidthPercent(25)}
                title="Visualizer Focus (25% Code / 75% Visuals)"
                style={{
                  fontSize: 10.5,
                  fontWeight: Math.abs(editorWidthPercent - 25) < 2 ? 700 : 500,
                  padding: "1px 5px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: Math.abs(editorWidthPercent - 25) < 2 ? "var(--bg-elevated)" : "transparent",
                  color: Math.abs(editorWidthPercent - 25) < 2 ? "var(--accent-blue)" : "var(--text-muted)"
                }}
              >
                Visual
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

        {/* Omnibar & Command Palette */}
        {onOpenOmnibar && (
          <>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />
            <button
              onClick={onOpenOmnibar}
              title="Omnibar & Command Palette (Ctrl+K or Cmd+K)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease"
              }}
            >
              <Search size={11} color="var(--accent-blue)" />
              <span>Omnibar</span>
              <kbd
                style={{
                  fontSize: 9.5,
                  padding: "0 4px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 3,
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)"
                }}
              >
                ⌘K
              </kbd>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
