import React, { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { useTranslation, SupportedLanguage } from "../i18n";

interface LanguageDropdownProps {
  align?: "left" | "right";
  className?: string;
  buttonStyle?: React.CSSProperties;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  align = "right",
  className = "",
  buttonStyle
}) => {
  const { language, setLanguage, languages, t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguageInfo = React.useMemo(() => {
    return languages.find((l) => l.code === language);
  }, [languages, language]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (code: SupportedLanguage) => {
      setLanguage(code);
      setIsOpen(false);
    },
    [setLanguage]
  );

  return (
    <div
      ref={dropdownRef}
      className={className}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {/* Sleek Trigger Button (Flag Only) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("header.language")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`${t("header.language")} (${currentLanguageInfo?.nativeName ?? "English"})`}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isOpen ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.03)",
          border: isOpen ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid var(--border-subtle)",
          borderRadius: 6,
          cursor: "pointer",
          transition: "all 0.15s ease",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 1px rgba(56, 189, 248, 0.2)" : "none",
          ...buttonStyle
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            e.currentTarget.style.borderColor = "var(--border-strong)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
            e.currentTarget.style.borderColor = "var(--border-subtle)";
          }
        }}
      >
        <span
          style={{
            fontSize: 16,
            lineHeight: 1,
            userSelect: "none",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
          }}
        >
          {currentLanguageInfo?.flag || "🇺🇸"}
        </span>
      </button>

      {/* Aerospace Acrylic Popover Menu */}
      {isOpen && (
        <div
          className="axiom-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            minWidth: 235,
            width: 235,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            boxShadow: "0 16px 36px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            padding: 4,
            zIndex: 1000,
            overflow: "hidden",
            userSelect: "none"
          }}
        >
          {/* Subtle Popover Header */}
          <div
            style={{
              padding: "5px 8px 6px 8px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 4
            }}
          >
            {t("header.language")}
          </div>

          {/* Language Item Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {languages.map((l) => {
              const isSelected = l.code === language;
              const hasSubname = l.name !== l.nativeName;

              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelect(l.code as SupportedLanguage)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "6px 8px",
                    border: "none",
                    borderRadius: 5,
                    backgroundColor: isSelected ? "rgba(56, 189, 248, 0.1)" : "transparent",
                    color: isSelected ? "var(--accent-cyan)" : "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background-color 0.12s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {/* Left: Flag & Native Name + (English Name) */}
                  <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: 8 }}>
                    <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{l.flag}</span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "var(--accent-cyan)" : "var(--text-primary)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {l.nativeName}
                    </span>
                    {hasSubname && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        ({l.name})
                      </span>
                    )}
                  </div>

                  {/* Right: Muted 2-Letter Code & Checkmark */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: isSelected ? "var(--accent-cyan)" : "var(--text-muted)",
                        opacity: isSelected ? 0.9 : 0.6
                      }}
                    >
                      {l.code.toUpperCase()}
                    </span>
                    {isSelected ? (
                      <Check size={13} color="var(--accent-cyan)" strokeWidth={2.5} />
                    ) : (
                      <span style={{ width: 13 }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
