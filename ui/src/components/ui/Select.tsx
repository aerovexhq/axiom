import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = "Select an option...",
  disabled = false,
  fullWidth = true,
  style
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: fullWidth ? "100%" : "auto",
        display: "inline-block",
        fontFamily: "var(--font-sans)",
        ...style
      }}
    >
      {label && (
        <label
          style={{
            display: "block",
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

      {/* Select Trigger Box */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          backgroundColor: "var(--bg-tertiary)",
          color: selectedOption ? "var(--text-primary)" : "var(--text-muted)",
          border: `1px solid ${isOpen ? "var(--accent-blue)" : "var(--border-subtle)"}`,
          borderRadius: "var(--radius-md)",
          fontSize: 13,
          fontFamily: "var(--font-sans)",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(59, 130, 246, 0.2)" : "none",
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption?.icon && <span style={{ display: "flex", flexShrink: 0 }}>{selectedOption.icon}</span>}
          <span style={{ fontWeight: 500 }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span style={{ color: "var(--text-muted)", fontSize: 11.5, fontWeight: 400 }}>
              {selectedOption.sublabel}
            </span>
          )}
        </div>

        <ChevronDown
          size={15}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
            marginLeft: 8
          }}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            backgroundColor: "#13171d",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.75)",
            zIndex: 10000,
            maxHeight: 240,
            overflowY: "auto",
            padding: 4
          }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  color: isSelected ? "#fff" : "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontFamily: "var(--font-sans)",
                  transition: "background-color 0.1s ease",
                  userSelect: "none"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  {opt.icon && <span style={{ display: "flex", flexShrink: 0 }}>{opt.icon}</span>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{opt.label}</span>
                    {opt.sublabel && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{opt.sublabel}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--accent-cyan)",
                        border: "1px solid var(--border-subtle)"
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check size={14} color="var(--accent-blue)" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
