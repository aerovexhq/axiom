import React from "react";

export type BadgeColor = "blue" | "cyan" | "emerald" | "amber" | "rose" | "purple" | "slate";
export type BadgeVariant = "subtle" | "outline" | "filled";

export interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color = "slate",
  variant = "subtle",
  size = "sm",
  icon,
  style
}) => {
  const colorMap: Record<BadgeColor, { main: string; bgSubtle: string; bgFilled: string }> = {
    blue: { main: "var(--accent-blue)", bgSubtle: "rgba(59, 130, 246, 0.15)", bgFilled: "var(--accent-blue)" },
    cyan: { main: "var(--accent-cyan)", bgSubtle: "rgba(6, 182, 212, 0.15)", bgFilled: "var(--accent-cyan)" },
    emerald: { main: "var(--accent-emerald)", bgSubtle: "rgba(16, 185, 129, 0.15)", bgFilled: "var(--accent-emerald)" },
    amber: { main: "var(--accent-amber)", bgSubtle: "rgba(245, 158, 11, 0.15)", bgFilled: "var(--accent-amber)" },
    rose: { main: "var(--accent-rose)", bgSubtle: "rgba(244, 63, 94, 0.15)", bgFilled: "var(--accent-rose)" },
    purple: { main: "var(--accent-purple)", bgSubtle: "rgba(139, 92, 246, 0.15)", bgFilled: "var(--accent-purple)" },
    slate: { main: "var(--text-muted)", bgSubtle: "var(--bg-tertiary)", bgFilled: "var(--border-strong)" }
  };

  const theme = colorMap[color] || colorMap.slate;

  let bg = theme.bgSubtle;
  let text = theme.main;
  let border = `1px solid ${theme.bgSubtle}`;

  if (variant === "outline") {
    bg = "transparent";
    border = `1px solid ${theme.main}`;
    text = theme.main;
  } else if (variant === "filled") {
    bg = theme.bgFilled;
    border = `1px solid ${theme.bgFilled}`;
    text = "#ffffff";
  }

  const padding = size === "sm" ? "1px 6px" : "3px 8px";
  const fontSize = size === "sm" ? 10.5 : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        fontSize,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: bg,
        color: text,
        border,
        whiteSpace: "nowrap",
        userSelect: "none",
        ...style
      }}
    >
      {icon && <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
