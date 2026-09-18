import React, { useState } from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import {
  FPGA_TARGET_DEVICES,
  PROJECT_TEMPLATES,
  AxiomProject,
  createProjectFromTemplate
} from "../engine/projectModel";
import { Modal, Input, Select, Button, Card, Badge } from "./ui";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: AxiomProject) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const [projectName, setProjectName] = useState<string>("axi_system_top");
  const [selectedDevice, setSelectedDevice] = useState<string>(FPGA_TARGET_DEVICES[0].name);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("logic_circuit_project");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newProj = createProjectFromTemplate(
      selectedTemplateId,
      projectName.trim() || "untitled_project",
      selectedDevice
    );
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
      title="Create New Vivado HDL Project"
      subtitle="Configure target FPGA silicon and select hardware starter RTL architecture"
      icon={<Sparkles size={18} />}
      width={680}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            iconRight={<ArrowRight size={14} />}
          >
            Create Project
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Project Name */}
        <Input
          label="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))}
          placeholder="e.g. axi_system_top"
          autoFocus
        />

        {/* Target FPGA Silicon Part (Custom Dark Select) */}
        <Select
          label="Target FPGA Silicon Part"
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
            Choose Project Starter Template
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PROJECT_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplateId === tmpl.id;
              return (
                <Card
                  key={tmpl.id}
                  clickable
                  selected={isSelected}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
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
