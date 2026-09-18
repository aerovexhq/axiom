import React from "react";
import { Play, Pause, FastForward, RotateCcw, Cpu, Zap, Activity, Bug, FolderPlus, X } from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { AxiomProject } from "../engine/projectModel";

interface HeaderProps {
  state: SimulationState;
  onCompile: () => void;
  project?: AxiomProject | null;
  onOpenNewProject?: () => void;
  onCloseProject?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onCompile,
  project,
  onOpenNewProject,
  onCloseProject
}) => {
  const formatTime = (timePs: number) => {
    if (timePs >= 1_000_000) {
      return `${(timePs / 1_000_000).toFixed(3)} μs`;
    } else if (timePs >= 1_000) {
      return `${(timePs / 1_000).toFixed(3)} ns`;
    } else {
      return `${timePs} ps`;
    }
  };

  return (
    <header
      style={{
        height: 48,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        zIndex: 20
      }}
    >
      {/* Brand & Project Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/logo.svg"
            alt="Axiom Logo"
            style={{
              width: 24,
              height: 24,
              borderRadius: "var(--radius-sm)"
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em" }}>
            Axiom EDA
          </span>
          <span
            style={{
              fontSize: 11,
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-muted)",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)"
            }}
          >
            v0.1.0-jit
          </span>
        </div>

        <div style={{ height: 18, width: 1, backgroundColor: "var(--border-subtle)" }} />

        {/* Project Context & Controls */}
        {project ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.1)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <span>{project.name}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>({project.targetDevice.split(" ")[0]})</span>
            </span>

            {/* Compile Button */}
            <button
              onClick={onCompile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                backgroundColor: state.compiled ? "var(--bg-tertiary)" : "var(--accent-blue)",
                color: state.compiled ? "var(--text-primary)" : "#fff",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${state.compiled ? "var(--border-subtle)" : "var(--accent-blue)"}`,
                fontWeight: 500,
                fontSize: 11,
                cursor: "pointer",
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
                  gap: 3,
                  padding: "4px 8px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 11,
                  cursor: "pointer"
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
              No Project Open
            </span>
            {onOpenNewProject && (
              <button
                onClick={onOpenNewProject}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  backgroundColor: "var(--accent-blue)",
                  color: "#fff",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                <FolderPlus size={13} />
                <span>New Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Execution Stepping Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {state.isRunning ? (
          <button
            onClick={() => engineBridge.pause()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              backgroundColor: "var(--accent-rose)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 12
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
              gap: 6,
              padding: "5px 12px",
              backgroundColor: state.compiled ? "var(--accent-emerald)" : "var(--bg-tertiary)",
              color: state.compiled ? "#fff" : "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: 12,
              cursor: state.compiled ? "pointer" : "not-allowed"
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
            opacity: state.compiled ? 1 : 0.5
          }}
        >
          <FastForward size={14} />
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
            opacity: state.compiled ? 1 : 0.5
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
            opacity: state.compiled ? 1 : 0.5
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
            border: "1px solid var(--border-subtle)"
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Right Telemetry & Status Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Time & Delta Display */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)" }}>
              {formatTime(state.currentSimTimePs)}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              δ = {state.currentDeltaCycle}
            </span>
          </div>
        </div>

        <div style={{ height: 18, width: 1, backgroundColor: "var(--border-subtle)" }} />

        {/* Power / Voltage / Glitch status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-amber)" }} title="Peak Dynamic Current">
            <Zap size={13} />
            <span style={{ fontFamily: "var(--font-mono)" }}>{state.peakCurrentMa.toFixed(1)} mA</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-rose)" }} title="Max Voltage Sag">
            <Activity size={13} />
            <span style={{ fontFamily: "var(--font-mono)" }}>-{state.maxSagMv.toFixed(1)} mV</span>
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
                fontWeight: 600
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
