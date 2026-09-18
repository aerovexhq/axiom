import React from "react";

export interface CardProps {
  children: React.ReactNode;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  selected = false,
  clickable = false,
  onClick,
  style
}) => {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        padding: "14px 16px",
        backgroundColor: selected ? "rgba(59, 130, 246, 0.08)" : "var(--bg-tertiary)",
        border: `1px solid ${selected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-md)",
        cursor: clickable ? "pointer" : "default",
        transition: "all 0.15s ease",
        fontFamily: "var(--font-sans)",
        userSelect: "none",
        ...style
      }}
      onMouseEnter={(e) => {
        if (clickable && !selected) {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (clickable && !selected) {
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
        }
      }}
    >
      {children}
    </div>
  );
};
