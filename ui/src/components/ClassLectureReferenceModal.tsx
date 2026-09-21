import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { GraduationCap, FileCode, TestTube2, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { TemplateLesson, TemplateScreenshot } from "../engine/projectModel";

interface ClassLectureReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson?: TemplateLesson | null;
  initialScreenshotId?: string;
}

export const ClassLectureReferenceModal: React.FC<ClassLectureReferenceModalProps> = ({
  isOpen,
  onClose,
  lesson,
  initialScreenshotId
}) => {
  const screenshots: TemplateScreenshot[] = lesson?.screenshots ?? [];
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    if (initialScreenshotId && screenshots.length > 0) {
      const idx = screenshots.findIndex((s) => s.id === initialScreenshotId);
      if (idx >= 0) setActiveIndex(idx);
    } else {
      setActiveIndex(0);
    }
    setIsZoomed(false);
  }, [initialScreenshotId, isOpen, screenshots]);

  if (!isOpen || !lesson || screenshots.length === 0) return null;

  const currentScreenshot = screenshots[activeIndex] ?? screenshots[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
    setIsZoomed(false);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${lesson.title}: ${lesson.subtitle}`}
      subtitle={`${lesson.institution ?? "Istanbul University - Cerrahpasa"} • ${lesson.course ?? "Logic Circuits"}`}
      icon={<GraduationCap size={18} color="var(--accent-cyan)" />}
      width={900}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
            <span>
              Slide {activeIndex + 1} of {screenshots.length}
            </span>
            <span style={{ color: "var(--border-subtle)" }}>|</span>
            <span style={{ color: "var(--text-secondary)" }}>{currentScreenshot.title}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => window.open(currentScreenshot.src, "_blank")}
              className="btn btn-ghost"
              style={{ height: 28, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}
              title="Open raw image in new window"
            >
              <ExternalLink size={12} />
              <span>Full Size</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ height: 28, fontSize: 11.5 }}
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Slide Switcher Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-primary)",
            padding: "4px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {screenshots.map((s, idx) => {
              const isCurrent = idx === activeIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveIndex(idx);
                    setIsZoomed(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    fontSize: 11.5,
                    fontWeight: isCurrent ? 600 : 400,
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: isCurrent ? "var(--bg-elevated)" : "transparent",
                    color: isCurrent ? "var(--accent-blue)" : "var(--text-secondary)",
                    transition: "all 0.15s ease"
                  }}
                >
                  {s.type === "design" ? (
                    <FileCode size={13} color={isCurrent ? "var(--accent-blue)" : "var(--text-muted)"} />
                  ) : (
                    <TestTube2 size={13} color={isCurrent ? "var(--accent-purple)" : "var(--text-muted)"} />
                  )}
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="btn btn-ghost btn-icon"
              style={{ width: 26, height: 26 }}
              title={isZoomed ? "Zoom to fit" : "Zoom 100%"}
            >
              {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
            </button>
            <div style={{ height: 14, width: 1, backgroundColor: "var(--border-subtle)" }} />
            <button
              onClick={handlePrev}
              className="btn btn-ghost btn-icon"
              style={{ width: 26, height: 26 }}
              title="Previous slide"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNext}
              className="btn btn-ghost btn-icon"
              style={{ width: 26, height: 26 }}
              title="Next slide"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Slide Viewport Canvas */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isZoomed ? 600 : 460,
            maxHeight: "65vh",
            backgroundColor: "#080c11",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            overflow: "auto",
            display: "flex",
            alignItems: isZoomed ? "flex-start" : "center",
            justifyContent: "center",
            padding: 12
          }}
        >
          <img
            src={currentScreenshot.src}
            alt={currentScreenshot.title}
            style={{
              maxWidth: isZoomed ? "none" : "100%",
              maxHeight: isZoomed ? "none" : "100%",
              width: isZoomed ? "auto" : "auto",
              height: isZoomed ? "auto" : "auto",
              objectFit: "contain",
              borderRadius: "var(--radius-sm)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              cursor: isZoomed ? "zoom-out" : "zoom-in",
              transition: "transform 0.2s ease"
            }}
            onClick={() => setIsZoomed(!isZoomed)}
          />
        </div>

        {/* Slide Meta description */}
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            fontSize: 11.5,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {currentScreenshot.title}:
            </span>
            <span>{currentScreenshot.description}</span>
          </div>
          <span className="mono-num" style={{ fontSize: 10, color: "var(--accent-cyan)" }}>
            Istanbul University - Cerrahpasa
          </span>
        </div>
      </div>
    </Modal>
  );
};
