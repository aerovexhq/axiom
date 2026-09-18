import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  icon,
  mono = false,
  fullWidth = true,
  style,
  disabled,
  ...rest
}) => {
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
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.03em"
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 10,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              color: "var(--text-muted)"
            }}
          >
            {icon}
          </span>
        )}

        <input
          disabled={disabled}
          style={{
            width: "100%",
            padding: "8px 12px",
            paddingLeft: icon ? 34 : 12,
            fontSize: 13,
            fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: `1px solid ${error ? "var(--accent-rose)" : "var(--border-subtle)"}`,
            borderRadius: "var(--radius-md)",
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            opacity: disabled ? 0.6 : 1,
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
