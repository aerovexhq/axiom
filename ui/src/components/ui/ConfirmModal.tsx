import React, { useEffect, useState, useRef } from "react";
import { Trash2, AlertTriangle, HelpCircle, X } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

type ConfirmListener = (state: ConfirmState | null) => void;

class ConfirmManager {
  private listener: ConfirmListener | null = null;
  private currentId = 0;

  public setListener(listener: ConfirmListener) {
    this.listener = listener;
  }

  public confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const state: ConfirmState = {
        ...options,
        id: ++this.currentId,
        resolve
      };
      if (this.listener) {
        this.listener(state);
      } else {
        resolve(false);
      }
    });
  }
}

export const confirmManager = new ConfirmManager();

export const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
  return confirmManager.confirm(options);
};

export const ConfirmDialogContainer: React.FC = () => {
  const [activeDialog, setActiveDialog] = useState<ConfirmState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmManager.setListener(setActiveDialog);
    return () => {
      confirmManager.setListener(() => {});
    };
  }, []);

  useEffect(() => {
    if (activeDialog) {
      // Focus confirm button when dialog opens
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancel();
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleConfirm();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [activeDialog]);

  const handleConfirm = () => {
    if (!activeDialog) return;
    const { resolve } = activeDialog;
    setActiveDialog(null);
    resolve(true);
  };

  const handleCancel = () => {
    if (!activeDialog) return;
    const { resolve } = activeDialog;
    setActiveDialog(null);
    resolve(false);
  };

  if (!activeDialog) return null;

  const variant = activeDialog.variant || "primary";

  const renderIcon = () => {
    switch (variant) {
      case "danger":
        return <Trash2 size={20} color="var(--color-danger)" />;
      case "warning":
        return <AlertTriangle size={20} color="var(--accent-amber)" />;
      case "primary":
      default:
        return <HelpCircle size={20} color="var(--accent-blue)" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case "danger":
        return "btn btn-danger";
      case "warning":
        return "btn btn-primary";
      case "primary":
      default:
        return "btn btn-primary";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 999998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "modalFadeIn 0.15s ease-out"
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)",
          overflow: "hidden",
          animation: "modalScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {renderIcon()}
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0
              }}
            >
              {activeDialog.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-icon"
            style={{ color: "var(--text-muted)", padding: 4 }}
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <div
          style={{
            padding: "18px 20px",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
            userSelect: "text"
          }}
        >
          {activeDialog.message}
        </div>

        {/* Actions Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "12px 20px 16px",
            backgroundColor: "rgba(0, 0, 0, 0.15)",
            borderTop: "1px solid var(--border-subtle)"
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            style={{ minWidth: 80, justifyContent: "center" }}
          >
            {activeDialog.cancelText || "Cancel"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className={getConfirmButtonClass()}
            style={{ minWidth: 90, justifyContent: "center" }}
          >
            {activeDialog.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};
