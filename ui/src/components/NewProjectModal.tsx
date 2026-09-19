import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Check, ArrowRight, Folder, AlertCircle } from "lucide-react";
import {
  FPGA_TARGET_DEVICES,
  PROJECT_TEMPLATES,
  AxiomProject,
  createProjectFromTemplate
} from "../engine/projectModel";
import {
  sanitizeProjectName,
  validateProjectName,
  loadProjectRegistry
} from "../engine/projectRegistry";
import { Modal, Input, Select, Button, Card, Badge } from "./ui";
import { useTranslation } from "../i18n/i18nContext";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: AxiomProject) => void;
  initialTemplateId?: string;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  initialTemplateId = "logic_circuit_project"
}) => {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);
  const [projectName, setProjectName] = useState<string>(() => {
    const tmpl = PROJECT_TEMPLATES.find((t) => t.id === initialTemplateId) ?? PROJECT_TEMPLATES[0];
    return tmpl.defaultTopModule;
  });
  const [selectedDevice, setSelectedDevice] = useState<string>(FPGA_TARGET_DEVICES[0].name);

  // Sync initialTemplateId when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(initialTemplateId);
      const tmpl = PROJECT_TEMPLATES.find((t) => t.id === initialTemplateId) ?? PROJECT_TEMPLATES[0];
      setProjectName(tmpl.defaultTopModule);
    }
  }, [isOpen, initialTemplateId]);

  // When template selection changes inside modal, update device default if desired
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setProjectName(tmpl.defaultTopModule);
      setSelectedDevice(tmpl.defaultDevice);
    }
  };

  const existingProjects = useMemo(() => {
    if (!isOpen) return [];
    return loadProjectRegistry();
  }, [isOpen]);

  const validation = useMemo(() => {
    return validateProjectName(projectName, existingProjects);
  }, [projectName, existingProjects]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;
    const finalName = sanitizeProjectName(projectName);
    const newProj = createProjectFromTemplate(
      selectedTemplateId,
      finalName,
      selectedDevice
    );
    // Enforce matching ID and name for FileSystem folder parity: /projects/{finalName}/
    newProj.id = finalName;
    newProj.name = finalName;
    onCreateProject(newProj);
    onClose();
  };

  const deviceOptions = FPGA_TARGET_DEVICES.map((d) => ({
    value: d.name,
    label: d.name,
    sublabel: `(${d.family} • ${d.logicCells} Logic Cells)`
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.modals.newProjectTitle}
      subtitle={t.modals.newProjectSubtitle}
      icon={<Sparkles size={18} />}
      width={680}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.modals.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!validation.valid}
            iconRight={<ArrowRight size={14} />}
          >
            {t.modals.createProjectBtn}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Project Name & Live Filesystem Folder Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Input
            label={t.modals.projectName}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "_"))}
            placeholder="e.g. logic_circuit_1"
            autoFocus
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "0 2px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Folder size={12} color="var(--accent-cyan)" />
              <span>
                Filesystem Folder:{" "}
                <span className="mono-num" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                  /projects/{projectName.trim() ? sanitizeProjectName(projectName) : "..."}
                </span>
              </span>
            </div>
            <span>[a-zA-Z0-9_.-]</span>
          </div>

          {!validation.valid && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "var(--accent-rose)",
                backgroundColor: "rgba(244, 63, 94, 0.1)",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(244, 63, 94, 0.25)"
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{validation.error}</span>
            </div>
          )}
        </div>

        {/* Target FPGA Silicon Part (Custom Dark Select) */}
        <Select
          label={t.modals.targetDevice}
          value={selectedDevice}
          onChange={setSelectedDevice}
          options={deviceOptions}
        />

        {/* Project Starter Template */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.03em"
            }}
          >
            {t.modals.starterTemplate}
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PROJECT_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplateId === tmpl.id;
              return (
                <Card
                  key={tmpl.id}
                  clickable
                  selected={isSelected}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "12px 14px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: isSelected ? "var(--accent-blue)" : "var(--text-primary)"
                      }}
                    >
                      {tmpl.name}
                    </span>
                    {isSelected && <Check size={15} color="var(--accent-blue)" />}
                  </div>

                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-secondary)",
                      lineHeight: 1.35,
                      margin: 0
                    }}
                  >
                    {tmpl.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 2,
                      fontSize: 11,
                      color: "var(--text-muted)"
                    }}
                  >
                    <Badge color="slate" size="sm">
                      {tmpl.files.length} Files
                    </Badge>
                    <span>•</span>
                    <span>Top: {tmpl.defaultTopModule}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
};
