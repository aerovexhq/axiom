// Axiom EDA — Categorized Project & Editor Settings Modal
import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  Code2,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Trash2,
  Check,
  Layers,
  Sparkles
} from "lucide-react";
import { Modal } from "./ui/Modal";
import { DropdownSelect } from "./ui";
import { AxiomProject, ProjectSecuritySettings, getDefaultSecuritySettings } from "../engine/projectModel";
import { getFileSystem, ProjectStorageUsage } from "../engine/fs";
import { isAutoSaveEnabled, setAutoSaveEnabled } from "../engine/autoSaveManager";
import { toast } from "../engine/toast";
import { useTranslation } from "../i18n";

export type SettingsCategory = "general" | "editor" | "simulation" | "security";

export interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AxiomProject;
  onUpdateProject: (updated: AxiomProject) => void;
  initialCategory?: SettingsCategory;
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

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
  initialCategory = "general"
}) => {
  const { t } = useTranslation();

  // Active Category Sidebar Tab
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);

  // General Category State
  const [projectName, setProjectName] = useState<string>(project.name);
  const [topModule, setTopModule] = useState<string>(project.topModule);
  const [targetDevice, setTargetDevice] = useState<string>(project.targetDevice);

  // Editor & UX Category State
  const [katanaCursor, setKatanaCursor] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_katana_cursor");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });

  const [minimap, setMinimap] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_editor_minimap");
      return v === "true";
    } catch {
      return false;
    }
  });

  const [lineNumbers, setLineNumbers] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_editor_line_numbers");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });

  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_editor_word_wrap");
      return v === "true";
    } catch {
      return false;
    }
  });

  const [autoSave, setAutoSave] = useState<boolean>(() => isAutoSaveEnabled());
  const [autoSaveDelay, setAutoSaveDelay] = useState<number>(() => {
    try {
      const v = localStorage.getItem("axiom_autosave_delay_ms");
      return v ? parseInt(v, 10) : 500;
    } catch {
      return 500;
    }
  });

  // Simulation & JIT Category State
  const [compileStrategy, setCompileStrategy] = useState<"on_demand" | "manual">(() => {
    try {
      const v = localStorage.getItem("axiom_compile_strategy");
      return v === "manual" ? "manual" : "on_demand";
    } catch {
      return "on_demand";
    }
  });

  const [lockDuringRun, setLockDuringRun] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_lock_recompile_during_run");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });

  const [defaultCoverage, setDefaultCoverage] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("axiom_default_coverage");
      return v === "true";
    } catch {
      return false;
    }
  });

  // Security & Storage State
  const security = project.security ?? getDefaultSecuritySettings(true);
  const [isTrusted, setIsTrusted] = useState<boolean>(security.isTrusted);
  const [quotaMb, setQuotaMb] = useState<number>(security.storageQuotaMb);
  const [isolateDataDir, setIsolateDataDir] = useState<boolean>(security.isolateDataDir);
  const [maxDeltaCycles, setMaxDeltaCycles] = useState<number>(security.maxDeltaCycles);
  const [usage, setUsage] = useState<ProjectStorageUsage | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        setActiveCategory(initialCategory);
      }
      setProjectName(project.name);
      setTopModule(project.topModule);
      setTargetDevice(project.targetDevice);

      try {
        const k = localStorage.getItem("axiom_katana_cursor");
        setKatanaCursor(k !== null ? k === "true" : true);
        setMinimap(localStorage.getItem("axiom_editor_minimap") === "true");
        const ln = localStorage.getItem("axiom_editor_line_numbers");
        setLineNumbers(ln !== null ? ln === "true" : true);
        setWordWrap(localStorage.getItem("axiom_editor_word_wrap") === "true");
        setAutoSave(isAutoSaveEnabled());
        const d = localStorage.getItem("axiom_autosave_delay_ms");
        setAutoSaveDelay(d ? parseInt(d, 10) : 500);
        const cs = localStorage.getItem("axiom_compile_strategy");
        setCompileStrategy(cs === "manual" ? "manual" : "on_demand");
        const lr = localStorage.getItem("axiom_lock_recompile_during_run");
        setLockDuringRun(lr !== null ? lr === "true" : true);
        setDefaultCoverage(localStorage.getItem("axiom_default_coverage") === "true");
      } catch (err) {
        console.warn("[ProjectSettingsModal] Failed reading local preferences:", err);
      }

      const s = project.security ?? getDefaultSecuritySettings(true);
      setIsTrusted(s.isTrusted);
      setQuotaMb(s.storageQuotaMb);
      setIsolateDataDir(s.isolateDataDir);
      setMaxDeltaCycles(s.maxDeltaCycles);
      loadUsage();
    }
  }, [isOpen, project, initialCategory]);

  const loadUsage = useCallback(async () => {
    setIsLoadingUsage(true);
    try {
      const fs = getFileSystem();
      const res = await fs.getProjectStorageUsage(project.id);
      setUsage(res);
    } catch (err) {
      console.warn("[ProjectSettingsModal] Error loading usage:", err);
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
    // 1. Save Editor & System preferences to localStorage
    try {
      localStorage.setItem("axiom_katana_cursor", String(katanaCursor));
      localStorage.setItem("axiom_editor_minimap", String(minimap));
      localStorage.setItem("axiom_editor_line_numbers", String(lineNumbers));
      localStorage.setItem("axiom_editor_word_wrap", String(wordWrap));
      setAutoSaveEnabled(autoSave);
      localStorage.setItem("axiom_autosave_delay_ms", String(autoSaveDelay));
      localStorage.setItem("axiom_compile_strategy", compileStrategy);
      localStorage.setItem("axiom_lock_recompile_during_run", String(lockDuringRun));
      localStorage.setItem("axiom_default_coverage", String(defaultCoverage));

      // Notify all components in the current window of preference updates
      window.dispatchEvent(new CustomEvent("axiom-settings-changed"));
    } catch (err) {
      console.warn("[ProjectSettingsModal] Error saving preferences:", err);
    }

    // 2. Update Project Security and Metadata
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
      name: projectName.trim() || project.name,
      topModule: topModule.trim() || project.topModule,
      targetDevice: targetDevice.trim() || project.targetDevice,
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

  const categoryTabStyle = (category: SettingsCategory) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 12px",
    fontSize: 12.5,
    fontWeight: activeCategory === category ? 600 : 500,
    color: activeCategory === category ? "var(--text-primary)" : "var(--text-muted)",
    backgroundColor: activeCategory === category ? "var(--bg-tertiary)" : "transparent",
    border: activeCategory === category ? "1px solid var(--border-strong)" : "1px solid transparent",
    borderLeft: activeCategory === category ? "3px solid var(--accent-cyan)" : "3px solid transparent",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s ease"
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.title")}
      subtitle={`${project.name} • ${project.targetDevice}`}
      icon={<Sliders size={18} color="var(--accent-cyan)" />}
      width={760}
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
      <div style={{ display: "flex", gap: 18, minHeight: 380, maxHeight: 520 }}>
        {/* Left Category Sidebar */}
        <div
          style={{
            width: 190,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingRight: 14,
            borderRight: "1px solid var(--border-subtle)",
            flexShrink: 0
          }}
        >
          <button
            type="button"
            style={categoryTabStyle("general")}
            onClick={() => setActiveCategory("general")}
          >
            <Sliders size={14} color={activeCategory === "general" ? "var(--accent-cyan)" : "currentColor"} />
            <span>{t("settings.generalCategory")}</span>
          </button>

          <button
            type="button"
            style={categoryTabStyle("editor")}
            onClick={() => setActiveCategory("editor")}
          >
            <Code2 size={14} color={activeCategory === "editor" ? "var(--accent-cyan)" : "currentColor"} />
            <span>{t("settings.editorCategory")}</span>
          </button>

          <button
            type="button"
            style={categoryTabStyle("simulation")}
            onClick={() => setActiveCategory("simulation")}
          >
            <Cpu size={14} color={activeCategory === "simulation" ? "var(--accent-cyan)" : "currentColor"} />
            <span>{t("settings.simulationCategory")}</span>
          </button>

          <button
            type="button"
            style={categoryTabStyle("security")}
            onClick={() => setActiveCategory("security")}
          >
            <ShieldCheck size={14} color={activeCategory === "security" ? "var(--accent-cyan)" : "currentColor"} />
            <span>{t("settings.securityCategory")}</span>
          </button>
        </div>

        {/* Right Settings Content Area */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* CATEGORY 1: GENERAL */}
          {activeCategory === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5 }}>
                  {t("settings.projectName")}
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="input"
                  style={{ width: "100%", fontSize: 12.5, padding: "7px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5 }}>
                  {t("settings.topModule")}
                </label>
                <input
                  type="text"
                  value={topModule}
                  onChange={(e) => setTopModule(e.target.value)}
                  className="input"
                  style={{ width: "100%", fontSize: 12.5, padding: "7px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5 }}>
                  {t("settings.targetDevice")}
                </label>
                <input
                  type="text"
                  value={targetDevice}
                  onChange={(e) => setTargetDevice(e.target.value)}
                  className="input"
                  style={{ width: "100%", fontSize: 12.5, padding: "7px 10px" }}
                />
              </div>

              {/* Project Stats Card */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 4
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Layers size={13} color="var(--accent-cyan)" />
                  <span>Project Metadata & Architecture</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11.5 }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t("settings.projectId")}: </span>
                    <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{project.id}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t("settings.sourceFilesCount")}: </span>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{project.files.length}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t("settings.created")}: </span>
                    <span style={{ color: "var(--text-secondary)" }}>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>{t("settings.lastSaved")}: </span>
                    <span style={{ color: "var(--text-secondary)" }}>{new Date(project.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY 2: EDITOR & UX */}
          {activeCategory === "editor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Katana Slash Strike Cursor Effect */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    <Sparkles size={14} color="var(--accent-cyan)" />
                    {t("settings.katanaCursor")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.katanaCursorDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={katanaCursor}
                  onChange={(e) => setKatanaCursor(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Monaco Minimap Toggle */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("settings.minimap")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.minimapDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={minimap}
                  onChange={(e) => setMinimap(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Line Numbers Toggle */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("settings.lineNumbers")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.lineNumbersDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={lineNumbers}
                  onChange={(e) => setLineNumbers(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Word Wrap Toggle */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("settings.wordWrap")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.wordWrapDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Auto-Save Configuration */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                      {t("settings.autoSave")}
                    </label>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                      {t("settings.autoSaveDesc")}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                  />
                </div>

                {autoSave && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                      {t("settings.autoSaveDelay")}
                    </span>
                    <DropdownSelect<number>
                      value={autoSaveDelay}
                      onChange={(val) => setAutoSaveDelay(val)}
                      options={[
                        { value: 300, label: "300 ms (Fast)" },
                        { value: 500, label: "500 ms (Default)" },
                        { value: 1000, label: "1.0 s" },
                        { value: 2000, label: "2.0 s" }
                      ]}
                      size="sm"
                      minWidth={130}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CATEGORY 3: SIMULATION & COMPILATION */}
          {activeCategory === "simulation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Compilation Strategy */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("settings.compileStrategy")}
                </label>

                {/* Option 1: On-Demand */}
                <div
                  onClick={() => setCompileStrategy("on_demand")}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: compileStrategy === "on_demand" ? "var(--bg-secondary)" : "transparent",
                    border: `1px solid ${compileStrategy === "on_demand" ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    checked={compileStrategy === "on_demand"}
                    onChange={() => setCompileStrategy("on_demand")}
                    style={{ marginTop: 2, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                      {t("settings.compileOnDemand")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {t("settings.compileOnDemandDesc")}
                    </div>
                  </div>
                </div>

                {/* Option 2: Manual Only */}
                <div
                  onClick={() => setCompileStrategy("manual")}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: compileStrategy === "manual" ? "var(--bg-secondary)" : "transparent",
                    border: `1px solid ${compileStrategy === "manual" ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    checked={compileStrategy === "manual"}
                    onChange={() => setCompileStrategy("manual")}
                    style={{ marginTop: 2, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                      {t("settings.compileManual")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {t("settings.compileManualDesc")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mid-Run Recompile Lock */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("settings.lockDuringRun")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.lockDuringRunDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={lockDuringRun}
                  onChange={(e) => setLockDuringRun(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Default RTL Code Coverage */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("settings.defaultCoverage")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("settings.defaultCoverageDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={defaultCoverage}
                  onChange={(e) => setDefaultCoverage(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Max Delta Cycles Threshold */}
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
          )}

          {/* CATEGORY 4: SECURITY & STORAGE */}
          {activeCategory === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Trust Permission Status */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: `1px solid ${isTrusted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "var(--radius-md)",
                      backgroundColor: isTrusted ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    {isTrusted ? (
                      <ShieldCheck size={18} color="var(--accent-emerald)" />
                    ) : (
                      <ShieldAlert size={18} color="var(--accent-amber)" />
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                        {t("security.trustStatus")}:
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: isTrusted ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: isTrusted ? "var(--accent-emerald)" : "var(--accent-amber)"
                        }}
                      >
                        {isTrusted ? t("security.trustedBadge") : t("security.restrictedBadge")}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {isTrusted ? t("security.trustedDesc") : t("security.restrictedDesc")}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isTrusted;
                    setIsTrusted(next);
                    if (next && quotaMb === 10) setQuotaMb(50);
                    if (!next && quotaMb > 25) setQuotaMb(10);
                  }}
                  className="btn btn-secondary"
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    flexShrink: 0,
                    whiteSpace: "nowrap"
                  }}
                >
                  {isTrusted ? t("security.revokeTrust") : t("security.grantTrust")}
                </button>
              </div>

              {/* Storage Quota & Live Meter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <HardDrive size={14} color="var(--accent-cyan)" />
                    {t("security.storageQuota")}
                  </label>
                  <DropdownSelect<number>
                    value={quotaMb}
                    onChange={(val) => setQuotaMb(val)}
                    options={STORAGE_QUOTA_OPTIONS}
                    size="sm"
                    minWidth={180}
                  />
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
                    <div style={{ display: "flex", gap: 10 }}>
                      <span>{t("menu.sources")}: {formatBytes(usage?.sourceBytes ?? 0)}</span>
                      <span>•</span>
                      <span>.axiom/data/: {formatBytes(usage?.dataDirBytes ?? 0)}</span>
                      <span>•</span>
                      <span>{usage?.fileCount ?? 0} {t("menu.files")}</span>
                    </div>

                    <button
                      type="button"
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

              {/* Data Isolation Directory */}
              <div
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("security.dataIsolation")}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {t("security.dataIsolationDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isolateDataDir}
                  onChange={(e) => setIsolateDataDir(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Backwards-compatible alias for existing imports
export const ProjectSecurityModal = ProjectSettingsModal;
