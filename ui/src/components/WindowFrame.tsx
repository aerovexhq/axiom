import React, { useState, useEffect } from "react";
import { Minus, Square, X, Maximize, Search } from "lucide-react";
import { MenuBar, MenuBarProps } from "./MenuBar";
import { LanguageDropdown } from "./LanguageDropdown";
import {
  isDesktop,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  toggleBrowserFullscreen
} from "../engine/platform";
import { isAutoSaveEnabled, subscribeAutoSave, subscribeSaveState } from "../engine/autoSaveManager";
import { AxiomProject } from "../engine/projectModel";

export interface WindowFrameProps extends Omit<MenuBarProps, "hasActiveProject" | "isSimRunning"> {
  project?: AxiomProject | null;
  isSimRunning: boolean;
  isSaved?: boolean;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  project,
  isSimRunning,
  isSaved: initialIsSaved = true,
  ...menuProps
}) => {
  const [autoSave, setAutoSave] = useState<boolean>(() => isAutoSaveEnabled());
  const [isSaved, setIsSaved] = useState<boolean>(initialIsSaved);
  const isDesktopApp = isDesktop();

  useEffect(() => {
    const unsubAutoSave = subscribeAutoSave((val) => setAutoSave(val));
    const unsubSaveState = subscribeSaveState((val) => setIsSaved(val));
    return () => {
      unsubAutoSave();
      unsubSaveState();
    };
  }, []);

  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 32,
        minHeight: 32,
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        userSelect: "none",
        zIndex: 50,
        flexShrink: 0
      }}
    >
      {/* Left: Brand Icon + Title + MenuBar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
        <div
          data-tauri-drag-region
          style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <img
            src="/logo.svg"
            alt="Axiom Logo"
            style={{ width: 16, height: 16, borderRadius: "var(--radius-sm)" }}
          />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Axiom
          </span>
        </div>

        <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

        {/* Top Application MenuBar */}
        <MenuBar
          {...menuProps}
          hasActiveProject={!!project}
          isSimRunning={isSimRunning}
        />
      </div>

      {/* Center: Draggable Window Region & Project Identity */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          cursor: "default",
          padding: "0 12px"
        }}
      >
        {project ? (
          <div
            data-tauri-drag-region
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {project.name}
            </span>
            <span style={{ color: "var(--text-muted)" }}>—</span>
            <span className="mono-num" style={{ color: "var(--accent-cyan)", fontSize: 11 }}>
              [{project.targetDevice}]
            </span>
          </div>
        ) : (
          <span
            data-tauri-drag-region
            style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.02em" }}
          >
            Axiom EDA Studio
          </span>
        )}
      </div>

      {/* Right: Search + Auto-Save Status Pill + Language Dropdown + Window Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {/* Global Command Palette (Ctrl+K) Trigger */}
        {menuProps.onOpenOmnibar && (
          <button
            onClick={menuProps.onOpenOmnibar}
            title="Open Command Palette (Ctrl+K)"
            className="btn btn-ghost"
            style={{
              height: 22,
              padding: "0 7px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-tertiary)",
              cursor: "pointer"
            }}
          >
            <Search size={11} color="var(--accent-blue)" />
            <span>Search</span>
            <kbd style={{ fontSize: 9, opacity: 0.7, padding: "1px 4px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Auto Save Status Indicator (shown when project is active) */}
        {project && (
          <div
            title={
              autoSave
                ? `Auto-Save is active (${isSaved ? "Saved" : "Saving changes..."})`
                : "Auto-Save is disabled (Ctrl+S to save)"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              color: autoSave ? "var(--text-secondary)" : "var(--text-muted)"
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: autoSave
                  ? isSaved
                    ? "var(--accent-emerald)"
                    : "var(--accent-amber)"
                  : "var(--text-muted)"
              }}
            />
            <span>Auto-Save: {autoSave ? (isSaved ? "ON" : "Saving...") : "OFF"}</span>
          </div>
        )}

        {/* Global Language Selector */}
        <div style={{ margin: "0 4px", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          <LanguageDropdown
            align="right"
            buttonStyle={{
              height: 22,
              padding: "0 8px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
          />
        </div>

        <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />

        {/* Window Controls: Desktop Minimize/Maximize/Close vs Web Fullscreen */}
        {isDesktopApp ? (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              onClick={() => minimizeWindow()}
              title="Minimize"
              className="btn btn-ghost btn-icon"
              style={{ width: 24, height: 24, padding: 0 }}
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => toggleMaximizeWindow()}
              title="Maximize / Restore"
              className="btn btn-ghost btn-icon"
              style={{ width: 24, height: 24, padding: 0 }}
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => closeWindow()}
              title="Close"
              className="btn btn-ghost btn-icon"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                color: "var(--text-secondary)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(244, 63, 94, 0.2)";
                e.currentTarget.style.color = "var(--accent-rose)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => toggleBrowserFullscreen()}
            title="Toggle Fullscreen (F11)"
            className="btn btn-ghost btn-icon"
            style={{ width: 24, height: 24, padding: 0 }}
          >
            <Maximize size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
