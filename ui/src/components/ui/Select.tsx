import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: (SelectOption | string)[];
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: (SelectOption | string)[];
  groups?: SelectGroup[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "xs" | "sm" | "md";
  align?: "left" | "right";
  variant?: "default" | "subtle" | "ghost";
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  groups,
  label,
  placeholder = "Select an option...",
  disabled = false,
  fullWidth = false,
  size = "md",
  align = "left",
  variant = "default",
  style,
  buttonStyle,
  menuStyle,
  className = "",
  title
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectId = useId();

  // Normalize all options into a single flat list for lookup and keyboard navigation
  const allNormalizedOptions: SelectOption[] = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((g) =>
        g.options.map((opt) =>
          typeof opt === "string" ? { value: opt, label: opt } : opt
        )
      );
    }
    if (options && options.length > 0) {
      return options.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      );
    }
    return [];
  }, [options, groups]);

  const selectedOption = allNormalizedOptions.find((opt) => opt.value === value);

  // Close on outside click
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

  // Handle Escape and keyboard navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleGlobalKeyDown);
    }
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen]);

  // Sizing definitions
  const sizeConfig = {
    xs: {
      height: 24,
      padding: "2px 7px",
      fontSize: 11,
      chevronSize: 11,
      itemPadding: "4px 8px",
      itemFontSize: 11,
      radius: "var(--radius-sm)"
    },
    sm: {
      height: 28,
      padding: "3px 9px",
      fontSize: 12,
      chevronSize: 13,
      itemPadding: "5px 9px",
      itemFontSize: 12,
      radius: "var(--radius-sm)"
    },
    md: {
      height: 34,
      padding: "6px 12px",
      fontSize: 13,
      chevronSize: 14,
      itemPadding: "7px 10px",
      itemFontSize: 12.5,
      radius: "var(--radius-md)"
    }
  }[size];

  // Background variants
  const getBackground = () => {
    if (variant === "ghost") return "transparent";
    if (variant === "subtle") return "var(--bg-secondary)";
    return "var(--bg-tertiary)";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        const idx = allNormalizedOptions.findIndex((o) => o.value === value);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next < allNormalizedOptions.length ? next : 0;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next >= 0 ? next : allNormalizedOptions.length - 1;
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < allNormalizedOptions.length) {
        const chosen = allNormalizedOptions[highlightedIndex];
        if (!chosen.disabled) {
          onChange(chosen.value);
          setIsOpen(false);
        }
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const renderOptionItem = (opt: SelectOption, indexInAll: number) => {
    const isSelected = opt.value === value;
    const isHighlighted = highlightedIndex === indexInAll;

    return (
      <div
        key={opt.value}
        role="option"
        aria-selected={isSelected}
        onClick={() => {
          if (!opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
          }
        }}
        onMouseEnter={() => setHighlightedIndex(indexInAll)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: sizeConfig.itemPadding,
          borderRadius: "var(--radius-sm)",
          backgroundColor: isSelected
            ? "rgba(59, 130, 246, 0.16)"
            : isHighlighted
            ? "rgba(255, 255, 255, 0.06)"
            : "transparent",
          color: isSelected ? "#fff" : opt.disabled ? "var(--text-muted)" : "var(--text-primary)",
          cursor: opt.disabled ? "not-allowed" : "pointer",
          fontSize: sizeConfig.itemFontSize,
          fontFamily: "var(--font-sans)",
          userSelect: "none",
          transition: "background-color 0.1s ease, color 0.1s ease",
          opacity: opt.disabled ? 0.5 : 1,
          gap: 6
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden", minWidth: 0 }}>
          {opt.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {opt.icon}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, overflow: "hidden" }}>
            <span
              style={{
                fontWeight: isSelected ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {opt.label}
            </span>
            {opt.sublabel && (
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                {opt.sublabel}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 8 }}>
          {opt.badge && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: "1px 5px",
                borderRadius: 3,
                backgroundColor: "rgba(6, 182, 212, 0.14)",
                color: "var(--accent-cyan)",
                border: "1px solid rgba(6, 182, 212, 0.28)"
              }}
            >
              {opt.badge}
            </span>
          )}
          {isSelected && (
            <Check size={size === "xs" ? 11 : 13} color="var(--accent-blue)" />
          )}
        </div>
      </div>
    );
  };

  let globalIndexCounter = 0;

  return (
    <div
      ref={containerRef}
      className={`axiom-select-container ${className}`}
      style={{
        position: "relative",
        width: fullWidth ? "100%" : "auto",
        display: fullWidth ? "block" : "inline-block",
        fontFamily: "var(--font-sans)",
        ...style
      }}
    >
      {label && (
        <label
          htmlFor={selectId}
          style={{
            display: "block",
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

      {/* Select Trigger Box */}
      <button
        id={selectId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        title={title}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        style={{
          width: fullWidth ? "100%" : "auto",
          minWidth: fullWidth ? "100%" : size === "xs" ? 72 : 110,
          height: sizeConfig.height,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: sizeConfig.padding,
          backgroundColor: getBackground(),
          color: selectedOption ? "var(--text-primary)" : "var(--text-muted)",
          border: `1px solid ${isOpen ? "var(--border-focus)" : "var(--border-subtle)"}`,
          borderRadius: sizeConfig.radius,
          fontSize: sizeConfig.fontSize,
          fontFamily: "var(--font-sans)",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(59, 130, 246, 0.25)" : "none",
          opacity: disabled ? 0.55 : 1,
          gap: 6,
          userSelect: "none",
          ...buttonStyle
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span
            style={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span style={{ color: "var(--text-muted)", fontSize: sizeConfig.fontSize - 1, fontWeight: 400 }}>
              {selectedOption.sublabel}
            </span>
          )}
        </div>

        <ChevronDown
          size={sizeConfig.chevronSize}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            flexShrink: 0,
            marginLeft: 2
          }}
        />
      </button>

      {/* Custom Dropdown Popover Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          className="axiom-popover custom-scrollbar"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            minWidth: fullWidth ? "100%" : 130,
            width: fullWidth ? "100%" : "max-content",
            maxWidth: 320,
            backgroundColor: "#0e1318",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06)",
            zIndex: 10000,
            maxHeight: 260,
            overflowY: "auto",
            padding: 4,
            ...menuStyle
          }}
        >
          {groups && groups.length > 0 ? (
            groups.map((grp, grpIdx) => {
              const grpOptions: SelectOption[] = grp.options.map((opt) =>
                typeof opt === "string" ? { value: opt, label: opt } : opt
              );

              return (
                <div key={grp.label || grpIdx}>
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "5px 8px 3px",
                      borderTop: grpIdx > 0 ? "1px solid var(--border-subtle)" : "none",
                      marginTop: grpIdx > 0 ? 4 : 0
                    }}
                  >
                    {grp.label}
                  </div>
                  {grpOptions.map((opt) => {
                    const idx = globalIndexCounter++;
                    return renderOptionItem(opt, idx);
                  })}
                </div>
              );
            })
          ) : (
            allNormalizedOptions.map((opt) => {
              const idx = globalIndexCounter++;
              return renderOptionItem(opt, idx);
            })
          )}
        </div>
      )}
    </div>
  );
};
