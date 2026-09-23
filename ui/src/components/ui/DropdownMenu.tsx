// Axiom EDA — Unified Dark Acrylic Dropdown & Context Menu Primitives
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
  CSSProperties,
  isValidElement,
  cloneElement
} from "react";

interface DropdownMenuContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export const useDropdownMenu = (): DropdownMenuContextValue => {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error("useDropdownMenu must be used within a DropdownMenu");
  }
  return ctx;
};

export interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
  style
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const close = () => setIsOpen(false);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, close }}>
      <div
        ref={containerRef}
        className={className}
        style={{ position: "relative", display: "inline-flex", ...style }}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export interface DropdownMenuTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  disabled?: boolean;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  asChild = false,
  className,
  style,
  title,
  disabled = false,
  onMouseEnter,
  onMouseLeave
}) => {
  const { isOpen, setIsOpen } = useDropdownMenu();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        handleToggle(e);
        child.props.onClick?.(e);
      },
      "aria-expanded": isOpen,
      "aria-haspopup": "menu"
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      className={className}
      style={style}
      title={title}
      aria-expanded={isOpen}
      aria-haspopup="menu"
    >
      {children}
    </button>
  );
};

export interface DropdownMenuContentProps {
  children: ReactNode;
  align?: "start" | "end" | "center";
  side?: "bottom" | "top";
  className?: string;
  style?: CSSProperties;
  minWidth?: number | string;
  zIndex?: number;
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  align = "end",
  side = "bottom",
  className,
  style,
  minWidth = 160,
  zIndex = 100
}) => {
  const { isOpen } = useDropdownMenu();

  if (!isOpen) return null;

  return (
    <div
      role="menu"
      className={`axiom-dropdown-menu ${className || ""}`}
      style={{
        position: "absolute",
        top: side === "bottom" ? "calc(100% + 4px)" : undefined,
        bottom: side === "top" ? "calc(100% + 4px)" : undefined,
        left: align === "start" ? 0 : align === "center" ? "50%" : undefined,
        right: align === "end" ? 0 : undefined,
        transform: align === "center" ? "translateX(-50%)" : undefined,
        minWidth,
        width: "max-content",
        maxWidth: "calc(100vw - 32px)",
        whiteSpace: "nowrap",
        zIndex,
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

export interface DropdownMenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  trailing?: ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
  selected?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
  closeOnClick?: boolean;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  icon,
  shortcut,
  trailing,
  variant = "default",
  disabled = false,
  selected = false,
  onClick,
  className,
  style,
  closeOnClick = true
}) => {
  const { close } = useDropdownMenu();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) return;
    onClick?.(e);
    if (closeOnClick) {
      close();
    }
  };

  const itemClass = [
    "axiom-menu-item",
    variant === "danger" ? "axiom-menu-item-danger" : "",
    selected ? "axiom-menu-item-selected" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={itemClass}
      style={{ whiteSpace: "nowrap", ...style }}
    >
      {icon && (
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
          {icon}
        </span>
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "inline-flex",
          flexDirection: "column",
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {children}
      </span>
      {trailing && (
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
          {trailing}
        </span>
      )}
      {shortcut && (
        <span
          className="mono-num"
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            backgroundColor: "var(--bg-tertiary)",
            padding: "1px 5px",
            borderRadius: 3,
            marginLeft: 12,
            flexShrink: 0,
            whiteSpace: "nowrap"
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};

export interface DropdownMenuSeparatorProps {
  className?: string;
  style?: CSSProperties;
}

export const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({
  className,
  style
}) => (
  <div
    role="separator"
    className={`axiom-menu-separator ${className || ""}`}
    style={style}
  />
);

export interface DropdownMenuLabelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const DropdownMenuLabel: React.FC<DropdownMenuLabelProps> = ({
  children,
  className,
  style
}) => (
  <div className={`axiom-menu-label ${className || ""}`} style={style}>
    {children}
  </div>
);

export { DropdownSelect } from "./DropdownSelect";
export type { DropdownSelectOption, DropdownSelectProps } from "./DropdownSelect";

