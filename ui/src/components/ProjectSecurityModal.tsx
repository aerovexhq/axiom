// Axiom EDA — Project Security & Storage Quota Settings Modal
import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Trash2,
  Check
} from "lucide-react";
import { Modal } from "./ui/Modal";
import { AxiomProject, ProjectSecuritySettings, getDefaultSecuritySettings } from "../engine/projectModel";
import { getFileSystem, ProjectStorageUsage } from "../engine/fs";
import { toast } from "../engine/toast";
import { useTranslation } from "../i18n";

interface ProjectSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AxiomProject;
  onUpdateProject: (updated: AxiomProject) => void;
}

const STORAGE_QUOTA_OPTIONS = [
  { value: 10, label: "10 MB (Strict Sandbox)" },
  { value: 25, label: "25 MB" },
  { value: 50, label: "50 MB (Default)" },
  { value: 100, label: "100 MB" },
  { value: 250, label: "250 MB" },
  { value: 500, label: "500 MB" },
  { value: 0, label: "Unlimited (No Quota)" }
];

export const ProjectSecurityModal: React.FC<ProjectSecurityModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject
}) => {
  const { t } = useTranslation();

  const security = project.security ?? getDefaultSecuritySettings(true);
  const [isTrusted, setIsTrusted] = useState<boolean>(security.isTrusted);
  const [quotaMb, setQuotaMb] = useState<number>(security.storageQuotaMb);
  const [isolateDataDir, setIsolateDataDir] = useState<boolean>(security.isolateDataDir);
  const [maxDeltaCycles, setMaxDeltaCycles] = useState<number>(security.maxDeltaCycles);
  const [usage, setUsage] = useState<ProjectStorageUsage | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Sync internal state when project changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const s = project.security ?? getDefaultSecuritySettings(true);
      setIsTrusted(s.isTrusted);
      setQuotaMb(s.storageQuotaMb);
      setIsolateDataDir(s.isolateDataDir);
      setMaxDeltaCycles(s.maxDeltaCycles);
      loadUsage();
    }
  }, [isOpen, project]);

  const loadUsage = useCallback(async () => {
    setIsLoadingUsage(true);
    try {
      const fs = getFileSystem();
      const res = await fs.getProjectStorageUsage(project.id);
      setUsage(res);
    } catch (err) {
      console.warn("[ProjectSecurityModal] Error loading usage:", err);
    } finally {
      setIsLoadingUsage(false);
    }
  }, [project.id]);

  const handlePurgeData = async () => {
    setIsPurging(true);
    try {
      const fs = getFileSystem();
      const freedBytes = await fs.purgeProjectData(project.id);
      const freedKb = (freedBytes / 1024).toFixed(1);
      toast.success(`${t("security.purgeSuccess")} (${freedKb} KB freed)`);
      await loadUsage();
    } catch (err) {
      toast.error(`Purge failed: ${String(err)}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleSave = () => {
    const updatedSecurity: ProjectSecuritySettings = {
      isTrusted,
      trustedAt: isTrusted ? (security.trustedAt || new Date().toISOString()) : undefined,
      storageQuotaMb: quotaMb,
      isolateDataDir,
      maxDeltaCycles: Math.max(100, maxDeltaCycles),
      maxMemoryAllocWords: isTrusted ? 16_777_216 : 1_048_576,
      allowExternalFsExport: isTrusted
    };

    const updatedProject: AxiomProject = {
      ...project,
      security: updatedSecurity,
      updatedAt: new Date().toISOString()
    };

    onUpdateProject(updatedProject);
    toast.success(t("security.savedSuccess"));
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  const totalUsedBytes = usage?.totalBytes ?? 0;
  const quotaBytes = quotaMb > 0 ? quotaMb * 1024 * 1024 : 0;
  const usedPercent = quotaBytes > 0 ? Math.min(100, Math.round((totalUsedBytes / quotaBytes) * 100)) : 0;

  let progressColor = "var(--accent-emerald)";
  if (usedPercent >= 90) {
    progressColor = "var(--accent-rose)";
  } else if (usedPercent >= 75) {
    progressColor = "var(--accent-amber)";
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("security.projectSettingsTitle")}
      subtitle={`${project.name} (${project.targetDevice})`}
      icon={<Shield size={20} color="var(--accent-cyan)" />}
      width={620}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", width: "100%", gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}>
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{
              fontSize: 12,
              padding: "6px 16px",
              background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
              fontWeight: 600
            }}
          >
            <Check size={14} style={{ marginRight: 6 }} />
            {t("common.save")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Section 1: Trust Permission Status */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: `1px solid ${isTrusted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                backgroundColor: isTrusted ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {isTrusted ? (
                <ShieldCheck size={20} color="var(--accent-emerald)" />
              ) : (
                <ShieldAlert size={20} color="var(--accent-amber)" />
              )}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("security.trustStatus")}:
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: isTrusted ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                    color: isTrusted ? "var(--accent-emerald)" : "var(--accent-amber)"
                  }}
                >
                  {isTrusted ? t("security.trustedBadge") : t("security.restrictedBadge")}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                {isTrusted ? t("security.trustedDesc") : t("security.restrictedDesc")}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !isTrusted;
              setIsTrusted(next);
              if (next && quotaMb === 10) setQuotaMb(50);
              if (!next && quotaMb > 25) setQuotaMb(10);
            }}
            className="btn btn-secondary"
            style={{
              fontSize: 11.5,
              padding: "5px 12px",
              flexShrink: 0,
              whiteSpace: "nowrap"
            }}
          >
            {isTrusted ? t("security.revokeTrust") : t("security.grantTrust")}
          </button>
        </div>

        {/* Section 2: Storage Quota & Live Meter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <HardDrive size={14} color="var(--accent-cyan)" />
              {t("security.storageQuota")}
            </label>
            <select
              value={quotaMb}
              onChange={(e) => setQuotaMb(Number(e.target.value))}
              style={{
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px",
                fontSize: 12
              }}
            >
              {STORAGE_QUOTA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Storage Meter Card */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
              <span style={{ color: "var(--text-muted)" }}>
                {isLoadingUsage ? t("common.loading") : `${formatBytes(totalUsedBytes)} ${quotaMb > 0 ? `/ ${quotaMb} MB` : `(${t("security.unlimited")})`}`}
              </span>
              <span style={{ color: progressColor, fontWeight: 700 }}>
                {quotaMb > 0 ? `${usedPercent}%` : t("security.unlimited")}
              </span>
            </div>

            {/* Progress Track */}
            {quotaMb > 0 && (
              <div
                style={{
                  height: 6,
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: 3,
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${usedPercent}%`,
                    backgroundColor: progressColor,
                    transition: "width 0.3s ease"
                  }}
                />
              </div>
            )}

            {/* Breakdown & Purge Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                color: "var(--text-muted)",
                paddingTop: 4,
                borderTop: "1px solid var(--border-subtle)"
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <span>{t("menu.sources")}: {formatBytes(usage?.sourceBytes ?? 0)}</span>
                <span>•</span>
                <span>.axiom/data/: {formatBytes(usage?.dataDirBytes ?? 0)}</span>
                <span>•</span>
                <span>{usage?.fileCount ?? 0} {t("menu.files")}</span>
              </div>

              <button
                onClick={handlePurgeData}
                disabled={isPurging || (usage?.dataDirBytes ?? 0) === 0}
                className="btn btn-secondary"
                style={{
                  fontSize: 10.5,
                  padding: "3px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: (usage?.dataDirBytes ?? 0) === 0 ? 0.5 : 1
                }}
                title="Deletes temporary VCD, SAIF, and netlist files inside .axiom/data/"
              >
                <Trash2 size={11} />
                {t("security.purgeData")}
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Data Isolation & Simulation Safety */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12
          }}
        >
          {/* Data Isolation */}
          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={isolateDataDir}
                onChange={(e) => setIsolateDataDir(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              {t("security.dataIsolation")}
            </label>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
              {t("security.dataIsolationDesc")}
            </p>
          </div>

          {/* Max Delta Cycles */}
          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("security.maxDeltaCycles")}
              </span>
              <input
                type="number"
                min={100}
                max={100000}
                step={500}
                value={maxDeltaCycles}
                onChange={(e) => setMaxDeltaCycles(Number(e.target.value))}
                style={{
                  width: 80,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 6px",
                  fontSize: 11.5,
                  textAlign: "right"
                }}
              />
            </div>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
              {t("security.maxDeltaCyclesDesc")}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
