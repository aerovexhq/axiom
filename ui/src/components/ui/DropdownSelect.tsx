import type { ReactNode, CSSProperties, MouseEvent } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "./DropdownMenu";

export interface DropdownSelectOption<T extends string | number = string> {
  value: T;
  label: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownSelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownSelectOption<T>[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  buttonStyle?: CSSProperties;
  contentStyle?: CSSProperties;
  align?: "start" | "end" | "center";
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  minWidth?: number | string;
  title?: string;
}

export function DropdownSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
  style,
  buttonStyle,
  contentStyle,
  align = "start",
  disabled = false,
  size = "sm",
  minWidth,
  title
}: DropdownSelectProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value);

  // Size metrics
  const height = size === "xs" ? 22 : size === "md" ? 30 : 26;
  const fontSize = size === "xs" ? 11 : size === "md" ? 12.5 : 11.5;
  const padding = size === "xs" ? "0 6px" : size === "md" ? "0 10px" : "0 8px";
  const iconSize = size === "xs" ? 11 : 12;

  return (
    <DropdownMenu style={{ width: style?.width || "auto", ...style }} className={className}>
      <DropdownMenuTrigger
        disabled={disabled}
        title={title}
        style={{
          height,
          padding,
          fontSize,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          color: disabled ? "var(--text-muted)" : "var(--text-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 500,
          whiteSpace: "nowrap",
          userSelect: "none",
          transition: "all var(--transition-fast)",
          outline: "none",
          boxSizing: "border-box",
          width: "100%",
          ...buttonStyle
        }}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          }
        }}
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.backgroundColor = (buttonStyle?.backgroundColor as string) || "var(--bg-tertiary)";
          }
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left"
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={iconSize}
          color="var(--text-muted)"
          style={{ flexShrink: 0, marginLeft: 2 }}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        minWidth={minWidth || "100%"}
        style={{
          maxHeight: 280,
          overflowY: "auto",
          ...contentStyle
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <DropdownMenuItem
              key={String(opt.value)}
              disabled={opt.disabled}
              selected={isSelected}
              trailing={
                isSelected ? (
                  <Check size={12} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
                ) : undefined
              }
              onClick={() => {
                if (!opt.disabled && opt.value !== value) {
                  onChange(opt.value);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontSize,
                fontWeight: isSelected ? 600 : 400
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt.icon && (
                    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                      {opt.icon}
                    </span>
                  )}
                  <span style={{ color: isSelected ? "var(--accent-blue)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.label}
                  </span>
                </div>
                {opt.subtitle && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: opt.icon ? 18 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.subtitle}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
