import React, { useRef } from "react";
import {
  FolderPlus,
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

interface WelcomeLaunchpadProps {
  onOpenNewProject: () => void;
  onSelectTemplate: (templateId: string) => void;
  onImportProjectJson: (jsonStr: string) => void;
}

export const WelcomeLaunchpad: React.FC<WelcomeLaunchpadProps> = ({
  onOpenNewProject,
  onSelectTemplate,
  onImportProjectJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        padding: "40px 24px"
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
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(56, 189, 248, 0.15)"
            }}
          >
            <Cpu size={26} color="var(--accent-cyan)" />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Axiom HDL Studio
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--accent-cyan)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)"
                }}
              >
                v0.1.0-jit
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              High-Performance In-RAM HDL Engine & Vivado Workspace
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 auto", maxWidth: 600, lineHeight: 1.5 }}>
          No project is currently open. Create a new Vivado-style project, start from an industry hardware template, or import existing sources.
        </p>
      </div>

      {/* Main Action Cards: Create New Project vs Import */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
          marginBottom: 36
        }}
      >
        {/* Card 1: Create New Project */}
        <div
          onClick={onOpenNewProject}
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "20px 24px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-blue)";
            e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
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
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Create New Project</h3>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 12px 0", lineHeight: 1.4 }}>
                Configure target FPGA silicon (Artix-7, Zynq, Kintex, UltraScale+), design file sets (<code style={{ color: "var(--accent-cyan)" }}>sources_1</code>, <code style={{ color: "var(--accent-purple)" }}>sim_1</code>, <code style={{ color: "var(--accent-amber)" }}>constrs_1</code>), and designate top module.
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--accent-blue)" }}>
                <span>Launch New Project Wizard</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Import Project JSON */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "20px 24px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-purple)";
            e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
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
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Open Project from File</h3>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 12px 0", lineHeight: 1.4 }}>
                Import an exported Axiom/Vivado project JSON file with all packaged RTL modules, testbenches, and pin/timing constraints.
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--accent-purple)" }}>
                <span>Select .json Project File</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Starter Templates Section */}
      <div style={{ maxWidth: 840, width: "100%", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Sparkles size={16} color="var(--accent-amber)" />
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-primary)" }}>
            Quick Start Hardware Templates
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12
          }}
        >
          {PROJECT_TEMPLATES.map((tmpl: ProjectTemplate) => (
            <div
              key={tmpl.id}
              onClick={() => onSelectTemplate(tmpl.id)}
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "14px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-cyan)";
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {getTemplateIcon(tmpl.id)}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {tmpl.name}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                {tmpl.description}
              </p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 10, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                  {tmpl.defaultDevice.split(" ")[0]}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 2 }}>
                  <span>Open</span>
                  <ChevronRight size={10} />
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
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          paddingTop: 20,
          borderTop: "1px solid var(--border-subtle)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <Zap size={14} color="var(--accent-amber)" />
          <span>In-RAM Cranelift JIT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <Clock size={14} color="var(--accent-cyan)" />
          <span>Discrete δ-Cycle Engine</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <ShieldCheck size={14} color="var(--accent-emerald)" />
          <span>Rust AST LSP Linter</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <Code2 size={14} color="var(--accent-blue)" />
          <span>Vivado File Sets Standard</span>
        </div>
      </div>
    </div>
  );
};
