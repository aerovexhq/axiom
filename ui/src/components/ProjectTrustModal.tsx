// Axiom EDA — Project Trust Permission Dialog
import React from "react";
import { ShieldAlert, ShieldCheck, Shield, Folder, Cpu } from "lucide-react";
import { Modal } from "./ui/Modal";
import { AxiomProject } from "../engine/projectModel";
import { useTranslation } from "../i18n";

interface ProjectTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AxiomProject;
  onTrust: () => void;
  onOpenRestricted: () => void;
}

export const ProjectTrustModal: React.FC<ProjectTrustModalProps> = ({
  isOpen,
  onClose,
  project,
  onTrust,
  onOpenRestricted
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("security.trustModalTitle")}
      subtitle={t("security.trustModalSubtitle")}
      icon={<ShieldAlert size={20} color="var(--accent-amber)" />}
      width={560}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 12 }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            {t("common.cancel")}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onOpenRestricted}
              className="btn btn-secondary"
              style={{
                fontSize: 12,
                padding: "6px 14px",
                borderColor: "rgba(245, 158, 11, 0.4)",
                color: "var(--accent-amber)"
              }}
            >
              <Shield size={13} style={{ marginRight: 6 }} />
              {t("security.restrictedButton")}
            </button>
            <button
              onClick={onTrust}
              className="btn btn-primary"
              style={{
                fontSize: 12,
                padding: "6px 16px",
                background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                fontWeight: 600
              }}
            >
              <ShieldCheck size={14} style={{ marginRight: 6 }} />
              {t("security.trustButton")}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Project Snapshot Card */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={15} color="var(--accent-cyan)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {project.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5, color: "var(--text-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Cpu size={12} color="var(--accent-cyan)" />
              {project.targetDevice}
            </span>
            <span>{project.files.length} {t("menu.files")}</span>
            <span>[TOP] {project.topModule}</span>
          </div>
        </div>

        {/* Security Explanation */}
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {t("security.trustModalDesc")}
        </div>

        {/* Comparison Matrix */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 4
          }}
        >
          {/* Restricted Mode Box */}
          <div
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.05)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--accent-amber)" }}>
              <ShieldAlert size={14} />
              <span>{t("security.restrictedMode")}</span>
            </div>
            <ul style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
              <li>10 MB storage limit</li>
              <li>2,000 delta cycle ceiling</li>
              <li>Outputs isolated to .axiom/data/</li>
              <li>External filesystem blocked</li>
            </ul>
          </div>

          {/* Trusted Mode Box */}
          <div
            style={{
              backgroundColor: "rgba(6, 182, 212, 0.05)",
              border: "1px solid rgba(6, 182, 212, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--accent-cyan)" }}>
              <ShieldCheck size={14} />
              <span>{t("security.trustedMode")}</span>
            </div>
            <ul style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
              <li>Full Cranelift JIT speed</li>
              <li>Configurable storage quota</li>
              <li>User-defined delta limits</li>
              <li>Full workspace capabilities</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};
