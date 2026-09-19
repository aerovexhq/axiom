import React, { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FilePlus,
  Trash2,
  Star,
  Cpu,
  ChevronDown,
  ChevronRight,
  Download,
  X,
  Plus,
  MoreVertical
} from "lucide-react";
import {
  AxiomProject,
  ProjectFile,
  FileSetType,
  deleteFileFromProject,
  setProjectTopModule
} from "../engine/projectModel";
import { useTranslation } from "../i18n";
import { confirmDialog } from "./ui";
import { toast } from "../engine/toast";

interface ProjectManagerProps {
  project: AxiomProject | null;
  onUpdateProject: (updated: AxiomProject) => void;
  onOpenAddSource: (fileSet?: FileSetType) => void;
  onOpenNewProject?: () => void;
  onSelectFile: (fileId: string) => void;
  onCloseProject?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  project,
  onUpdateProject,
  onOpenAddSource,
  onOpenNewProject: _onOpenNewProject,
  onSelectFile,
  onCloseProject,
  onSelectTemplate: _onSelectTemplate
}) => {
  const { t } = useTranslation();
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`axiom_folders_${project?.id || "default"}`);
      if (saved) return JSON.parse(saved).sources !== false;
    } catch {}
    return true;
  });
  const [simOpen, setSimOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`axiom_folders_${project?.id || "default"}`);
      if (saved) return JSON.parse(saved).sim !== false;
    } catch {}
    return true;
  });
  const [constrsOpen, setConstrsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`axiom_folders_${project?.id || "default"}`);
      if (saved) return JSON.parse(saved).constrs !== false;
    } catch {}
    return true;
  });

  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Sync folder expansion changes
  useEffect(() => {
    if (!project?.id) return;
    try {
      localStorage.setItem(
        `axiom_folders_${project.id}`,
        JSON.stringify({ sources: sourcesOpen, sim: simOpen, constrs: constrsOpen })
      );
    } catch {}
  }, [project?.id, sourcesOpen, simOpen, constrsOpen]);

  // Reload folder states when switching project
  useEffect(() => {
    if (!project?.id) return;
    try {
      const saved = localStorage.getItem(`axiom_folders_${project.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSourcesOpen(parsed.sources !== false);
        setSimOpen(parsed.sim !== false);
        setConstrsOpen(parsed.constrs !== false);
      }
    } catch {}
  }, [project?.id]);

  // Click outside to close file kebab context menu
  useEffect(() => {
    if (!activeMenuFileId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-file-menu]")) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuFileId]);

  // Render empty state if no project is currently loaded (matches Netlist panel design)
  if (!project) {
    return (
      <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
        <Folder size={26} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
        <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{t("sidebar.emptyTitle")}</div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
          {t("sidebar.emptyDesc")}
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

  const handleDeleteFile = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.files.length <= 1) return;
    const file = project.files.find((f) => f.id === fileId);
    const fileName = file ? file.name : "this file";
    const confirmed = await confirmDialog({
      title: t("common.delete"),
      message: `Are you sure you want to remove "${fileName}" from the project?`,
      confirmText: t("common.delete"),
      variant: "danger"
    });
    if (confirmed) {
      const updated = deleteFileFromProject(project, fileId);
      onUpdateProject(updated);
      toast.info(`Removed "${fileName}" from project`);
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
    toast.success(`Exported bundle "${project.name}_vivado_project.json"`);
  };

  const renderFileItem = (file: ProjectFile) => {
    const isActive = file.id === project.activeFileId;
    const isTop =
      file.isTop ||
      (file.fileSet === "sources_1" &&
        (file.name === `${project.topModule}.v` ||
          file.name === `${project.topModule}.sv` ||
          file.name === project.topModule));

    return (
      <div
        key={file.id}
        onClick={() => onSelectFile(file.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveMenuFileId((prev) => (prev === file.id ? null : file.id));
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px 5px 18px",
          margin: "1px 0",
          borderRadius: "var(--radius-sm)",
          backgroundColor: isActive ? "var(--bg-active)" : "transparent",
          cursor: "pointer",
          userSelect: "none",
          transition: "background-color 0.15s ease, color 0.15s ease",
          minWidth: 0,
          position: "relative"
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1, overflow: "hidden" }}>
          {file.fileType === "xdc" ? (
            <FileText size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
          ) : (
            <FileCode size={13} color={isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} style={{ flexShrink: 0 }} />
          )}

          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: isActive ? "#fff" : "var(--text-primary)",
              fontWeight: isActive ? 600 : 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1
            }}
            title={file.name}
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
                borderRadius: 2,
                flexShrink: 0
              }}
            >
              {t("sidebar.topBadge")}
            </span>
          )}
        </div>

        {/* Action icons / Kebab menu */}
        <div
          data-file-menu
          style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuFileId((prev) => (prev === file.id ? null : file.id));
            }}
            title="File actions"
            className="btn-icon"
            style={{
              padding: "2px 4px",
              color: activeMenuFileId === file.id ? "#fff" : "var(--text-muted)",
              backgroundColor: activeMenuFileId === file.id ? "rgba(255, 255, 255, 0.12)" : "transparent",
              borderRadius: 3,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <MoreVertical size={13} />
          </button>

          {/* Context menu popup */}
          {activeMenuFileId === file.id && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                minWidth: 155,
                backgroundColor: "#161b22",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
                zIndex: 200,
                padding: "4px 0",
                display: "flex",
                flexDirection: "column"
              }}
            >
              {file.fileSet === "sources_1" && !isTop && (
                <button
                  type="button"
                  onClick={(e) => {
                    setActiveMenuFileId(null);
                    handleSetTop(file, e);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    fontSize: 11.5,
                    color: "var(--text-primary)",
                    backgroundColor: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Star size={12} color="var(--accent-amber)" />
                  <span>{t("sidebar.setAsTop")}</span>
                </button>
              )}

              <button
                type="button"
                disabled={project.files.length <= 1}
                onClick={(e) => {
                  setActiveMenuFileId(null);
                  handleDeleteFile(file.id, e);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 12px",
                  fontSize: 11.5,
                  color: project.files.length <= 1 ? "var(--text-muted)" : "var(--accent-rose)",
                  backgroundColor: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: project.files.length <= 1 ? "not-allowed" : "pointer",
                  opacity: project.files.length <= 1 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (project.files.length > 1) e.currentTarget.style.backgroundColor = "rgba(244, 63, 94, 0.12)";
                }}
                onMouseLeave={(e) => {
                  if (project.files.length > 1) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Trash2 size={12} />
                <span>{t("common.delete")}</span>
              </button>
            </div>
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
          padding: "8px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1, overflow: "hidden" }}>
            <Cpu size={15} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
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

          {onCloseProject && (
            <button
              onClick={onCloseProject}
              title={t("header.closeProject")}
              className="btn-icon"
              style={{ padding: 4, color: "var(--text-muted)", flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          )}
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
            onClick={() => onOpenAddSource()}
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
          {t("sidebar.projectFileSets")}
        </div>

        {/* 1. Design Sources */}
        <div style={{ marginBottom: 3 }}>
          <div
            onClick={() => setSourcesOpen((prev) => !prev)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenAddSource("sources_1");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              userSelect: "none",
              whiteSpace: "nowrap"
            }}
          >
            {sourcesOpen ? <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            {sourcesOpen ? <FolderOpen size={13} color="var(--accent-amber)" style={{ flexShrink: 0 }} /> : <Folder size={13} color="var(--accent-amber)" style={{ flexShrink: 0 }} />}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t("sidebar.designSources")}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAddSource("sources_1");
              }}
              title={t("sidebar.addSources")}
              style={{
                marginLeft: "auto",
                padding: "2px 5px",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Plus size={13} />
            </button>
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

        {/* 2. Simulation Sources */}
        <div style={{ marginBottom: 4 }}>
          <div
            onClick={() => setSimOpen((prev) => !prev)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenAddSource("sim_1");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              transition: "background-color 0.15s ease",
              userSelect: "none",
              whiteSpace: "nowrap"
            }}
          >
            {simOpen ? <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            {simOpen ? <FolderOpen size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} /> : <Folder size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t("sidebar.simSources")}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAddSource("sim_1");
              }}
              title={t("sidebar.addSources")}
              style={{
                marginLeft: "auto",
                padding: "2px 5px",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Plus size={13} />
            </button>
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

        {/* 3. Constraints */}
        <div style={{ marginBottom: 6 }}>
          <div
            onClick={() => setConstrsOpen((prev) => !prev)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenAddSource("constrs_1");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              transition: "background-color 0.15s ease",
              userSelect: "none",
              whiteSpace: "nowrap"
            }}
          >
            {constrsOpen ? <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            {constrsOpen ? <FolderOpen size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} /> : <Folder size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} />}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t("sidebar.constraints")}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAddSource("constrs_1");
              }}
              title={t("sidebar.addSources")}
              style={{
                marginLeft: "auto",
                padding: "2px 5px",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Plus size={13} />
            </button>
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
