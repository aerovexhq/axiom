import React, { useRef, useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  RotateCcw,
  Sparkles,
  Upload,
  Cpu,
  Zap,
  Clock,
  ShieldCheck,
  ChevronRight,
  Code2,
  Binary,
  Radio,
  Sliders,
  Activity,
  Box
} from "lucide-react";
import { PROJECT_TEMPLATES, ProjectTemplate } from "../engine/projectModel";
import { ProjectMetadata } from "../engine/projectRegistry";
import { useTranslation } from "../i18n";

interface WelcomeLaunchpadProps {
  onOpenNewProject: (templateId?: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onImportProjectJson: (jsonStr: string) => void;
  projects?: ProjectMetadata[];
  onOpenProject?: (projectId: string) => void;
  onTrashProject?: (projectId: string) => void;
  onRestoreProject?: (projectId: string) => void;
  onPermanentDeleteProject?: (projectId: string) => void;
  onEmptyTrash?: () => void;
}

export const WelcomeLaunchpad: React.FC<WelcomeLaunchpadProps> = ({
  onOpenNewProject,
  onSelectTemplate: _onSelectTemplate,
  onImportProjectJson,
  projects = [],
  onOpenProject,
  onTrashProject,
  onRestoreProject,
  onPermanentDeleteProject,
  onEmptyTrash
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [projectsTab, setProjectsTab] = useState<"active" | "trash">("active");

  const activeProjects = projects.filter((p) => !p.isTrashed);
  const trashedProjects = projects.filter((p) => p.isTrashed);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        onImportProjectJson(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getTemplateIcon = (id: string) => {
    switch (id) {
      case "logic_circuit_project":
        return <Zap size={20} color="var(--accent-emerald)" />;
      case "riscv_soc_project":
        return <Cpu size={20} color="var(--accent-cyan)" />;
      case "uart_project":
        return <Radio size={20} color="var(--accent-blue)" />;
      case "spi_project":
        return <Binary size={20} color="var(--accent-purple)" />;
      case "pwm_project":
        return <Sliders size={20} color="var(--accent-amber)" />;
      case "alu_project":
        return <Code2 size={20} color="var(--accent-emerald)" />;
      case "counter_project":
        return <Activity size={20} color="var(--accent-rose)" />;
      default:
        return <Box size={20} color="var(--text-muted)" />;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        overflowY: "auto",
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "44px 24px"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileInput}
      />

      {/* Hero Header */}
      <div style={{ maxWidth: 840, width: "100%", textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(6, 182, 212, 0.1)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 24px rgba(6, 182, 212, 0.2)",
              padding: 6
            }}
          >
            <img src="/logo.svg" alt="Axiom Logo" style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                {t("launchpad.heroTitle")}
              </h1>
              <span
                className="mono-num"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--accent-cyan)",
                  padding: "2px 7px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                v0.1.0-jit
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
              {t("launchpad.heroSubtitle")}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "0 auto", maxWidth: 620, lineHeight: 1.55 }}>
          {t("launchpad.heroDescription")}
        </p>
      </div>

      {/* Main Action Cards: Create New Project vs Import */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 18,
          marginBottom: 38
        }}
      >
        {/* Card 1: Create New Project */}
        <div
          onClick={() => onOpenNewProject()}
          className="axiom-card axiom-card-hover"
          style={{
            padding: "22px 26px",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <FolderPlus size={22} color="var(--accent-blue)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {t("launchpad.createCardTitle")}
                </h3>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 12px 0", lineHeight: 1.45 }}>
                {t("launchpad.createCardDesc")}
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--accent-blue)" }}>
                <span>{t("modals.newProjectTitle")}</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Import Project JSON */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="axiom-card axiom-card-hover"
          style={{
            padding: "22px 26px",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Upload size={22} color="var(--accent-purple)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {t("launchpad.openCardTitle")}
                </h3>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 12px 0", lineHeight: 1.45 }}>
                {t("launchpad.openCardDesc")}
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--accent-purple)" }}>
                <span>.json</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Your Projects Section (Active vs Trash) */}
      <div style={{ maxWidth: 840, width: "100%", marginBottom: 38 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={16} color="var(--accent-blue)" />
            <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-primary)" }}>
              {t("launchpad.yourProjects")}
            </h2>
          </div>

          {/* Filter Tabs: Active vs Trash */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "var(--bg-secondary)", padding: "2px 4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setProjectsTab("active")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: "var(--radius-xs)",
                border: "none",
                cursor: "pointer",
                backgroundColor: projectsTab === "active" ? "var(--bg-tertiary)" : "transparent",
                color: projectsTab === "active" ? "var(--text-primary)" : "var(--text-muted)",
                transition: "all 0.15s ease"
              }}
            >
              <span>{t("launchpad.activeProjects")}</span>
              <span className="mono-num" style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, backgroundColor: projectsTab === "active" ? "rgba(59, 130, 246, 0.2)" : "var(--bg-primary)", color: projectsTab === "active" ? "var(--accent-blue)" : "var(--text-muted)" }}>
                {activeProjects.length}
              </span>
            </button>

            <button
              onClick={() => setProjectsTab("trash")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: "var(--radius-xs)",
                border: "none",
                cursor: "pointer",
                backgroundColor: projectsTab === "trash" ? "var(--bg-tertiary)" : "transparent",
                color: projectsTab === "trash" ? "var(--accent-rose)" : "var(--text-muted)",
                transition: "all 0.15s ease"
              }}
            >
              <Trash2 size={12} />
              <span>{t("launchpad.trashProjects")}</span>
              {trashedProjects.length > 0 && (
                <span className="mono-num" style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, backgroundColor: "rgba(244, 63, 94, 0.2)", color: "var(--accent-rose)" }}>
                  {trashedProjects.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {projectsTab === "active" ? (
          activeProjects.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: 12 }}>
              {t("launchpad.noProjects")}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {activeProjects.map((p) => (
                <div key={p.id} className="axiom-card axiom-card-hover" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      <Folder size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </span>
                    </div>
                    {onTrashProject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t("launchpad.confirmTrash").replace("{name}", p.name))) {
                            onTrashProject(p.id);
                          }
                        }}
                        title={t("launchpad.moveToTrash")}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", transition: "color 0.15s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    <Cpu size={12} color="var(--accent-blue)" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.targetDevice.split(" ")[0]}</span>
                    <span>•</span>
                    <span className="mono-num">[TOP] {p.topModule}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                    <span className="mono-num" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {p.fileCount} {p.fileCount === 1 ? "file" : "files"}
                    </span>
                    {onOpenProject && (
                      <button
                        onClick={() => onOpenProject(p.id)}
                        className="axiom-btn axiom-btn-primary"
                        style={{ padding: "3px 10px", fontSize: 11, gap: 5 }}
                      >
                        <FolderOpen size={12} />
                        <span>{t("launchpad.openProject")}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          trashedProjects.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: 12 }}>
              {t("launchpad.trashEmpty")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {onEmptyTrash && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      if (confirm(t("launchpad.confirmEmptyTrash"))) {
                        onEmptyTrash();
                      }
                    }}
                    className="axiom-btn"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      color: "var(--accent-rose)",
                      backgroundColor: "rgba(244, 63, 94, 0.1)",
                      border: "1px solid rgba(244, 63, 94, 0.3)",
                      gap: 5
                    }}
                  >
                    <Trash2 size={12} />
                    <span>{t("launchpad.emptyTrash")}</span>
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {trashedProjects.map((p) => (
                  <div key={p.id} className="axiom-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, opacity: 0.9, border: "1px solid rgba(244, 63, 94, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Trash2 size={15} color="var(--accent-rose)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "line-through" }}>
                          {p.name}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {p.trashedAt ? `Trashed ${new Date(p.trashedAt).toLocaleDateString()}` : "In Trash"} • {p.fileCount} files
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                      {onRestoreProject && (
                        <button
                          onClick={() => onRestoreProject(p.id)}
                          className="axiom-btn"
                          style={{ padding: "3px 9px", fontSize: 11, color: "var(--accent-cyan)", border: "1px solid rgba(6, 182, 212, 0.3)", gap: 4 }}
                        >
                          <RotateCcw size={12} />
                          <span>{t("launchpad.restoreProject")}</span>
                        </button>
                      )}
                      {onPermanentDeleteProject && (
                        <button
                          onClick={() => {
                            if (confirm(t("launchpad.confirmDelete").replace("{name}", p.name))) {
                              onPermanentDeleteProject(p.id);
                            }
                          }}
                          className="axiom-btn"
                          style={{ padding: "3px 9px", fontSize: 11, color: "var(--accent-rose)", backgroundColor: "rgba(244, 63, 94, 0.12)", border: "1px solid rgba(244, 63, 94, 0.3)", gap: 4 }}
                        >
                          <Trash2 size={12} />
                          <span>{t("launchpad.deletePermanently")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Starter Templates Section */}
      <div style={{ maxWidth: 840, width: "100%", marginBottom: 38 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Sparkles size={16} color="var(--accent-amber)" />
          <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-primary)" }}>
            {t("launchpad.quickStartTitle")}
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14
          }}
        >
          {PROJECT_TEMPLATES.map((tmpl: ProjectTemplate) => (
            <div
              key={tmpl.id}
              onClick={() => onOpenNewProject(tmpl.id)}
              className="axiom-card axiom-card-hover"
              style={{
                padding: "15px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {getTemplateIcon(tmpl.id)}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {tmpl.name}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>
                {tmpl.description}
              </p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 7, borderTop: "1px solid var(--border-subtle)" }}>
                <span className="mono-num" style={{ fontSize: 10.5, color: "var(--accent-cyan)" }}>
                  {tmpl.defaultDevice.split(" ")[0]}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                  <span>{t("launchpad.createTemplate")}</span>
                  <ChevronRight size={11} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aerospace Engineering Pillars Footer */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          paddingTop: 22,
          borderTop: "1px solid var(--border-subtle)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <Zap size={15} color="var(--accent-amber)" />
          <span>{t("launchpad.inRamJitTitle")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <Clock size={15} color="var(--accent-cyan)" />
          <span>{t("launchpad.deltaSteppingTitle")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <ShieldCheck size={15} color="var(--accent-emerald)" />
          <span>Rust AST LSP Linter</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <Code2 size={15} color="var(--accent-blue)" />
          <span>Vivado File Sets</span>
        </div>
      </div>
    </div>
  );
};
