import React, { useRef, useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  MoreVertical,
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
  Box,
  GraduationCap,
  ExternalLink,
  AppWindow,
  Download,
  ArrowRightCircle,
  CheckSquare,
  Square
} from "lucide-react";
import { PROJECT_TEMPLATES, ProjectTemplate } from "../engine/projectModel";
import { ProjectMetadata } from "../engine/projectRegistry";
import { useTranslation } from "../i18n";
import {
  GithubIcon,
  confirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "./ui";
import { toast } from "../engine/toast";
import {
  isProjectActiveInAnotherSession,
  openInNewWindow,
  takeOverProjectLease,
  subscribeToProjectLeases
} from "../engine/windowManager";

interface WelcomeLaunchpadProps {
  onOpenNewProject: (templateId?: string, lessonId?: string) => void;
  onSelectTemplate?: (templateId: string, lessonId?: string) => void;
  onImportProjectJson: (jsonStr: string) => void;
  projects?: ProjectMetadata[];
  onOpenProject?: (projectId: string) => void;
  onTrashProject?: (projectId: string) => void;
  onTrashProjects?: (projectIds: string[]) => void;
  onRestoreProject?: (projectId: string) => void;
  onRestoreProjects?: (projectIds: string[]) => void;
  onPermanentDeleteProject?: (projectId: string) => void;
  onPermanentDeleteProjects?: (projectIds: string[]) => void;
  onEmptyTrash?: () => void;
}

interface GithubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GithubReleaseItem {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: GithubReleaseAsset[];
}

const FALLBACK_LAUNCHPAD_RELEASES: GithubReleaseItem[] = [
  {
    tag_name: "v1.0.0",
    name: "Axiom EDA v1.0.0",
    published_at: "2026-09-22T13:41:57Z",
    html_url: "https://github.com/aerovexsim/axiom/releases/tag/v1.0.0",
    assets: [
      {
        name: "Axiom_1.0.0_x64_en-US.msi",
        size: 24500000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_x64_en-US.msi"
      },
      {
        name: "axiom_1.0.0_amd64.deb",
        size: 22800000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/axiom_1.0.0_amd64.deb"
      },
      {
        name: "Axiom_1.0.0_aarch64.dmg",
        size: 25300000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_aarch64.dmg"
      }
    ]
  },
  {
    tag_name: "v0.1.0",
    name: "Axiom EDA v0.1.0",
    published_at: "2026-09-17T19:55:35Z",
    html_url: "https://github.com/aerovexsim/axiom/releases/tag/v0.1.0",
    assets: [
      {
        name: "axiom-v0.1.0-x86_64-linux.tar.gz",
        size: 2295554,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v0.1.0/axiom-v0.1.0-x86_64-linux.tar.gz"
      }
    ]
  }
];

export const WelcomeLaunchpad: React.FC<WelcomeLaunchpadProps> = ({
  onOpenNewProject,
  onSelectTemplate: _onSelectTemplate,
  onImportProjectJson,
  projects = [],
  onOpenProject,
  onTrashProject,
  onTrashProjects,
  onRestoreProject,
  onRestoreProjects,
  onPermanentDeleteProject,
  onPermanentDeleteProjects,
  onEmptyTrash
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [projectsTab, setProjectsTab] = useState<"active" | "trash">("active");
  const [selectedActiveProjectIds, setSelectedActiveProjectIds] = useState<string[]>([]);
  const [selectedTrashProjectIds, setSelectedTrashProjectIds] = useState<string[]>([]);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [, setLeaseVersion] = useState<number>(0);
  const [githubReleases, setGithubReleases] = useState<GithubReleaseItem[]>(FALLBACK_LAUNCHPAD_RELEASES);
  const [selectedReleaseTag, setSelectedReleaseTag] = useState<string>(FALLBACK_LAUNCHPAD_RELEASES[0].tag_name);

  useEffect(() => {
    fetch("https://api.github.com/repos/aerovexsim/axiom/releases")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GithubReleaseItem[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          const list = [...data];
          if (!list.some((r) => r.tag_name === "v1.0.0")) {
            list.unshift(FALLBACK_LAUNCHPAD_RELEASES[0]);
          }
          setGithubReleases(list);
          setSelectedReleaseTag(list[0].tag_name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return subscribeToProjectLeases(() => setLeaseVersion((v) => v + 1));
  }, []);

  const activeProjects = projects.filter((p) => !p.isTrashed);
  const trashedProjects = projects.filter((p) => p.isTrashed);

  const toggleSelectActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedActiveProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectTrash = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrashProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllActive = () => {
    if (selectedActiveProjectIds.length === activeProjects.length) {
      setSelectedActiveProjectIds([]);
    } else {
      setSelectedActiveProjectIds(activeProjects.map((p) => p.id));
    }
  };

  const handleSelectAllTrash = () => {
    if (selectedTrashProjectIds.length === trashedProjects.length) {
      setSelectedTrashProjectIds([]);
    } else {
      setSelectedTrashProjectIds(trashedProjects.map((p) => p.id));
    }
  };

  const handleBatchTrash = async () => {
    const count = selectedActiveProjectIds.length;
    if (count === 0) return;
    const confirmed = await confirmDialog({
      title: t("launchpad.trashSelectedTitle"),
      message: t("launchpad.confirmTrashSelected").replace("{count}", String(count)),
      confirmText: t("launchpad.trashSelected").replace("{count}", String(count)),
      variant: "danger"
    });
    if (confirmed) {
      if (onTrashProjects) {
        onTrashProjects(selectedActiveProjectIds);
      } else if (onTrashProject) {
        selectedActiveProjectIds.forEach((id) => onTrashProject(id));
      }
      toast.info(`Moved ${count} projects to Trash`);
      setSelectedActiveProjectIds([]);
    }
  };

  const handleBatchRestore = () => {
    const count = selectedTrashProjectIds.length;
    if (count === 0) return;
    if (onRestoreProjects) {
      onRestoreProjects(selectedTrashProjectIds);
    } else if (onRestoreProject) {
      selectedTrashProjectIds.forEach((id) => onRestoreProject(id));
    }
    toast.success(`Restored ${count} projects to active`);
    setSelectedTrashProjectIds([]);
  };

  const handleBatchPermanentDelete = async () => {
    const count = selectedTrashProjectIds.length;
    if (count === 0) return;
    const confirmed = await confirmDialog({
      title: t("launchpad.deletePermanently"),
      message: t("launchpad.confirmDeletePermanentlySelected").replace("{count}", String(count)),
      confirmText: t("launchpad.deletePermanentlySelected").replace("{count}", String(count)),
      variant: "danger"
    });
    if (confirmed) {
      if (onPermanentDeleteProjects) {
        onPermanentDeleteProjects(selectedTrashProjectIds);
      } else if (onPermanentDeleteProject) {
        selectedTrashProjectIds.forEach((id) => onPermanentDeleteProject(id));
      }
      toast.info(`Permanently deleted ${count} projects`);
      setSelectedTrashProjectIds([]);
    }
  };

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
      case "class_examples_project":
        return <GraduationCap size={20} color="var(--accent-cyan)" />;
      default:
        return <Box size={20} color="var(--text-muted)" />;
    }
  };

  const currentRelease = githubReleases.find((r) => r.tag_name === selectedReleaseTag) || githubReleases[0];
  const winMsiUrl = currentRelease.assets.find((a) => a.name.endsWith(".msi"))?.browser_download_url
    || `https://github.com/aerovexsim/axiom/releases/download/${selectedReleaseTag}/Axiom_1.0.0_x64_en-US.msi`;
  const linuxDebUrl = currentRelease.assets.find((a) => a.name.endsWith(".deb"))?.browser_download_url
    || `https://github.com/aerovexsim/axiom/releases/download/${selectedReleaseTag}/axiom_1.0.0_amd64.deb`;
  const macDmgUrl = currentRelease.assets.find((a) => (a.name.includes("aarch64") || a.name.includes("arm64")) && a.name.endsWith(".dmg"))?.browser_download_url
    || `https://github.com/aerovexsim/axiom/releases/download/${selectedReleaseTag}/Axiom_1.0.0_aarch64.dmg`;

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
                v1.0.0
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

      {/* Native Desktop App Download Banner */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          marginBottom: 24,
          padding: "10px 16px",
          borderRadius: "var(--radius-md)",
          background: "linear-gradient(90deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
          border: "1px solid rgba(6, 182, 212, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(6, 182, 212, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-cyan)",
              flexShrink: 0
            }}
          >
            <Download size={16} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("launchpad.downloadDesktopTitle")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("launchpad.downloadDesktopSubtitle")}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Release Version Selector Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 2 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              {t("launchpad.version")}:
            </span>
            <select
              value={selectedReleaseTag}
              onChange={(e) => setSelectedReleaseTag(e.target.value)}
              className="mono-num"
              style={{
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "var(--bg-secondary)",
                color: "var(--accent-cyan)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 24px 3px 8px",
                cursor: "pointer",
                outline: "none"
              }}
            >
              {githubReleases.map((rel, idx) => (
                <option key={rel.tag_name} value={rel.tag_name}>
                  {rel.tag_name} {idx === 0 ? `(${t("launchpad.latest")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <a
            href={winMsiUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "var(--accent-blue)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              textDecoration: "none"
            }}
          >
            Windows (.msi)
          </a>
          <a
            href={linuxDebUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "var(--accent-purple)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              textDecoration: "none"
            }}
          >
            Linux (.deb)
          </a>
          <a
            href={macDmgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "var(--accent-emerald)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              textDecoration: "none"
            }}
          >
            macOS (.dmg)
          </a>
          <a
            href="https://axiom.aerovex.net/#download-desktop-studio-msi-deb-dmg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 3,
              textDecoration: "none",
              marginLeft: 4
            }}
          >
            <span>{t("launchpad.viewAllDownloads")}</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Main Action Cards: Create New Project vs Import */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={16} color="var(--accent-blue)" />
            <h2 style={{ fontSize: 13.5, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-primary)" }}>
              {t("launchpad.yourProjects")}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* New Independent Axiom Window Action */}
            <button
              onClick={() => openInNewWindow()}
              className="btn btn-ghost"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                color: "var(--accent-purple)",
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              title="Open a new independent Axiom window (Ctrl+Shift+W)"
            >
              <AppWindow size={13} color="var(--accent-purple)" />
              <span>{t("launchpad.newWindow")}</span>
            </button>

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
      </div>

        {projectsTab === "active" ? (
          activeProjects.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: 12 }}>
              {t("launchpad.noProjects")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Batch Action Toolbar for Active Projects */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSelectAllActive}
                    className="btn btn-ghost"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      fontSize: 11.5,
                      color: selectedActiveProjectIds.length > 0 ? "var(--accent-cyan)" : "var(--text-muted)"
                    }}
                  >
                    {selectedActiveProjectIds.length === activeProjects.length && activeProjects.length > 0 ? (
                      <CheckSquare size={14} color="var(--accent-cyan)" />
                    ) : (
                      <Square size={14} />
                    )}
                    <span>
                      {selectedActiveProjectIds.length === activeProjects.length && activeProjects.length > 0
                        ? t("launchpad.deselectAll")
                        : t("launchpad.selectAll")}
                    </span>
                  </button>

                  {selectedActiveProjectIds.length > 0 && (
                    <span
                      className="mono-num"
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: "var(--radius-xs)",
                        backgroundColor: "rgba(6, 182, 212, 0.15)",
                        color: "var(--accent-cyan)",
                        fontWeight: 600
                      }}
                    >
                      {selectedActiveProjectIds.length} {t("launchpad.selectedCount")}
                    </span>
                  )}
                </div>

                {selectedActiveProjectIds.length > 0 && (onTrashProjects || onTrashProject) && (
                  <button
                    type="button"
                    onClick={handleBatchTrash}
                    className="btn btn-danger"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      fontSize: 11.5,
                      fontWeight: 600
                    }}
                  >
                    <Trash2 size={12} />
                    <span>{t("launchpad.trashSelected").replace("{count}", String(selectedActiveProjectIds.length))}</span>
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {activeProjects.map((p) => {
                  const isLocked = isProjectActiveInAnotherSession(p.id);
                  const isSelected = selectedActiveProjectIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={async () => {
                        if (isLocked) {
                          const takeOver = await confirmDialog({
                            title: t("launchpad.takeOverTitle"),
                            message: t("launchpad.takeOverMessage").replace("{name}", p.name),
                            confirmText: t("launchpad.takeOverConfirm"),
                            variant: "warning"
                          });
                          if (takeOver) {
                            takeOverProjectLease(p.id, p.name);
                            onOpenProject?.(p.id);
                          }
                          return;
                        }
                        onOpenProject?.(p.id);
                      }}
                      className="axiom-card axiom-card-hover"
                      style={{
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        cursor: "pointer",
                        borderColor: isSelected
                          ? "var(--accent-cyan)"
                          : isLocked
                          ? "rgba(168, 85, 247, 0.3)"
                          : undefined,
                        backgroundColor: isSelected
                          ? "rgba(6, 182, 212, 0.04)"
                          : undefined
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => toggleSelectActive(p.id, e)}
                            title={isSelected ? t("launchpad.deselectAll") : t("launchpad.selectAll")}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              flexShrink: 0
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare size={15} color="var(--accent-cyan)" />
                            ) : (
                              <Square size={15} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                            )}
                          </button>
                          <Folder size={16} color={isLocked ? "var(--accent-purple)" : "var(--accent-cyan)"} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                        {isLocked && (
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: "1px 6px",
                              borderRadius: 4,
                              backgroundColor: "rgba(168, 85, 247, 0.15)",
                              color: "var(--accent-purple)",
                              border: "1px solid rgba(168, 85, 247, 0.3)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              flexShrink: 0
                            }}
                          >
                            <AppWindow size={10} />
                            {t("launchpad.activeInWindow")}
                          </span>
                        )}
                      </div>
                      {onTrashProject && (
                        <DropdownMenu
                          open={openMenuProjectId === p.id}
                          onOpenChange={(isOpen) => setOpenMenuProjectId(isOpen ? p.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              title="Project Options"
                              className="btn-icon"
                              style={{
                                padding: "3px 4px",
                                borderRadius: "var(--radius-sm)",
                                color: openMenuProjectId === p.id ? "var(--text-primary)" : "var(--text-muted)",
                                backgroundColor: openMenuProjectId === p.id ? "var(--bg-hover)" : "transparent"
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" minWidth={160}>
                            {isLocked && (
                              <DropdownMenuItem
                                icon={<ArrowRightCircle size={13} color="var(--accent-purple)" />}
                                onClick={() => {
                                  takeOverProjectLease(p.id, p.name);
                                  onOpenProject?.(p.id);
                                }}
                              >
                                {t("launchpad.takeOverAction")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              icon={<ExternalLink size={13} color="var(--accent-cyan)" />}
                              disabled={isLocked}
                              onClick={() => {
                                if (isLocked) {
                                  toast.warning(t("launchpad.alreadyOpenWarning").replace("{name}", p.name));
                                  return;
                                }
                                openInNewWindow(p.id, p.name);
                              }}
                            >
                              {t("launchpad.openInNewWindow")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="danger"
                              icon={<Trash2 size={13} />}
                              onClick={async () => {
                                const confirmed = await confirmDialog({
                                  title: t("launchpad.moveToTrash"),
                                  message: t("launchpad.confirmTrash").replace("{name}", p.name),
                                  confirmText: t("launchpad.moveToTrash"),
                                  variant: "danger"
                                });
                                if (confirmed) {
                                  onTrashProject(p.id);
                                  toast.info(`Moved "${p.name}" to Trash`);
                                }
                              }}
                            >
                              {t("launchpad.moveToTrash")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLocked) {
                              toast.warning(t("launchpad.alreadyOpenWarning").replace("{name}", p.name));
                              return;
                            }
                            onOpenProject(p.id);
                          }}
                          className="btn btn-primary"
                          style={{
                            height: 26,
                            padding: "2px 10px",
                            fontSize: 11,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            opacity: isLocked ? 0.6 : 1,
                            cursor: isLocked ? "not-allowed" : "pointer"
                          }}
                        >
                          <FolderOpen size={12} style={{ display: "inline-block", verticalAlign: "middle" }} />
                          <span style={{ lineHeight: 1 }}>{t("launchpad.openProject")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )
        ) : (
          trashedProjects.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: 12 }}>
              {t("launchpad.trashEmpty")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Batch Action Toolbar for Trashed Projects */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSelectAllTrash}
                    className="btn btn-ghost"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      fontSize: 11.5,
                      color: selectedTrashProjectIds.length > 0 ? "var(--accent-rose)" : "var(--text-muted)"
                    }}
                  >
                    {selectedTrashProjectIds.length === trashedProjects.length && trashedProjects.length > 0 ? (
                      <CheckSquare size={14} color="var(--accent-rose)" />
                    ) : (
                      <Square size={14} />
                    )}
                    <span>
                      {selectedTrashProjectIds.length === trashedProjects.length && trashedProjects.length > 0
                        ? t("launchpad.deselectAll")
                        : t("launchpad.selectAll")}
                    </span>
                  </button>

                  {selectedTrashProjectIds.length > 0 && (
                    <span
                      className="mono-num"
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: "var(--radius-xs)",
                        backgroundColor: "rgba(244, 63, 94, 0.15)",
                        color: "var(--accent-rose)",
                        fontWeight: 600
                      }}
                    >
                      {selectedTrashProjectIds.length} {t("launchpad.selectedCount")}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedTrashProjectIds.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleBatchRestore}
                        className="btn btn-cyan"
                        style={{
                          height: 26,
                          padding: "2px 10px",
                          fontSize: 11.5,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontWeight: 600
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>{t("launchpad.restoreSelected").replace("{count}", String(selectedTrashProjectIds.length))}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBatchPermanentDelete}
                        className="btn btn-danger"
                        style={{
                          height: 26,
                          padding: "2px 10px",
                          fontSize: 11.5,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontWeight: 600
                        }}
                      >
                        <Trash2 size={12} />
                        <span>{t("launchpad.deletePermanentlySelected").replace("{count}", String(selectedTrashProjectIds.length))}</span>
                      </button>
                    </>
                  )}

                  {onEmptyTrash && trashedProjects.length > 0 && (
                    <button
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: t("launchpad.emptyTrash"),
                          message: t("launchpad.confirmEmptyTrash"),
                          confirmText: t("launchpad.emptyTrash"),
                          variant: "danger"
                        });
                        if (confirmed) {
                          onEmptyTrash();
                          toast.success("Trash emptied");
                          setSelectedTrashProjectIds([]);
                        }
                      }}
                      className="btn btn-ghost"
                      style={{
                        height: 26,
                        padding: "2px 10px",
                        fontSize: 11,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "var(--accent-rose)",
                        border: "1px solid rgba(244, 63, 94, 0.3)"
                      }}
                    >
                      <Trash2 size={12} />
                      <span>{t("launchpad.emptyTrash")}</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {trashedProjects.map((p) => {
                  const isSelected = selectedTrashProjectIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="axiom-card"
                      style={{
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        opacity: 0.9,
                        border: isSelected ? "1px solid var(--accent-rose)" : "1px solid rgba(244, 63, 94, 0.25)",
                        backgroundColor: isSelected ? "rgba(244, 63, 94, 0.06)" : undefined
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={(e) => toggleSelectTrash(p.id, e)}
                            title={isSelected ? t("launchpad.deselectAll") : t("launchpad.selectAll")}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              flexShrink: 0
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare size={15} color="var(--accent-rose)" />
                            ) : (
                              <Square size={15} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                            )}
                          </button>
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
                          onClick={() => {
                            onRestoreProject(p.id);
                            toast.success(`Restored "${p.name}" to active projects`);
                          }}
                          className="btn btn-cyan"
                          style={{
                            height: 24,
                            padding: "2px 8px",
                            fontSize: 11,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <RotateCcw size={11} style={{ display: "inline-block", verticalAlign: "middle" }} />
                          <span style={{ lineHeight: 1 }}>{t("launchpad.restoreProject")}</span>
                        </button>
                      )}
                      {onPermanentDeleteProject && (
                        <button
                          onClick={async () => {
                            const confirmed = await confirmDialog({
                              title: t("launchpad.deletePermanently"),
                              message: t("launchpad.confirmDelete").replace("{name}", p.name),
                              confirmText: t("launchpad.deletePermanently"),
                              variant: "danger"
                            });
                            if (confirmed) {
                              onPermanentDeleteProject(p.id);
                              toast.info(`Permanently deleted "${p.name}"`);
                            }
                          }}
                          className="btn btn-danger"
                          style={{
                            height: 24,
                            padding: "2px 8px",
                            fontSize: 11,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <Trash2 size={11} style={{ display: "inline-block", verticalAlign: "middle" }} />
                          <span style={{ lineHeight: 1 }}>{t("launchpad.deletePermanently")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
          {PROJECT_TEMPLATES.map((tmpl: ProjectTemplate) => {
            if (tmpl.id === "class_examples_project") {
              return (tmpl.lessons ?? []).map((lesson) => (
                <div
                  key={`${tmpl.id}_${lesson.id}`}
                  onClick={() => onOpenNewProject(tmpl.id, lesson.id)}
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
                      <GraduationCap size={16} color="var(--accent-cyan)" />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {lesson.title}: {lesson.subtitle.split("—")[0].trim()}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: "var(--radius-xs)",
                            backgroundColor: "rgba(6, 182, 212, 0.15)",
                            color: "var(--accent-cyan)",
                            border: "1px solid rgba(6, 182, 212, 0.3)"
                          }}
                        >
                          IUC
                        </span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>
                    {lesson.description}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 7, borderTop: "1px solid var(--border-subtle)" }}>
                    <span className="mono-num" style={{ fontSize: 10.5, color: "var(--accent-cyan)" }}>
                      Basys 3 (Artix-7)
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                      <span>{t("launchpad.createTemplate")}</span>
                      <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              ));
            }

            return (
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

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 7, borderTop: "1px solid var(--border-subtle)" }}>
                  <span className="mono-num" style={{ fontSize: 10.5, color: "var(--accent-cyan)" }}>
                    {tmpl.defaultDevice.includes("xc7a35t") ? "Artix-7" : tmpl.defaultDevice.includes("xc7z020") ? "Zynq-7000" : "Kintex"}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                    <span>{t("launchpad.createTemplate")}</span>
                    <ChevronRight size={11} />
                  </span>
                </div>
              </div>
            );
          })}
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
          <span>{t("launchpad.rustLspLinter")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <Code2 size={15} color="var(--accent-blue)" />
          <span>{t("launchpad.vivadoFileSets")}</span>
        </div>
      </div>

      {/* Open Source Collaboration Footer Note */}
      <div
        style={{
          maxWidth: 840,
          width: "100%",
          textAlign: "center",
          marginTop: 18,
          paddingTop: 16,
          borderTop: "1px dashed var(--border-subtle)",
          fontSize: 11.5,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <GithubIcon size={14} color="var(--text-secondary)" />
          <span>{t("launchpad.openSourceNotice")}</span>
        </span>
        <a
          href="https://github.com/aerovexsim/axiom"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--accent-blue)",
            textDecoration: "none",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <span>{t("launchpad.githubContributions")}</span>
          <ChevronRight size={12} />
        </a>
      </div>
    </div>
  );
};
