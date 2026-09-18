import React from "react";
import { X } from "lucide-react";

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  closable?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  rightAction?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  rightAction,
  style
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 38,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 8px",
        overflowX: "auto",
        fontFamily: "var(--font-sans)",
        userSelect: "none",
        ...style
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", flex: 1, minWidth: 0 }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                borderTop: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                borderLeft: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                borderRight: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                cursor: "pointer",
                fontSize: 12.5,
                color: isActive ? "#fff" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
                maxWidth: 220,
                transition: "color 0.1s ease, background-color 0.1s ease"
              }}
            >
              {tab.icon && <span style={{ display: "flex", flexShrink: 0 }}>{tab.icon}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tab.label}
              </span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: tab.badgeColor || "var(--accent-cyan)",
                    backgroundColor: "rgba(6, 182, 212, 0.15)",
                    padding: "1px 5px",
                    borderRadius: 3
                  }}
                >
                  {tab.badge}
                </span>
              )}
              {tab.closable && onCloseTab && tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close Tab"
                  style={{
                    padding: "1px 2px",
                    color: "var(--text-muted)",
                    borderRadius: 2,
                    marginLeft: 2,
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {rightAction && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {rightAction}
        </div>
      )}
    </div>
  );
};
