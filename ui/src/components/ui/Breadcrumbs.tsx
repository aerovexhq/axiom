import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  highlight?: boolean;
  color?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  rightContent?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  rightContent,
  style
}) => {
  return (
    <div
      style={{
        height: 28,
        backgroundColor: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        color: "var(--text-muted)",
        overflow: "hidden",
        userSelect: "none",
        ...style
      }}
    >
      {/* Left: Truncated, Non-Colliding Breadcrumb Segments */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          overflow: "hidden",
          flex: 1
        }}
      >
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <ChevronRight
                size={12}
                color="var(--text-muted)"
                style={{ flexShrink: 0, opacity: 0.6 }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                minWidth: 0,
                flexShrink: idx === items.length - 1 ? 0 : 1
              }}
              title={item.label}
            >
              {item.icon && (
                <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>
              )}
              <span
                style={{
                  maxWidth: idx === 0 ? 140 : 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: item.highlight ? 600 : 400,
                  color: item.color
                    ? item.color
                    : item.highlight
                    ? "var(--accent-cyan)"
                    : "var(--text-secondary)"
                }}
              >
                {item.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Right: Status Pill/Metadata Strip (Never Collides or Wraps) */}
      {rightContent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            marginLeft: 12,
            fontSize: 11,
            color: "var(--text-muted)",
            whiteSpace: "nowrap"
          }}
        >
          {rightContent}
        </div>
      )}
    </div>
  );
};
