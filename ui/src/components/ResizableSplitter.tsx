import React, { useState, useCallback } from "react";

export interface ResizableSplitterProps {
  orientation: "horizontal" | "vertical";
  onResize: (deltaPx: number) => void;
  onDoubleClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  orientation,
  onResize,
  onDoubleClick,
  className = "",
  style = {}
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const isHorizontal = orientation === "horizontal";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    let lastX = e.clientX;
    let lastY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isHorizontal) {
        const delta = moveEvent.clientX - lastX;
        lastX = moveEvent.clientX;
        onResize(delta);
      } else {
        const delta = moveEvent.clientY - lastY;
        lastY = moveEvent.clientY;
        onResize(delta);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [isHorizontal, onResize]);

  return (
    <div
      className={`axiom-splitter axiom-splitter-${orientation} ${isDragging ? "dragging" : ""} ${className}`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={onDoubleClick}
      title="Drag to resize panel (Double-click to reset)"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        zIndex: 10,
        cursor: isHorizontal ? "col-resize" : "row-resize",
        userSelect: "none",
        touchAction: "none",
        backgroundColor: isDragging
          ? "var(--accent-blue)"
          : isHovered
          ? "var(--border-strong)"
          : "var(--border-subtle)",
        transition: "background-color 0.15s ease",
        ...(isHorizontal
          ? {
              width: 5,
              height: "100%",
              margin: "0 -2px",
            }
          : {
              height: 5,
              width: "100%",
              margin: "-2px 0",
            }),
        ...style
      }}
    >
      {/* Visual Grip Handle Indicator */}
      <div
        style={{
          borderRadius: 2,
          backgroundColor: isDragging
            ? "#fff"
            : isHovered
            ? "var(--text-secondary)"
            : "var(--border-strong)",
          transition: "all 0.15s ease",
          ...(isHorizontal
            ? { width: 1, height: 24 }
            : { height: 1, width: 24 })
        }}
      />
    </div>
  );
};
