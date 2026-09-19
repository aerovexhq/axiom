import React from "react";
import { FileCode, Cpu, Sliders, Activity, Terminal, AlertCircle } from "lucide-react";
import { MobilePanelType } from "./MobileDrawer";
import { useTranslation } from "../i18n/i18nContext";

interface MobileBottomBarProps {
  activePanel: MobilePanelType;
  onSelectPanel: (panel: MobilePanelType) => void;
  diagnosticCount?: number;
  glitchCount?: number;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activePanel,
  onSelectPanel,
  diagnosticCount = 0,
  glitchCount = 0
}) => {
  const { t } = useTranslation();

  const tabs: Array<{
    id: MobilePanelType;
    label: string;
    icon: React.ReactNode;
    activeColor: string;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: "editor",
      label: t.mobile.code,
      icon: <FileCode size={19} />,
      activeColor: "var(--accent-blue)"
    },
    {
      id: "schematic",
      label: t.mobile.schematic,
      icon: <Cpu size={19} />,
      activeColor: "var(--accent-cyan)"
    },
    {
      id: "virtuallab",
      label: t.mobile.lab,
      icon: <Sliders size={19} />,
      activeColor: "var(--accent-amber)"
    },
    {
      id: "waveform",
      label: t.mobile.waves,
      icon: <Activity size={19} />,
      activeColor: "var(--accent-emerald)"
    },
    {
      id: "dock",
      label: t.mobile.console,
      icon: diagnosticCount > 0 ? <AlertCircle size={19} /> : <Terminal size={19} />,
      activeColor: diagnosticCount > 0 ? "var(--accent-rose)" : "var(--accent-purple)",
      badge: diagnosticCount > 0 ? diagnosticCount : glitchCount > 0 ? glitchCount : undefined,
      badgeColor: diagnosticCount > 0 ? "var(--accent-rose)" : "var(--signal-glitch)"
    }
  ];

  return (
    <nav
      style={{
        position: "relative",
        width: "100%",
        flexShrink: 0,
        height: "calc(52px + env(safe-area-inset-bottom, 0px))",
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-around",
        zIndex: 30,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.4)"
      }}
    >
      {tabs.map((tab) => {
        const isActive = activePanel === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectPanel(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
              color: isActive ? tab.activeColor : "var(--text-muted)",
              position: "relative",
              transition: "color 0.15s ease, transform 0.1s ease"
            }}
          >
            {/* Active Indicator Strip */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "25%",
                  right: "25%",
                  height: 2.5,
                  borderRadius: "0 0 2px 2px",
                  backgroundColor: tab.activeColor
                }}
              />
            )}

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -9,
                    backgroundColor: tab.badgeColor ?? "var(--accent-rose)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 8,
                    padding: "0 4px",
                    minWidth: 14,
                    height: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1
                  }}
                >
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: 10.5,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: "-0.01em"
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
