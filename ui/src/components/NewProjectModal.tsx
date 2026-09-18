import React, { useState } from "react";
import { X, Sparkles, Check, ArrowRight } from "lucide-react";
import {
  FPGA_TARGET_DEVICES,
  PROJECT_TEMPLATES,
  AxiomProject,
  createProjectFromTemplate
} from "../engine/projectModel";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: AxiomProject) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const [projectName, setProjectName] = useState<string>("axi_system_top");
  const [selectedDevice, setSelectedDevice] = useState<string>(FPGA_TARGET_DEVICES[0].name);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("riscv_soc_project");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newProj = createProjectFromTemplate(
      selectedTemplateId,
      projectName.trim() || "untitled_project",
      selectedDevice
    );
    onCreateProject(newProj);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 640,
          maxHeight: "90vh",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-primary)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color="var(--accent-blue)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Create New Vivado HDL Project
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: "var(--radius-sm)"
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Project Name Input */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                PROJECT NAME
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))}
                placeholder="e.g. riscv_core_soc"
                autoFocus
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  outline: "none"
                }}
              />
            </div>

            {/* Target Silicon Device */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                TARGET FPGA SILICON PART
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {FPGA_TARGET_DEVICES.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.family} • {d.logicCells} Logic Cells)
                  </option>
                ))}
              </select>
            </div>

            {/* Project Starter Template */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                CHOOSE PROJECT STARTER TEMPLATE
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PROJECT_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                        backgroundColor: isSelected ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isSelected ? "var(--accent-blue)" : "var(--text-primary)"
                          }}
                        >
                          {tmpl.name}
                        </span>
                        {isSelected && <Check size={14} color="var(--accent-blue)" />}
                      </div>

                      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.3, margin: 0 }}>
                        {tmpl.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
                        <span>{tmpl.files.length} Files</span>
                        <span>•</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>Top: {tmpl.defaultTopModule}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-primary)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: "var(--accent-blue)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer"
              }}
            >
              <span>Create Project</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
