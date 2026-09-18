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
  Menu
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
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onCompile,
  project,
  onOpenNewProject,
  onCloseProject,
  isMobile = false,
  onToggleMobileDrawer,
  activeMobilePanel: _activeMobilePanel
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
          height: 48,
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
        height: 52,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        zIndex: 20
      }}
    >
      {/* Brand & Project Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <img
            src="/logo.svg"
            alt="Axiom Logo"
            style={{
              width: 24,
              height: 24,
              borderRadius: "var(--radius-sm)"
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            Axiom EDA
          </span>
          <span
            style={{
              fontSize: 11,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-muted)",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              whiteSpace: "nowrap"
            }}
          >
            v0.1.0-jit
          </span>
        </div>

        <div style={{ height: 18, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

        {/* Project Context & Controls */}
        {project ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.1)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                maxWidth: "clamp(100px, 14vw, 190px)",
                minWidth: 0,
                flexShrink: 1,
                overflow: "hidden"
              }}
              title={project.name}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {project.name}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
                ({project.targetDevice.split(" ")[0]})
              </span>
            </span>

            {/* Compile Button */}
            <button
              onClick={onCompile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                backgroundColor: state.compiled ? "var(--bg-tertiary)" : "var(--accent-blue)",
                color: state.compiled ? "var(--text-primary)" : "#fff",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${state.compiled ? "var(--border-subtle)" : "var(--accent-blue)"}`,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease"
              }}
            >
              <Cpu size={13} />
              <span>{state.compiled ? "Re-Compile JIT" : "Compile JIT"}</span>
            </button>

            {onCloseProject && (
              <button
                onClick={onCloseProject}
                title="Close active project and return to launchpad"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 9px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X size={13} />
                <span>Close</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", whiteSpace: "nowrap" }}>
              No Project Open
            </span>
            {onOpenNewProject && (
              <button
                onClick={onOpenNewProject}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  backgroundColor: "var(--accent-blue)",
                  color: "#fff",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                <FolderPlus size={14} />
                <span>New Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Execution Stepping Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap" }}>
        {state.isRunning ? (
          <button
            onClick={() => engineBridge.pause()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              backgroundColor: "var(--accent-rose)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 12.5,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Pause size={14} />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={() => engineBridge.play()}
            disabled={!state.compiled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              backgroundColor: state.compiled ? "var(--accent-emerald)" : "var(--bg-tertiary)",
              color: state.compiled ? "#fff" : "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: state.compiled ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            <Play size={14} />
            <span>Run Free</span>
          </button>
        )}

        <button
          onClick={() => engineBridge.tick(1000)}
          disabled={!state.compiled || state.isRunning}
          title="Advance simulation by 1 ns (Physical Time Step)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            fontSize: 12,
            opacity: state.compiled ? 1 : 0.5,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <FastForward size={13} />
          <span>+1 ns</span>
        </button>

        <button
          onClick={() => engineBridge.tick(100)}
          disabled={!state.compiled || state.isRunning}
          title="Advance simulation by 100 ps"
          style={{
            padding: "5px 10px",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            fontSize: 12,
            opacity: state.compiled ? 1 : 0.5,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          +100 ps
        </button>

        {/* Delta-Cycle Stepping */}
        <button
          onClick={() => engineBridge.stepDelta()}
          disabled={!state.compiled || state.isRunning}
          title="Step single discrete delta-cycle (δ-step) in zero simulation time"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            backgroundColor: "var(--accent-purple)",
            color: "#fff",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: 12,
            opacity: state.compiled ? 1 : 0.5,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <span>Step δ</span>
        </button>

        <button
          onClick={() => engineBridge.reset()}
          title="Reset Simulation"
          style={{
            padding: "5px 8px",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            flexShrink: 0
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Right Telemetry & Status Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0, whiteSpace: "nowrap" }}>
        {/* Time & Delta Display */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", flexShrink: 0, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent-cyan)", whiteSpace: "nowrap" }}>
              {formatTime(state.currentSimTimePs)}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              δ = {state.currentDeltaCycle}
            </span>
          </div>
        </div>

        <div style={{ height: 18, width: 1, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

        {/* Power / Voltage / Glitch status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, flexShrink: 0, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-amber)", flexShrink: 0, whiteSpace: "nowrap" }} title="Peak Dynamic Current">
            <Zap size={13} />
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{state.peakCurrentMa.toFixed(1)} mA</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-rose)", flexShrink: 0, whiteSpace: "nowrap" }} title="Max Voltage Sag">
            <Activity size={13} />
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>-{state.maxSagMv.toFixed(1)} mV</span>
          </div>

          {state.glitchCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "var(--signal-glitch)",
                backgroundColor: "rgba(236, 72, 153, 0.15)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: 11,
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
              title="Glitches Detected"
            >
              <Bug size={13} />
              <span>{state.glitchCount}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
