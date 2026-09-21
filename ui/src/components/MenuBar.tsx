import React, { useState, useEffect, useRef } from "react";
import {
  FolderPlus,
  FolderOpen,
  Save,
  CheckSquare,
  Square,
  PlusCircle,
  Download,
  XSquare,
  LogOut,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  Search,
  Maximize,
  Layout,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Cpu,
  Clock,
  Zap,
  Activity,
  Boxes,
  Sliders,
  Gauge,
  HelpCircle,
  RefreshCw,
  Info,
  ExternalLink,
  Layers,
  Sparkles,
  Box,
  GitCompare
} from "lucide-react";
import { isAutoSaveEnabled, setAutoSaveEnabled, subscribeAutoSave } from "../engine/autoSaveManager";
import { isDesktop, closeWindow, toggleBrowserFullscreen } from "../engine/platform";

export interface MenuBarProps {
  onOpenNewProject: () => void;
  onOpenProjectFile: () => void;
  onCloseProject: () => void;
  onSaveFile: () => void;
  onSaveAll: () => void;
  onAddSources: () => void;
  onExportProjectJson: () => void;
  onToggleSidebar: () => void;
  onToggleBottomDock: () => void;
  onSwitchVisualizer: (view: "schematic" | "microarch" | "virtuallab" | "waveform" | "timing" | "multidie" | "ppa" | "package") => void;
  onRunSimulation: () => void;
  onPauseSimulation: () => void;
  onStep1ns: () => void;
  onStep100ps: () => void;
  onStepDelta: () => void;
  onResetSimulation: () => void;
  onCompile: () => void;
  onOpenAutoPipeline: () => void;
  onOpenProtocolDecoder: () => void;
  onOpenOmnibar: () => void;
  onCheckForUpdates: () => void;
  onOpenAbout: () => void;
  hasActiveProject: boolean;
  isSimRunning: boolean;
}

