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
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(true);
  const [simOpen, setSimOpen] = useState<boolean>(true);
  const [constrsOpen, setConstrsOpen] = useState<boolean>(true);
  const [templatesOpen, setTemplatesOpen] = useState<boolean>(false);

  // Render empty state if no project is currently loaded
  if (!project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: 12 }}>
        <div
          style={{
            padding: "16px 12px",
            textAlign: "center",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-subtle)",
            marginBottom: 16
          }}
        >
          <FolderPlus size={28} color="var(--accent-blue)" style={{ margin: "0 auto 8px", opacity: 0.8 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            No Project Open
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
            Create a new Vivado project or choose a hardware starter template.
          </div>
          <button
            onClick={onOpenNewProject}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "7px 12px",
              backgroundColor: "var(--accent-blue)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.15s ease"
            }}
          >
            <Plus size={14} />
            <span>Create New Project</span>
          </button>
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            padding: "0 4px 6px",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <Sparkles size={11} color="var(--accent-cyan)" />
          <span>Starter Templates</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.12s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-blue)";
                e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-blue)" }}>
                {tmpl.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {tmpl.files.length} sources • {tmpl.defaultTopModule}
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

  const handleSelectTemplate = (templateId: string) => {
    if (confirm("Switching templates will load the new project files. Proceed?")) {
      const newProj = createProjectFromTemplate(templateId);
      onUpdateProject(newProj);
    }
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
          padding: "4px 8px 4px 24px",
          margin: "1px 0",
          borderRadius: "var(--radius-sm)",
          backgroundColor: isActive ? "var(--bg-active)" : "transparent",
          cursor: "pointer",
          userSelect: "none",
          transition: "background-color 0.12s ease"
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {file.fileType === "xdc" ? (
            <FileText size={13} color="var(--accent-purple)" />
          ) : (
            <FileCode size={13} color={isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} />
          )}

          <span
            style={{
              fontSize: 11,
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
              title="Top Module for Elaboration"
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                border: "1px solid rgba(6, 182, 212, 0.35)",
                padding: "0 4px",
                borderRadius: 3
              }}
            >
              TOP
            </span>
          )}
        </div>

        {/* Action icons on hover */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {file.fileSet === "sources_1" && !isTop && (
            <button
              onClick={(e) => handleSetTop(file, e)}
              title="Set as Top Module"
              style={{
                padding: "2px 4px",
                color: "var(--text-muted)",
                borderRadius: 3,
                fontSize: 10
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <Star size={11} />
            </button>
          )}

          {project.files.length > 1 && (
            <button
              onClick={(e) => handleDeleteFile(file.id, e)}
              title="Remove file from project"
              style={{
                padding: "2px 4px",
                color: "var(--text-muted)",
                borderRadius: 3
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <Trash2 size={11} />
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
          padding: "10px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} color="var(--accent-blue)" />
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)"
              }}
            >
              {project.name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={onOpenNewProject}
              title="Create or Switch Project"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--accent-blue)"
              }}
            >
              <Plus size={11} />
              <span>New</span>
            </button>

            {onCloseProject && (
              <button
                onClick={onCloseProject}
                title="Close active project"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-muted)",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X size={11} />
                <span>Close</span>
              </button>
            )}
          </div>
        </div>

        {/* Silicon Part & Top Module Badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ color: "var(--text-muted)" }}>Target Part:</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--accent-emerald)",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                padding: "1px 5px",
                borderRadius: 3,
                border: "1px solid rgba(16, 185, 129, 0.25)"
              }}
            >
              {project.targetDevice.split(" ")[0]}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ color: "var(--text-muted)" }}>Top Module:</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--accent-cyan)",
                backgroundColor: "rgba(6, 182, 212, 0.12)",
                padding: "1px 5px",
                borderRadius: 3,
                border: "1px solid rgba(6, 182, 212, 0.25)"
              }}
            >
              {project.topModule}
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <button
            onClick={onOpenAddSource}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 6px",
              backgroundColor: "var(--accent-blue)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              transition: "opacity 0.15s ease"
            }}
          >
            <FilePlus size={12} />
            <span>+ Add Sources</span>
          </button>

          <button
            onClick={handleExportProjectJson}
            title="Export Project Configuration & HDL sources as JSON"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 8px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-sm)"
            }}
          >
            <Download size={12} />
          </button>
        </div>
      </div>

      {/* Vivado Hierarchy & File Sets Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
        <div
          style={{
            fontSize: 10,
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
        <div style={{ marginBottom: 4 }}>
          <div
            onClick={() => setSourcesOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              fontSize: 11,
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
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({designSources.length})
            </span>
          </div>

          {sourcesOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {designSources.length === 0 ? (
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 24px" }}>
                  No design sources added
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
              gap: 5,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)"
            }}
          >
            {simOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            {simOpen ? <FolderOpen size={13} color="var(--accent-cyan)" /> : <Folder size={13} color="var(--accent-cyan)" />}
            <span>Simulation Sources</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({simSources.length})
            </span>
          </div>

          {simOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {simSources.length === 0 ? (
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 24px" }}>
                  No testbench sources
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
              gap: 5,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 255, 255, 0.02)"
}}
          >
            {constrsOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            {constrsOpen ? <FolderOpen size={13} color="var(--accent-purple)" /> : <Folder size={13} color="var(--accent-purple)" />}
            <span>Constraints</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
              ({constrSources.length})
            </span>
          </div>

          {constrsOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {constrSources.length === 0 ? (
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 24px" }}>
                  No constraints (.xdc)
                </div>
              ) : (
                constrSources.map(renderFileItem)
              )}
            </div>
          )}
        </div>

        {/* 4. Project Templates Section */}
        <div style={{ marginTop: 10, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
          <div
            onClick={() => setTemplatesOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--accent-blue)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5
            }}
          >
            {templatesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Sparkles size={12} />
            <span>Load Template Project</span>
          </div>

          {templatesOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px" }}>
              {PROJECT_TEMPLATES.map((tmpl) => {
                const isCurrent = project.templateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: isCurrent ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                      border: `1px solid ${isCurrent ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                      color: isCurrent ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                      {tmpl.name}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {tmpl.files.length} files • {tmpl.defaultTopModule}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
