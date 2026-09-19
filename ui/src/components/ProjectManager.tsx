import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileCode,
  FileText,
  FilePlus,
  Plus,
  Trash2,
  Star,
  Cpu,
  ChevronDown,
  ChevronRight,
  Download,
  Sparkles,
  X
} from "lucide-react";
import {
  AxiomProject,
  ProjectFile,
  PROJECT_TEMPLATES,
  createProjectFromTemplate,
  deleteFileFromProject,
  setProjectTopModule
} from "../engine/projectModel";
import { useTranslation } from "../i18n";

interface ProjectManagerProps {
  project: AxiomProject | null;
  onUpdateProject: (updated: AxiomProject) => void;
  onOpenAddSource: () => void;
  onOpenNewProject: () => void;
  onSelectFile: (fileId: string) => void;
  onCloseProject?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  project,
  onUpdateProject,
  onOpenAddSource,
  onOpenNewProject,
  onSelectFile,
  onCloseProject,
  onSelectTemplate
}) => {
  const { t } = useTranslation();
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(true);
  const [simOpen, setSimOpen] = useState<boolean>(true);
  const [constrsOpen, setConstrsOpen] = useState<boolean>(true);

  // Render empty state if no project is currently loaded
  if (!project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: 12 }}>
        <div
          className="axiom-card"
          style={{
            padding: "20px 16px",
            textAlign: "center",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-subtle)",
            marginBottom: 16
          }}
        >
          <FolderPlus size={32} color="var(--accent-blue)" style={{ margin: "0 auto 12px", opacity: 0.85 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            {t("sidebar.emptyTitle")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.45 }}>
            {t("sidebar.emptyDesc")}
          </div>
          <button
            onClick={onOpenNewProject}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Plus size={15} />
            <span>{t("sidebar.newProjectAction")}</span>
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            padding: "0 4px 8px",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 5
          }}
        >
          <Sparkles size={12} color="var(--accent-cyan)" />
          <span>{t("sidebar.templatesTitle")}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PROJECT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => {
                if (onSelectTemplate) {
                  onSelectTemplate(tmpl.id);
                } else {
                  const newProj = createProjectFromTemplate(tmpl.id);
                  onUpdateProject(newProj);
                }
              }}
              className="axiom-card axiom-card-hover"
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease"
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                {tmpl.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {tmpl.defaultDevice.split(" ")[0]} • {tmpl.files.length} files
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const designSources = project.files.filter((f) => f.fileSet === "sources_1");
  const simSources = project.files.filter((f) => f.fileSet === "sim_1");
  const constrSources = project.files.filter((f) => f.fileSet === "constrs_1");

  const handleSetTop = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    // Guess module name from file name or topModule default
    const moduleName = file.name.replace(/\.(v|sv|xdc)$/, "");
    const updated = setProjectTopModule(project, moduleName, file.id);
    onUpdateProject(updated);
  };

  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.files.length <= 1) return;
    if (confirm("Are you sure you want to remove this file from the project?")) {
      const updated = deleteFileFromProject(project, fileId);
      onUpdateProject(updated);
    }
  };

  const handleExportProjectJson = () => {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_vivado_project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFileItem = (file: ProjectFile) => {
    const isActive = file.id === project.activeFileId;
    const isTop = file.isTop || file.name.includes(project.topModule);

    return (
      <div
        key={file.id}
        onClick={() => onSelectFile(file.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px 5px 22px",
          margin: "1px 0",
          borderRadius: "var(--radius-sm)",
          backgroundColor: isActive ? "var(--bg-active)" : "transparent",
          cursor: "pointer",
          userSelect: "none",
          transition: "background-color 0.15s ease, color 0.15s ease"
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          {file.fileType === "xdc" ? (
            <FileText size={13} color="var(--accent-purple)" />
          ) : (
            <FileCode size={13} color={isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} />
          )}

          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: isActive ? "#fff" : "var(--text-primary)",
              fontWeight: isActive ? 600 : 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {file.name}
          </span>

          {isTop && (
            <span
              title={t("sidebar.setAsTop")}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                border: "1px solid rgba(6, 182, 212, 0.35)",
                padding: "0 4px",
                borderRadius: 2
              }}
            >
              {t("sidebar.topBadge")}
            </span>
          )}
        </div>

        {/* Action icons on hover */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {file.fileSet === "sources_1" && !isTop && (
            <button
              onClick={(e) => handleSetTop(file, e)}
              title={t("sidebar.setAsTop")}
              className="btn-icon"
              style={{
                padding: "2px 5px",
                color: "var(--text-muted)",
                borderRadius: 3,
                fontSize: 11
              }}
            >
              <Star size={13} />
            </button>
          )}

          {project.files.length > 1 && (
            <button
              onClick={(e) => handleDeleteFile(file.id, e)}
              title={t("common.delete")}
              className="btn-icon"
              style={{
                padding: "2px 5px",
                color: "var(--text-muted)",
                borderRadius: 3
              }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Project Meta Card */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1, overflow: "hidden", marginRight: 6 }}>
            <Cpu size={14} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
              title={project.name}
            >
              {project.name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <button
              onClick={onOpenNewProject}
              title={t("header.newProject")}
              className="btn btn-ghost"
              style={{ padding: "3px 8px", fontSize: 11, color: "var(--accent-blue)" }}
            >
              <Plus size={12} />
              <span>{t("common.create")}</span>
            </button>

            {onCloseProject && (
              <button
                onClick={onCloseProject}
                title={t("header.closeProject")}
                className="btn btn-ghost"
                style={{ padding: "3px 7px", fontSize: 11 }}
              >
                <X size={12} />
                <span>{t("common.close")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Silicon Part & Top Module Badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: "var(--text-muted)" }}>{t("sidebar.targetPart")}</span>
            <span
              className="badge badge-cyan mono-num"
              style={{ fontSize: 11 }}
            >
              {project.targetDevice.split(" ")[0]}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: "var(--text-muted)" }}>{t("sidebar.topModule")}</span>
            <span
              className="badge badge-emerald mono-num"
              style={{ fontSize: 11 }}
            >
              {project.topModule}
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={onOpenAddSource}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center", padding: "5px 8px", fontSize: 11.5 }}
          >
            <FilePlus size={13} />
            <span>{t("sidebar.addSources")}</span>
          </button>

          <button
            onClick={handleExportProjectJson}
            title={t("sidebar.exportJson")}
            className="btn btn-secondary"
            style={{ padding: "5px 9px" }}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Vivado Hierarchy & File Sets Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            padding: "4px 8px",
            letterSpacing: 0.5
          }}
        >
          Project File Sets
        </div>

        {/* 1. Design Sources (sources_1) */}
        <div style={{ marginBottom: 3 }}>
          <div
            onClick={() => setSourcesOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 6px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)"
            }}
          >
            {sourcesOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            {sourcesOpen ? <FolderOpen size={13} color="var(--accent-amber)" /> : <Folder size={13} color="var(--accent-amber)" />}
            <span>Design Sources</span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({designSources.length})
            </span>
          </div>

          {sourcesOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {designSources.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "5px 22px" }}>
                  {t("sidebar.noDesignSources")}
                </div>
              ) : (
                designSources.map(renderFileItem)
              )}
            </div>
          )}
        </div>

        {/* 2. Simulation Sources (sim_1) */}
        <div style={{ marginBottom: 4 }}>
          <div
            onClick={() => setSimOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              transition: "background-color 0.15s ease"
            }}
          >
            {simOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            {simOpen ? <FolderOpen size={13} color="var(--accent-cyan)" /> : <Folder size={13} color="var(--accent-cyan)" />}
            <span>{t("sidebar.simSources")}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({simSources.length})
            </span>
          </div>

          {simOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {simSources.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "5px 22px" }}>
                  {t("sidebar.noSimSources")}
                </div>
              ) : (
                simSources.map(renderFileItem)
              )}
            </div>
          )}
        </div>

        {/* 3. Constraints (constrs_1) */}
        <div style={{ marginBottom: 6 }}>
          <div
            onClick={() => setConstrsOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              transition: "background-color 0.15s ease"
            }}
          >
            {constrsOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            {constrsOpen ? <FolderOpen size={13} color="var(--accent-purple)" /> : <Folder size={13} color="var(--accent-purple)" />}
            <span>{t("sidebar.constraints")}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({constrSources.length})
            </span>
          </div>

          {constrsOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {constrSources.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "5px 22px" }}>
                  {t("sidebar.noConstraints")}
                </div>
              ) : (
                constrSources.map(renderFileItem)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