type MenuKey = "file" | "edit" | "view" | "flow" | "tools" | "help" | null;

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenNewProject,
  onOpenProjectFile,
  onCloseProject,
  onSaveFile,
  onSaveAll,
  onAddSources,
  onExportProjectJson,
  onToggleSidebar,
  onToggleBottomDock,
  onSwitchVisualizer,
  onRunSimulation,
  onPauseSimulation,
  onStep1ns,
  onStep100ps,
  onStepDelta,
  onResetSimulation,
  onCompile,
  onOpenAutoPipeline,
  onOpenProtocolDecoder,
  onOpenOmnibar,
  onCheckForUpdates,
  onOpenAbout,
  hasActiveProject,
  isSimRunning
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const [autoSave, setAutoSave] = useState<boolean>(() => isAutoSaveEnabled());
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Sync AutoSave changes
  useEffect(() => {
    return subscribeAutoSave((val) => setAutoSave(val));
  }, []);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    setAutoSaveEnabled(next);
    setActiveMenu(null);
  };

  const handleMenuClick = (key: MenuKey) => {
    setActiveMenu((prev) => (prev === key ? null : key));
  };

  const handleMenuHover = (key: MenuKey) => {
    if (activeMenu !== null && activeMenu !== key) {
      setActiveMenu(key);
    }
  };

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "6px 12px",
    fontSize: 12,
    color: "var(--text-primary)",
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
    userSelect: "none",
    whiteSpace: "nowrap",
    flexShrink: 0
  };

  const shortcutStyle: React.CSSProperties = {
    fontSize: 10.5,
    color: "var(--text-muted)",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginLeft: 12
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    backgroundColor: "var(--border-subtle)",
    margin: "4px 0"
  };

  const dropdownContainerStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    minWidth: 230,
    width: "max-content",
    maxWidth: "calc(100vw - 32px)",
    whiteSpace: "nowrap",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
    padding: 4,
    zIndex: 100
  };

  return (
    <div
      ref={menuBarRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: 28,
        fontSize: 12,
        position: "relative"
      }}
    >
      {/* FILE MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("file")}
          onMouseEnter={() => handleMenuHover("file")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "file" ? 600 : 400,
            backgroundColor: activeMenu === "file" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          File
        </button>

        {activeMenu === "file" && (
          <div style={dropdownContainerStyle}>
            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenNewProject();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderPlus size={13} color="var(--accent-blue)" />
                <span>New Project...</span>
              </div>
              <span style={shortcutStyle}>Ctrl+Shift+N</span>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenProjectFile();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderOpen size={13} color="var(--accent-cyan)" />
                <span>Open Project (.json)...</span>
              </div>
              <span style={shortcutStyle}>Ctrl+O</span>
            </div>

            {hasActiveProject && (
              <div
                style={menuItemStyle}
                className="menu-item-hover"
                onClick={() => {
                  onCloseProject();
                  setActiveMenu(null);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <XSquare size={13} color="var(--accent-rose)" />
                  <span>Close Project</span>
                </div>
              </div>
            )}

            <div style={dividerStyle} />

            <div
              style={{ ...menuItemStyle, opacity: hasActiveProject ? 1 : 0.5 }}
              className={hasActiveProject ? "menu-item-hover" : undefined}
              onClick={() => {
                if (hasActiveProject) {
                  onSaveFile();
                  setActiveMenu(null);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Save size={13} color="var(--accent-emerald)" />
                <span>Save File</span>
              </div>
              <span style={shortcutStyle}>Ctrl+S</span>
            </div>

            <div
              style={{ ...menuItemStyle, opacity: hasActiveProject ? 1 : 0.5 }}
              className={hasActiveProject ? "menu-item-hover" : undefined}
              onClick={() => {
                if (hasActiveProject) {
                  onSaveAll();
                  setActiveMenu(null);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Save size={13} color="var(--accent-emerald)" />
                <span>Save All</span>
              </div>
              <span style={shortcutStyle}>Ctrl+Shift+S</span>
            </div>

            {/* AUTO SAVE TOGGLE (Checked by default) */}
            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={handleToggleAutoSave}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {autoSave ? (
                  <CheckSquare size={13} color="var(--accent-blue)" />
                ) : (
                  <Square size={13} color="var(--text-muted)" />
                )}
                <span style={{ fontWeight: autoSave ? 600 : 400 }}>Auto Save</span>
              </div>
              <span style={{ fontSize: 10.5, color: autoSave ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                {autoSave ? "ON" : "OFF"}
              </span>
            </div>

            <div style={dividerStyle} />

            <div
              style={{ ...menuItemStyle, opacity: hasActiveProject ? 1 : 0.5 }}
              className={hasActiveProject ? "menu-item-hover" : undefined}
              onClick={() => {
                if (hasActiveProject) {
                  onAddSources();
                  setActiveMenu(null);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PlusCircle size={13} color="var(--accent-purple)" />
                <span>Add Sources...</span>
              </div>
              <span style={shortcutStyle}>Ctrl+A</span>
            </div>

            <div
              style={{ ...menuItemStyle, opacity: hasActiveProject ? 1 : 0.5 }}
              className={hasActiveProject ? "menu-item-hover" : undefined}
              onClick={() => {
                if (hasActiveProject) {
                  onExportProjectJson();
                  setActiveMenu(null);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Download size={13} color="var(--text-secondary)" />
                <span>Export Project Bundle</span>
              </div>
            </div>

            {isDesktop() && (
              <>
                <div style={dividerStyle} />
                <div
                  style={menuItemStyle}
                  className="menu-item-hover"
                  onClick={() => {
                    closeWindow();
                    setActiveMenu(null);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <LogOut size={13} color="var(--accent-rose)" />
                    <span>Exit</span>
                  </div>
                  <span style={shortcutStyle}>Alt+F4</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* EDIT MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("edit")}
          onMouseEnter={() => handleMenuHover("edit")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "edit" ? 600 : 400,
            backgroundColor: activeMenu === "edit" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          Edit
        </button>

        {activeMenu === "edit" && (
          <div style={dropdownContainerStyle}>
            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Undo2 size={13} />
                <span>Undo</span>
              </div>
              <span style={shortcutStyle}>Ctrl+Z</span>
            </div>

            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Redo2 size={13} />
                <span>Redo</span>
              </div>
              <span style={shortcutStyle}>Ctrl+Y</span>
            </div>

            <div style={dividerStyle} />

            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Scissors size={13} />
                <span>Cut</span>
              </div>
              <span style={shortcutStyle}>Ctrl+X</span>
            </div>

            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Copy size={13} />
                <span>Copy</span>
              </div>
              <span style={shortcutStyle}>Ctrl+C</span>
            </div>

            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clipboard size={13} />
                <span>Paste</span>
              </div>
              <span style={shortcutStyle}>Ctrl+V</span>
            </div>

            <div style={dividerStyle} />

            <div style={menuItemStyle} className="menu-item-hover" onClick={() => setActiveMenu(null)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={13} />
                <span>Find in File</span>
              </div>
              <span style={shortcutStyle}>Ctrl+F</span>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("view")}
          onMouseEnter={() => handleMenuHover("view")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "view" ? 600 : 400,
            backgroundColor: activeMenu === "view" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          View
        </button>

        {activeMenu === "view" && (
          <div style={dropdownContainerStyle}>
            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onToggleSidebar();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layout size={13} />
                <span>Toggle Left Sidebar</span>
              </div>
              <span style={shortcutStyle}>Ctrl+B</span>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onToggleBottomDock();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layout size={13} />
                <span>Toggle Bottom Dock</span>
              </div>
              <span style={shortcutStyle}>Ctrl+J</span>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                toggleBrowserFullscreen();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Maximize size={13} />
                <span>Toggle Fullscreen</span>
              </div>
              <span style={shortcutStyle}>F11</span>
            </div>

            <div style={dividerStyle} />

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("schematic");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={13} color="var(--accent-cyan)" />
                <span>Schematic DAG</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("package");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Box size={13} color="var(--accent-cyan)" />
                <span>Package & Floorplan</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("microarch");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Boxes size={13} color="var(--accent-purple)" />
                <span>Architecture Diagram</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("virtuallab");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sliders size={13} color="var(--accent-amber)" />
                <span>Virtual Lab Rack</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("waveform");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={13} color="var(--accent-blue)" />
                <span>Waveform Scope</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("timing");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={13} color="var(--accent-rose)" />
                <span>Timing Radar & Slack</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("multidie");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={13} color="var(--accent-cyan)" />
                <span>Multi-Die / Chiplet</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("ppa");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Gauge size={13} color="var(--accent-purple)" />
                <span>PPA & Silicon Costs</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOW MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("flow")}
          onMouseEnter={() => handleMenuHover("flow")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "flow" ? 600 : 400,
            backgroundColor: activeMenu === "flow" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          Flow
        </button>

        {activeMenu === "flow" && (
          <div style={dropdownContainerStyle}>
            {isSimRunning ? (
              <div
                style={menuItemStyle}
                className="menu-item-hover"
                onClick={() => {
                  onPauseSimulation();
                  setActiveMenu(null);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Pause size={13} color="var(--accent-rose)" />
                  <span>Pause Simulation</span>
                </div>
                <span style={shortcutStyle}>F6</span>
              </div>
            ) : (
              <div
                style={menuItemStyle}
                className="menu-item-hover"
                onClick={() => {
                  onRunSimulation();
                  setActiveMenu(null);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Play size={13} color="var(--accent-emerald)" />
                  <span>Run Simulation</span>
                </div>
                <span style={shortcutStyle}>F5</span>
              </div>
            )}

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onStep1ns();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FastForward size={13} />
                <span>Step +1 ns</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onStep100ps();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FastForward size={13} />
                <span>Step +100 ps</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onStepDelta();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FastForward size={13} color="var(--accent-amber)" />
                <span>Step Delta Cycle (δ)</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onResetSimulation();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={13} />
                <span>Reset Simulation to t=0</span>
              </div>
            </div>

            <div style={dividerStyle} />

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onCompile();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={13} color="var(--accent-blue)" />
                <span>Compile / Elaborate Design</span>
              </div>
              <span style={shortcutStyle}>Ctrl+Enter</span>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenAutoPipeline();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={13} color="var(--accent-amber)" />
                <span>Silicon Copilot (Auto-Pipelining)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOOLS MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("tools")}
          onMouseEnter={() => handleMenuHover("tools")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "tools" ? 600 : 400,
            backgroundColor: activeMenu === "tools" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          Tools
        </button>

        {activeMenu === "tools" && (
          <div style={dropdownContainerStyle}>
            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenProtocolDecoder();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={13} color="var(--accent-cyan)" />
                <span>Protocol Packet Decoder (AXI/SPI/I2C/UART)...</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("waveform");
                window.dispatchEvent(new CustomEvent("axiom_open_vcd_import"));
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GitCompare size={13} color="var(--accent-cyan)" />
                <span>Golden VCD Waveform Diffing...</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("multidie");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={13} color="var(--accent-purple)" />
                <span>Multi-Die / Chiplet Partitioning...</span>
              </div>
            </div>

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onSwitchVisualizer("ppa");
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Gauge size={13} color="var(--accent-emerald)" />
                <span>PPA Pareto & ASIC Cost Forecaster...</span>
              </div>
            </div>

            <div style={dividerStyle} />

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenOmnibar();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={13} color="var(--accent-blue)" />
                <span>Command Palette & Symbol Finder...</span>
              </div>
              <span style={shortcutStyle}>Ctrl+K</span>
            </div>
          </div>
        )}
      </div>

      {/* HELP MENU */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => handleMenuClick("help")}
          onMouseEnter={() => handleMenuHover("help")}
          className="btn btn-ghost"
          style={{
            height: 24,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: activeMenu === "help" ? 600 : 400,
            backgroundColor: activeMenu === "help" ? "var(--bg-tertiary)" : "transparent"
          }}
        >
          Help
        </button>

        {activeMenu === "help" && (
          <div style={dropdownContainerStyle}>
            <a
              href="https://axiom.aerovex.net"
              target="_blank"
              rel="noreferrer"
              style={{ ...menuItemStyle, textDecoration: "none" }}
              className="menu-item-hover"
              onClick={() => setActiveMenu(null)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={13} color="var(--accent-cyan)" />
                <span>Axiom Documentation</span>
              </div>
              <ExternalLink size={12} color="var(--text-muted)" />
            </a>

            <a
              href="https://github.com/aerovexsim/axiom"
              target="_blank"
              rel="noreferrer"
              style={{ ...menuItemStyle, textDecoration: "none" }}
              className="menu-item-hover"
              onClick={() => setActiveMenu(null)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ExternalLink size={13} color="var(--accent-blue)" />
                <span>GitHub Repository</span>
              </div>
            </a>

            {isDesktop() && (
              <>
                <div style={dividerStyle} />
                <div
                  style={menuItemStyle}
                  className="menu-item-hover"
                  onClick={() => {
                    onCheckForUpdates();
                    setActiveMenu(null);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RefreshCw size={13} color="var(--accent-emerald)" />
                    <span>Check for Updates...</span>
                  </div>
                </div>
              </>
            )}

            <div style={dividerStyle} />

            <div
              style={menuItemStyle}
              className="menu-item-hover"
              onClick={() => {
                onOpenAbout();
                setActiveMenu(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Info size={13} color="var(--text-secondary)" />
                <span>About Axiom EDA Studio</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
