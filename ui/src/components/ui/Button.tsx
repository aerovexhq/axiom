import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  style,
  ...rest
}) => {
  let padding = "7px 14px";
  let fontSize = 13;
  let gap = 6;

  if (size === "xs") {
    padding = "3px 7px";
    fontSize = 11;
    gap = 4;
  } else if (size === "sm") {
    padding = "5px 10px";
    fontSize = 12;
    gap = 5;
  } else if (size === "lg") {
    padding = "10px 20px";
    fontSize = 14;
    gap = 8;
  }

  let bg = "var(--bg-tertiary)";
  let color = "var(--text-primary)";
  let border = "1px solid var(--border-subtle)";
  let fontWeight = 500;

  switch (variant) {
    case "primary":
      bg = "var(--accent-blue)";
      color = "#ffffff";
      border = "1px solid var(--accent-blue)";
      fontWeight = 600;
      break;
    case "accent":
      bg = "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)";
      color = "#ffffff";
      border = "1px solid rgba(56, 189, 248, 0.4)";
      fontWeight = 600;
      break;
    case "danger":
      bg = "rgba(244, 63, 94, 0.15)";
      color = "var(--accent-rose)";
      border = "1px solid rgba(244, 63, 94, 0.3)";
      break;
    case "ghost":
      bg = "transparent";
      color = "var(--text-secondary)";
      border = "1px solid transparent";
      break;
    case "outline":
      bg = "transparent";
      color = "var(--text-primary)";
      border = "1px solid var(--border-strong)";
      break;
    case "secondary":
    default:
      bg = "var(--bg-tertiary)";
      color = "var(--text-primary)";
      border = "1px solid var(--border-subtle)";
      break;
  }

  return (
    <button
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        padding,
        fontSize,
        fontWeight,
        fontFamily: "var(--font-sans)",
        backgroundColor: bg,
        color,
        border,
        borderRadius: "var(--radius-md)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : "auto",
        transition: "all 0.15s ease",
        outline: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
        ...style
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          if (variant === "ghost") e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          else if (variant === "secondary") e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          else if (variant === "primary") e.currentTarget.style.opacity = "0.92";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          if (variant === "ghost") e.currentTarget.style.backgroundColor = "transparent";
          else if (variant === "secondary") e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
          else if (variant === "primary") e.currentTarget.style.opacity = "1";
        }
      }}
      {...rest}
    >
      {icon && <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>}
      {children && <span>{children}</span>}
      {iconRight && <span style={{ display: "flex", flexShrink: 0 }}>{iconRight}</span>}
    </button>
  );
};
