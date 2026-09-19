import React from "react";
import { X } from "lucide-react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
  size?: "xs" | "sm" | "md";
  clearable?: boolean;
  onClear?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  icon,
  mono = false,
  fullWidth = true,
  size = "md",
  clearable = false,
  onClear,
  style,
  disabled,
  ...rest
}) => {
  const sizeConfig = {
    xs: {
      height: 24,
      padding: "2px 7px",
      fontSize: 11,
      iconPadding: 26,
      radius: "var(--radius-sm)",
      clearIconSize: 10
    },
    sm: {
      height: 28,
      padding: "3px 9px",
      fontSize: 12,
      iconPadding: 30,
      radius: "var(--radius-sm)",
      clearIconSize: 11
    },
    md: {
      height: 34,
      padding: "6px 12px",
      fontSize: 13,
      iconPadding: 34,
      radius: "var(--radius-md)",
      clearIconSize: 13
    }
  }[size];

  const hasValue = rest.value !== undefined && rest.value !== "" && rest.value !== null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: fullWidth ? "100%" : "auto",
        fontFamily: "var(--font-sans)"
      }}
    >
      {label && (
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.04em"
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 8,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              color: "var(--text-muted)",
              zIndex: 1
            }}
          >
            {icon}
          </span>
        )}

        <input
          disabled={disabled}
          style={{
            width: "100%",
            height: sizeConfig.height,
            padding: sizeConfig.padding,
            paddingLeft: icon ? sizeConfig.iconPadding : undefined,
            paddingRight: clearable && hasValue ? sizeConfig.iconPadding : undefined,
            fontSize: sizeConfig.fontSize,
            fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: `1px solid ${error ? "var(--accent-rose)" : "var(--border-subtle)"}`,
            borderRadius: sizeConfig.radius,
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            opacity: disabled ? 0.6 : 1,
            boxSizing: "border-box",
            ...style
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? "var(--accent-rose)" : "var(--accent-blue)";
            e.currentTarget.style.boxShadow = error
              ? "0 0 0 2px rgba(244, 63, 94, 0.2)"
              : "0 0 0 2px rgba(59, 130, 246, 0.2)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "var(--accent-rose)" : "var(--border-subtle)";
            e.currentTarget.style.boxShadow = "none";
          }}
          {...rest}
        />

        {clearable && hasValue && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="btn-icon"
            style={{
              position: "absolute",
              right: 6,
              padding: 2,
              borderRadius: "50%",
              color: "var(--text-muted)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={sizeConfig.clearIconSize} />
          </button>
        )}
      </div>

      {error && (
        <span style={{ fontSize: 11, color: "var(--accent-rose)", marginTop: 4 }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
