import React from "react";
import {
  X,
  Cpu,
    Activity,
  Sliders,
  Clock,
  Terminal,
  FileCode,
  FileText,
  Plus,
  FolderPlus,
  LogOut,
  ChevronRight,
  Play,
  Pause,
  FastForward,
  RotateCcw,
    } from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { Badge, Button } from "./ui";
import { useTranslation } from "../i18n/i18nContext";

export type MobilePanelType = "editor" | "schematic" | "virtuallab" | "waveform" | "timing" | "dock";

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: AxiomProject | null;
  activePanel: MobilePanelType;
  onSelectPanel: (panel: MobilePanelType) => void;
  state: SimulationState;
  onCompile: () => void;
  onOpenNewProject: () => void;
  onOpenAddSource: () => void;
  onCloseProject?: () => void;
  onSelectFile?: (fileId: string) => void;
  onSelectTemplate?: (templateId: string) => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  project,
  activePanel,
  onSelectPanel,
  state,
  onCompile: _onCompile,
  onOpenNewProject,
  onOpenAddSource,
  onCloseProject,
  onSelectFile,
  onSelectTemplate: _onSelectTemplate
}) => {
  const { t } = useTranslation();

  const formatTime = (timePs: number) => {
    if (timePs >= 1_000_000) {
      return `${(timePs / 1_000_000).toFixed(3)} μs`;
    } else if (timePs >= 1_000) {
      return `${(timePs / 1_000).toFixed(3)} ns`;
    } else {
      return `${timePs} ps`;
    }
  };

  const panels: Array<{
    id: MobilePanelType;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: "editor",
      label: t.mobile.code,
      sublabel: project ? (project.files.find((f) => f.id === project.activeFileId)?.name ?? "Verilog RTL") : "Verilog Editor",
      icon: <FileCode size={18} />,
      color: "var(--accent-blue)"
    },
    {
      id: "schematic",
      label: t.mobile.schematic,
      sublabel: "IEEE gate symbols & netlist",
      icon: <Cpu size={18} />,
      color: "var(--accent-cyan)"
    },
    {
      id: "virtuallab",
      label: t.mobile.lab,
      sublabel: "Switches, LEDs, probes",
      icon: <Sliders size={18} />,
      color: "var(--accent-amber)"
    },
    {
      id: "waveform",
      label: t.mobile.waves,
      sublabel: "Digital multi-radix timeline",
      icon: <Activity size={18} />,
      color: "var(--accent-blue)"
    },
    {
      id: "timing",
      label: t.mobile.timing,
      sublabel: "Slack radar & dynamic power",
      icon: <Clock size={18} />,
      color: "var(--accent-purple)"
    },
    {
      id: "dock",
      label: t.mobile.console,
      sublabel: "Interactive REPL & linter",
      icon: <Terminal size={18} />,
      color: "var(--accent-emerald)"
    }
  ];

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          zIndex: 998,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease"
        }}
      />

      {/* Off-Canvas Drawer Sliding from Left */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: "min(320px, 86vw)",
          backgroundColor: "#11151c",
          borderRight: "1px solid var(--border-subtle)",
          boxShadow: "10px 0 35px rgba(0, 0, 0, 0.8)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          fontFamily: "var(--font-sans)",
          overflowY: "auto",
          userSelect: "none"
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-primary)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/logo.svg"
              alt="Axiom Logo"
              style={{ width: 26, height: 26, borderRadius: "var(--radius-sm)" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: "-0.02em" }}>
                {t.mobile.studioTitle}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>
                {t.mobile.mobileSubtitle}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{
              padding: 6,
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              width: 30,
              height: 30
            }}
            title={t.mobile.closeMenu}
          >
            <X size={18} />
          </button>
        </div>

        {/* Studio Panel Switcher Section (View a panel at once) */}
        <div style={{ padding: "16px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
              paddingLeft: 4
            }}
          >
            {t.mobile.panelsTitle}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {panels.map((p) => {
              const isActive = activePanel === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPanel(p.id);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: isActive ? "rgba(59, 130, 246, 0.15)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(59, 130, 246, 0.4)" : "transparent"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                    <span style={{ color: isActive ? "var(--accent-blue)" : p.color, display: "flex" }}>
                      {p.icon}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "#fff" : "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {p.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {p.sublabel}
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={14} color={isActive ? "var(--accent-blue)" : "var(--text-muted)"} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Vivado Project Manager Section */}
        <div style={{ padding: "16px 14px", flex: 1, borderBottom: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
              paddingLeft: 4
            }}
          >
            {t.mobile.projectFilesTitle}
          </div>

          {project ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Project Card */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {project.name}
                  </span>
                  <Badge color="cyan" size="sm">
                    {project.targetDevice.split(" ")[0]}
                  </Badge>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Top: <strong style={{ color: "var(--accent-amber)" }}>{project.topModule}</strong>
                </div>
              </div>

              {/* Action Buttons: Add Source & New Project */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    onOpenAddSource();
                    onClose();
                  }}
                  icon={<Plus size={12} />}
                >
                  {t.mobile.addSource}
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    onOpenNewProject();
                    onClose();
                  }}
                  icon={<FolderPlus size={12} />}
                >
                  {t.mobile.newProject}
                </Button>
              </div>

              {/* Project File Sets */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {project.files.map((file) => {
                  const isActive = file.id === project.activeFileId;
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        onSelectFile?.(file.id);
                        onSelectPanel("editor");
                        onClose();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 10px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: isActive ? "rgba(59, 130, 246, 0.12)" : "transparent",
                        border: `1px solid ${isActive ? "rgba(59, 130, 246, 0.3)" : "transparent"}`,
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                        {file.fileType === "xdc" ? (
                          <FileText size={14} color="var(--accent-purple)" />
                        ) : (
                          <FileCode size={14} color={file.isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} />
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            color: isActive ? "#fff" : "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                      {file.isTop && (
                        <Badge color="cyan" size="sm">
                          TOP
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {onCloseProject && (
                <div style={{ marginTop: 6 }}>
                  <Button
                    variant="danger"
                    size="xs"
                    fullWidth
                    onClick={() => {
                      onCloseProject();
                      onClose();
                    }}
                    icon={<LogOut size={12} />}
                  >
                    {t.mobile.closeProject}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "16px 12px",
                textAlign: "center",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-subtle)"
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {t.mobile.noProjectOpen}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                {t.mobile.noProjectDesc}
              </div>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => {
                  onOpenNewProject();
                  onClose();
                }}
                icon={<FolderPlus size={13} />}
              >
                {t.mobile.newProject}
              </Button>
            </div>
          )}
        </div>

        {/* Quick Simulation & Telemetry Strip */}
        <div style={{ padding: "14px 16px", backgroundColor: "var(--bg-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              {t.mobile.simClock}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
              {formatTime(state.currentSimTimePs)}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <Button
              variant={state.isRunning ? "danger" : "primary"}
              size="xs"
              onClick={() => (state.isRunning ? engineBridge.pause() : engineBridge.play())}
              icon={state.isRunning ? <Pause size={12} /> : <Play size={12} fill="#fff" />}
            >
              {state.isRunning ? t.mobile.pause : t.mobile.run}
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => engineBridge.tick(1000)}
              icon={<FastForward size={12} />}
            >
              +1ns
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => engineBridge.reset()}
              icon={<RotateCcw size={12} />}
            >
              {t.mobile.reset}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
