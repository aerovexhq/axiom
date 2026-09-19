import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { toast, ToastItem, ToastType } from "../../engine/toast";

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case "success":
      return <CheckCircle2 size={16} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />;
    case "error":
      return <AlertCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0 }} />;
    case "warning":
      return <AlertTriangle size={16} color="var(--accent-amber)" style={{ flexShrink: 0 }} />;
    case "info":
    default:
      return <Info size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />;
  }
};

const getBorderColor = (type: ToastType) => {
  switch (type) {
    case "success":
      return "rgba(16, 185, 129, 0.35)";
    case "error":
      return "rgba(244, 63, 94, 0.4)";
    case "warning":
      return "rgba(245, 158, 11, 0.35)";
    case "info":
    default:
      return "rgba(6, 182, 212, 0.35)";
  }
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 420,
        width: "calc(100vw - 32px)",
        pointerEvents: "none"
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 14px",
            backgroundColor: "rgba(13, 17, 23, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${getBorderColor(t.type)}`,
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)",
            color: "var(--text-primary)",
            fontSize: 13,
            lineHeight: 1.45,
            animation: "toastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div style={{ marginTop: 2 }}>{getToastIcon(t.type)}</div>
          <div
            style={{
              flex: 1,
              wordBreak: "break-word",
              userSelect: "text"
            }}
          >
            {t.message}
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="btn-icon"
            style={{
              padding: 2,
              color: "var(--text-muted)",
              marginTop: 1,
              flexShrink: 0,
              borderRadius: 3
            }}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
