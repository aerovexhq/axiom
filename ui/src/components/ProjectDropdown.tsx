// Axiom EDA — Professional Project Identity & Header Menu
import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  ChevronDown,
  Save,
  Download,
  FilePlus,
  FolderPlus,
  X,
  Cpu,
  Check
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { useTranslation } from "../i18n";

interface ProjectDropdownProps {
  project: AxiomProject;
  onCloseProject: () => void;
  onOpenNewProject: () => void;
  onOpenAddSource: () => void;
  onExportProjectJson: () => void;
  onSaveProject: () => void;
  isSaved?: boolean;
}

export const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  project,
  onCloseProject,
  onOpenNewProject,
  onOpenAddSource,
  onExportProjectJson,
  onSaveProject,
  isSaved = true
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const targetFamily = project.targetDevice.split(" ")[0] || "FPGA";

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Clickable Badge Trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="badge badge-cyan"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 9px",
          fontSize: 11.5,
          cursor: "pointer",
          border: isOpen ? "1px solid var(--accent-cyan)" : "1px solid rgba(6, 182, 212, 0.35)",
          backgroundColor: isOpen ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.12)",
          transition: "all 0.15s ease",
          maxWidth: "clamp(120px, 16vw, 210px)"
        }}
        title={`${project.name} (${project.targetDevice}) — Click for Project Menu`}
      >
        <Folder size={12} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, flex: 1, minWidth: 0 }}>
          {project.name}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10, flexShrink: 0, whiteSpace: "nowrap" }}>
          ({targetFamily})
        </span>
        <ChevronDown
          size={11}
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease"
          }}
        />
      </button>

      {/* Sleek Dark Acrylic Popover Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 260,
            width: "max-content",
            maxWidth: "calc(100vw - 32px)",
            whiteSpace: "nowrap",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            zIndex: 100,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "dropdown-pop 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          {/* Project Details Header Card */}
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--bg-primary)",
              borderBottom: "1px solid var(--border-subtle)",
              whiteSpace: "nowrap"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 3, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                {project.name}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  padding: "1px 5px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isSaved ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: isSaved ? "var(--accent-emerald)" : "var(--accent-amber)",
                  border: `1px solid ${isSaved ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                {isSaved ? <Check size={9} /> : null}
                {isSaved ? "Saved" : "Modified"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap" }}>
              <Cpu size={11} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.targetDevice}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>[TOP]</span>
                <span className="mono-num" style={{ color: "var(--text-secondary)" }}>{project.topModule}</span>
              </span>
              <span>•</span>
              <span style={{ whiteSpace: "nowrap" }}>{project.files.length} files</span>
            </div>
          </div>

          {/* Menu Actions Section */}
          <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}>
            <button
              onClick={() => {
                onSaveProject();
                setIsOpen(false);
              }}
              className="axiom-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                whiteSpace: "nowrap",
                transition: "background 0.1s ease, color 0.1s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
                <Save size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap" }}>Save Project</span>
              </div>
              <span className="mono-num" style={{ fontSize: 10, color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: 3, marginLeft: 16, flexShrink: 0, whiteSpace: "nowrap" }}>
                Ctrl+S
              </span>
            </button>

            <button
              onClick={() => {
                onExportProjectJson();
                setIsOpen(false);
              }}
              className="axiom-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                whiteSpace: "nowrap",
                transition: "background 0.1s ease, color 0.1s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
                <Download size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap" }}>Export Project Bundle</span>
              </div>
              <span className="mono-num" style={{ fontSize: 10, color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: 3, marginLeft: 16, flexShrink: 0, whiteSpace: "nowrap" }}>
                .json
              </span>
            </button>

            <button
              onClick={() => {
                onOpenAddSource();
                setIsOpen(false);
              }}
              className="axiom-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                whiteSpace: "nowrap",
                transition: "background 0.1s ease, color 0.1s ease"
              }}
            >
              <FilePlus size={13} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>Add Source to Project...</span>
            </button>

            <button
              onClick={() => {
                onOpenNewProject();
                setIsOpen(false);
              }}
              className="axiom-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                whiteSpace: "nowrap",
                transition: "background 0.1s ease, color 0.1s ease"
              }}
            >
              <FolderPlus size={13} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>{t("header.newProject")}...</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: "var(--border-subtle)", margin: "2px 0" }} />

          {/* Exit Action: Close Project & Move to Trash */}
          <div style={{ padding: "4px 0", whiteSpace: "nowrap" }}>
            <button
              onClick={() => {
                setIsOpen(false);
                onCloseProject();
              }}
              className="axiom-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                whiteSpace: "nowrap",
                transition: "background 0.1s ease, color 0.1s ease"
              }}
            >
              <X size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>{t("header.closeProject")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
