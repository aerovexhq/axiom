// Axiom EDA — Istanbul University - Cerrahpasa Digital Logic Lab Auto-Grader Modal
// Renders executive verification scorecard, test vector pass/fail table, and markdown report exporter

import React, { useMemo, useState } from "react";
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Award,
  Cpu,
  FileCode2,
  Check,
  Copy
} from "lucide-react";
import { Modal } from "./ui/Modal";
import type { AxiomProject } from "../engine/projectModel";
import type { SimulationState, LspDiagnostic } from "../engine/engineBridge";
import {
  evaluateLabAssignment,
  exportLabReportMarkdown,
  LabGradeResult
} from "../engine/graderModel";

export interface LabGraderModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AxiomProject | null;
  diagnostics?: LspDiagnostic[];
  state?: SimulationState;
}

export const LabGraderModal: React.FC<LabGraderModalProps> = ({
  isOpen,
  onClose,
  project,
  diagnostics = [],
  state
}) => {
  const [copied, setCopied] = useState(false);

  const result: LabGradeResult | null = useMemo(() => {
    if (!project) return null;
    return evaluateLabAssignment(project, diagnostics, state);
  }, [project, diagnostics, state]);

  if (!isOpen || !project || !result) return null;

  const handleDownloadReport = () => {
    const md = exportLabReportMarkdown(project, result);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab_report_${result.lessonId}_${result.topModule}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = async () => {
    const md = exportLabReportMarkdown(project, result);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "var(--accent-green, #10b981)";
    if (grade === "B") return "var(--accent-blue, #3b82f6)";
    if (grade === "C") return "var(--accent-yellow, #eab308)";
    if (grade === "D") return "var(--accent-orange, #f97316)";
    return "var(--accent-red, #ef4444)";
  };

  const gradeColor = getGradeColor(result.letterGrade);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Curriculum Lab Auto-Grader & Verification Scorecard"
      subtitle={`${result.lessonTitle}: ${result.lessonSubtitle} — Top Module: ${result.topModule}`}
      icon={<GraduationCap size={18} />}
      width={840}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
            <Cpu size={13} style={{ color: "var(--accent-cyan)" }} />
            <span>Target: {result.targetDevice}</span>
            <span>•</span>
            <span>Istanbul University - Cerrahpasa</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleCopyReport}
              className="btn btn-secondary"
              style={{
                height: 30,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              {copied ? <Check size={13} style={{ color: "var(--accent-green)" }} /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy Markdown"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadReport}
              className="btn btn-primary"
              style={{
                height: 30,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Download size={13} />
              <span>Download Lab Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ height: 30, padding: "0 12px", fontSize: 12 }}
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Executive Score Hero */}
        <div
          style={{
            padding: 16,
            borderRadius: "var(--radius-md)",
            border: `1px solid ${gradeColor}40`,
            background: `linear-gradient(135deg, ${gradeColor}10 0%, rgba(18, 24, 33, 0.95) 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Grade Badge */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(10, 14, 20, 0.8)",
                border: `2px solid ${gradeColor}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 20px ${gradeColor}30`,
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                {result.letterGrade}
              </span>
              <span className="mono-num" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
                {result.totalScore}/100
              </span>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Award size={16} style={{ color: gradeColor }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  {result.totalScore >= 90 ? "Excellent Laboratory Verification" : result.totalScore >= 70 ? "Passing Laboratory Verification" : "Revisions Required"}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45, maxWidth: 480 }}>
                {result.summary}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
              flexShrink: 0,
              textAlign: "right"
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Vectors Checked
            </span>
            <span className="mono-num" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              {result.vectors.filter((v) => v.passed).length} / {result.vectors.length}
            </span>
            <span style={{ fontSize: 11, color: "var(--accent-cyan)" }}>
              100% Deterministic Engine
            </span>
          </div>
        </div>

        {/* 4 KPI Progress Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {result.categories.map((cat, idx) => {
            const isPass = cat.status === "pass";
            const isWarn = cat.status === "warn";
            const statusColor = isPass ? "var(--accent-green)" : isWarn ? "var(--accent-yellow)" : "var(--accent-red)";
            return (
              <div
                key={idx}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {cat.name}
                  </span>
                  {isPass ? (
                    <CheckCircle2 size={13} style={{ color: statusColor }} />
                  ) : isWarn ? (
                    <AlertTriangle size={13} style={{ color: statusColor }} />
                  ) : (
                    <XCircle size={13} style={{ color: statusColor }} />
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span className="mono-num" style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>
                    {cat.score}
                  </span>
                  <span className="mono-num" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    / {cat.maxScore} pts ({cat.weight}%)
                  </span>
                </div>

                <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.35 }}>
                  {cat.details[0]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Functional Test Vector Verification Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              <FileCode2 size={14} style={{ color: "var(--accent-cyan)" }} />
              Test Vector Verification Matrix
            </span>
            <span className="mono-num" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {result.vectors.length} Stimulus Combinations
            </span>
          </div>

          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-tertiary)"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderBottom: "1px solid var(--border-medium)",
                    color: "var(--text-secondary)",
                    position: "sticky",
                    top: 0,
                    zIndex: 1
                  }}
                >
                  <th style={{ padding: "7px 10px", width: 36 }}>#</th>
                  <th style={{ padding: "7px 10px" }}>Vector Description</th>
                  <th style={{ padding: "7px 10px" }}>Stimulus Inputs</th>
                  <th style={{ padding: "7px 10px" }}>Expected</th>
                  <th style={{ padding: "7px 10px" }}>Actual</th>
                  <th style={{ padding: "7px 10px", width: 70, textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.vectors.map((vec, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)"
                    }}
                  >
                    <td className="mono-num" style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {vec.name}
                    </td>
                    <td className="mono-num" style={{ padding: "6px 10px", color: "var(--accent-cyan)" }}>
                      {Object.entries(vec.inputs)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td className="mono-num" style={{ padding: "6px 10px", color: "var(--text-secondary)" }}>
                      {Object.entries(vec.expected)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td
                      className="mono-num"
                      style={{
                        padding: "6px 10px",
                        color: vec.passed ? "var(--accent-green)" : "var(--accent-red)",
                        fontWeight: 600
                      }}
                    >
                      {Object.entries(vec.actual)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "var(--radius-xs)",
                          backgroundColor: vec.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: vec.passed ? "var(--accent-green)" : "var(--accent-red)",
                          border: `1px solid ${vec.passed ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                        }}
                      >
                        {vec.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
