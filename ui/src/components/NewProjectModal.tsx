import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Folder,
  AlertCircle,
  Cpu,
  HardDrive,
  Search,
  CheckCircle2
} from "lucide-react";
import {
  PROJECT_TEMPLATES,
  AxiomProject,
  ProjectFile,
  createProjectFromTemplate
} from "../engine/projectModel";
import {
  sanitizeProjectName,
  validateProjectName,
  loadProjectRegistry,
  ProjectMetadata
} from "../engine/projectRegistry";
import { FPGA_PARTS_DATABASE, DEFAULT_PART_ID } from "../engine/partsCatalog";
import { FPGA_BOARDS_DATABASE, FpgaBoard } from "../engine/boardsCatalog";
import { isDesktop, openFolderDialog } from "../engine/platform";
import { Modal, Input, Button, Card, Badge } from "./ui";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: AxiomProject) => void;
  initialTemplateId?: string;
}

export type ProjectType = "rtl" | "post_synthesis" | "io_planning" | "imported" | "example";

/**
 * Calculates the next default project name (e.g. project_1, project_2, etc.)
 */
function getNextDefaultProjectName(existingProjects: ProjectMetadata[]): string {
  const existingNames = new Set(existingProjects.map((p) => p.name.toLowerCase()));
  let n = 1;
  while (existingNames.has(`project_${n}`)) {
    n++;
  }
  return `project_${n}`;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  initialTemplateId = "logic_circuit_project"
}) => {
  // Step state: 1: Name & Location, 2: Project Type, 3: Default Part & Boards, 4: Summary
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Existing projects registry
  const existingProjects = useMemo(() => {
    if (!isOpen) return [];
    return loadProjectRegistry();
  }, [isOpen]);

  // Step 1: Project Name & Location
  const [projectName, setProjectName] = useState<string>("project_1");
  const [projectLocation, setProjectLocation] = useState<string>("/home/projects");
  const [createSubdir, setCreateSubdir] = useState<boolean>(true);

  // Step 2: Project Type
  const [projectType, setProjectType] = useState<ProjectType>("rtl");
  const [doNotSpecifySources, setDoNotSpecifySources] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);

  // Step 3: Default Part & Boards
  const [catalogTab, setCatalogTab] = useState<"parts" | "boards">("parts");
  const [selectedPartId, setSelectedPartId] = useState<string>(DEFAULT_PART_ID);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  // Parts filtering
  const [partSearch, setPartSearch] = useState<string>("");
  const [familyFilter, setFamilyFilter] = useState<string>("All");
  const [speedFilter, setSpeedFilter] = useState<string>("All");

  // Boards filtering
  const [boardSearch, setBoardSearch] = useState<string>("");
  const [boardVendorFilter, setBoardVendorFilter] = useState<string>("All");

  // Reset/Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      const nextName = getNextDefaultProjectName(existingProjects);
      setProjectName(nextName);
      setProjectType("rtl");
      setDoNotSpecifySources(false);
      setSelectedTemplateId(initialTemplateId);
      setSelectedPartId(DEFAULT_PART_ID);
      setSelectedBoardId(null);
      setCatalogTab("parts");
      if (typeof window !== "undefined") {
        setProjectLocation(isDesktop() ? "~/AxiomProjects" : "/projects");
      }
    }
  }, [isOpen, existingProjects, initialTemplateId]);

  // Name Validation
  const validation = useMemo(() => {
    return validateProjectName(projectName, existingProjects);
  }, [projectName, existingProjects]);

  // Selected Part Object
  const selectedPart = useMemo(() => {
    return FPGA_PARTS_DATABASE.find((p) => p.id === selectedPartId) || FPGA_PARTS_DATABASE[2];
  }, [selectedPartId]);

  // Filtered Parts
  const filteredParts = useMemo(() => {
    return FPGA_PARTS_DATABASE.filter((p) => {
      if (familyFilter !== "All" && p.family !== familyFilter) return false;
      if (speedFilter !== "All" && p.speedGrade !== speedFilter) return false;
      if (partSearch.trim()) {
        const query = partSearch.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchFamily = p.family.toLowerCase().includes(query);
        const matchPkg = p.package.toLowerCase().includes(query);
        if (!matchName && !matchFamily && !matchPkg) return false;
      }
      return true;
    });
  }, [familyFilter, speedFilter, partSearch]);

  // Filtered Boards
  const filteredBoards = useMemo(() => {
    return FPGA_BOARDS_DATABASE.filter((b) => {
      if (boardVendorFilter !== "All" && b.vendor !== boardVendorFilter) return false;
      if (boardSearch.trim()) {
        const query = boardSearch.toLowerCase();
        if (
          !b.name.toLowerCase().includes(query) &&
          !b.displayName.toLowerCase().includes(query) &&
          !b.targetPartName.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [boardVendorFilter, boardSearch]);

  // Folder browse handler (Desktop only)
  const handleBrowseFolder = async () => {
    const selected = await openFolderDialog();
    if (selected) {
      setProjectLocation(selected);
    }
  };

  // Handle board selection (also sets target part)
  const handleSelectBoard = (board: FpgaBoard) => {
    setSelectedBoardId(board.id);
    const matchingPart = FPGA_PARTS_DATABASE.find((p) => p.id === board.targetPartId);
    if (matchingPart) {
      setSelectedPartId(matchingPart.id);
    }
  };

  // Final Project Submission
  const handleFinish = () => {
    if (!validation.valid) return;
    const finalName = sanitizeProjectName(projectName);

    let newProj: AxiomProject;

    if (projectType === "example") {
      newProj = createProjectFromTemplate(
        selectedTemplateId,
        finalName,
        selectedPart.name
      );
    } else {
      const files: ProjectFile[] = [];

      // If RTL Project and user did not check "Do not specify sources at this time",
      // create default initial "untitled.v" source file in sources_1
      if (projectType === "rtl" && !doNotSpecifySources) {
        const defaultUntitledContent = `// Vivado Design Source: untitled.v\n// Axiom EDA Studio — RTL Design Module\n\`timescale 1ns / 1ps\n\nmodule untitled (\n    input  wire clk,\n    input  wire rst_n,\n    input  wire [7:0] din,\n    output reg  [7:0] dout\n);\n\n    // Enter your RTL hardware architecture here\n    always @(posedge clk or negedge rst_n) begin\n        if (!rst_n) begin\n            dout <= 8'h00;\n        end else begin\n            dout <= din;\n        end\n    end\n\nendmodule\n`;
        files.push({
          id: `${finalName}_untitled_v`,
          name: "untitled.v",
          fileType: "verilog",
          fileSet: "sources_1",
          isTop: true,
          content: defaultUntitledContent
        });
      }

      const initialFileId = files.length > 0 ? files[0].id : "";
      newProj = {
        id: finalName,
        name: finalName,
        targetDevice: selectedPart.name,
        topModule: files.length > 0 ? "untitled" : "",
        activeFileId: initialFileId,
        openFileIds: initialFileId ? [initialFileId] : [],
        files,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    newProj.id = finalName;
    newProj.name = finalName;
    onCreateProject(newProj);
    onClose();
  };

  if (!isOpen) return null;

  const stepTitles = {
    1: "Project Name and Location",
    2: "Project Type",
    3: "Default Part and Board Selection",
    4: "New Project Summary"
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a New Axiom Project"
      subtitle={`Step ${currentStep} of 4: ${stepTitles[currentStep]}`}
      icon={<Sparkles size={18} />}
      width={780}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
              icon={<ArrowLeft size={14} />}
            >
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
                variant="primary"
                size="sm"
                disabled={currentStep === 1 && !validation.valid}
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
                iconRight={<ArrowRight size={14} />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={!validation.valid}
                onClick={handleFinish}
                iconRight={<Check size={14} />}
              >
                Finish
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Wizard Step Progress Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          padding: "8px 12px",
          backgroundColor: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          fontSize: 11.5
        }}
      >
        {[
          { num: 1, label: "Name & Location" },
          { num: 2, label: "Project Type" },
          { num: 3, label: "Default Part" },
          { num: 4, label: "Summary" }
        ].map((s, idx) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <React.Fragment key={s.num}>
              {idx > 0 && <span style={{ color: "var(--border-default)" }}>→</span>}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--accent-blue)"
                    : isDone
                    ? "var(--text-secondary)"
                    : "var(--text-muted)"
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    backgroundColor: isActive
                      ? "var(--accent-blue)"
                      : isDone
                      ? "rgba(59, 130, 246, 0.2)"
                      : "var(--bg-secondary)",
                    color: isActive ? "#fff" : isDone ? "var(--accent-blue)" : "var(--text-muted)",
                    border: `1px solid ${isActive ? "var(--accent-blue)" : "var(--border-subtle)"}`
                  }}
                >
                  {isDone ? <Check size={10} /> : s.num}
                </div>
                <span>{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1: Project Name & Location */}
      {currentStep === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Specify the name and directory location for your project. A project subdirectory will automatically be created to organize design sources, simulations, and constraint files.
          </p>

          {/* Project Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Input
              label="Project Name:"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "_"))}
              placeholder="e.g. project_1"
              autoFocus
            />

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

          {/* Project Location (Desktop only: Physical Filesystem) */}
          {isDesktop() && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em"
                  }}
                >
                  Project Location:
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                  />
                  <Button variant="secondary" size="sm" onClick={handleBrowseFolder} icon={<Folder size={13} />}>
                    Browse...
                  </Button>
                </div>
              </div>

              {/* Create Project Subdirectory Checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="create_subdir"
                  checked={createSubdir}
                  onChange={(e) => setCreateSubdir(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="create_subdir" style={{ fontSize: 12, color: "var(--text-primary)", cursor: "pointer" }}>
                  Create project subdirectory
                </label>
              </div>

              {/* Directory Preview */}
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-primary)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <Folder size={14} color="var(--accent-blue)" />
                <span>
                  Project will be created at:{" "}
                  <span className="mono-num" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                    {projectLocation.replace(/\/$/, "")}/{createSubdir ? sanitizeProjectName(projectName) : ""}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Project Type Selection */}
      {currentStep === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Specify the type of project to create. You will be able to add design sources, simulation testbenches, and constraints matching your chosen hardware design workflow.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* RTL Project */}
            <Card
              clickable
              selected={projectType === "rtl"}
              onClick={() => setProjectType("rtl")}
              style={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="radio"
                  name="project_type"
                  checked={projectType === "rtl"}
                  onChange={() => setProjectType("rtl")}
                  style={{ marginTop: 2, cursor: "pointer" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: projectType === "rtl" ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      RTL Project
                    </span>
                    <Badge color="blue" size="sm">Recommended</Badge>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    You will be able to add sources, create block designs in IP Integrator, generate IP, run RTL analysis, synthesis, implementation, design planning and analysis.
                  </p>
                  {projectType === "rtl" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        id="no_sources_rtl"
                        checked={doNotSpecifySources}
                        onChange={(e) => setDoNotSpecifySources(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      <label htmlFor="no_sources_rtl" style={{ fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
                        Do not specify sources at this time (skip creating default untitled.v)
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Post-synthesis Project */}
            <Card
              clickable
              selected={projectType === "post_synthesis"}
              onClick={() => setProjectType("post_synthesis")}
              style={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="radio"
                  name="project_type"
                  checked={projectType === "post_synthesis"}
                  onChange={() => setProjectType("post_synthesis")}
                  style={{ marginTop: 2, cursor: "pointer" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: projectType === "post_synthesis" ? "var(--accent-blue)" : "var(--text-primary)" }}>
                    Post-synthesis Project
                  </span>
                  <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    You will be able to add sources, run gate-level simulation, implementation, design planning and analysis.
                  </p>
                  {projectType === "post_synthesis" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        id="no_sources_post"
                        checked={doNotSpecifySources}
                        onChange={(e) => setDoNotSpecifySources(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      <label htmlFor="no_sources_post" style={{ fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
                        Do not specify sources at this time
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* I/O Planning Project */}
            <Card
              clickable
              selected={projectType === "io_planning"}
              onClick={() => setProjectType("io_planning")}
              style={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="radio"
                  name="project_type"
                  checked={projectType === "io_planning"}
                  onChange={() => setProjectType("io_planning")}
                  style={{ marginTop: 2, cursor: "pointer" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: projectType === "io_planning" ? "var(--accent-blue)" : "var(--text-primary)" }}>
                    I/O Planning Project
                  </span>
                  <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    Do not specify sources at this time. You will be able to create an empty project for I/O planning and pin assignment.
                  </p>
                </div>
              </div>
            </Card>

            {/* Imported Project */}
            <Card
              clickable
              selected={projectType === "imported"}
              onClick={() => setProjectType("imported")}
              style={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="radio"
                  name="project_type"
                  checked={projectType === "imported"}
                  onChange={() => setProjectType("imported")}
                  style={{ marginTop: 2, cursor: "pointer" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: projectType === "imported" ? "var(--accent-blue)" : "var(--text-primary)" }}>
                    Imported Project
                  </span>
                  <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    You will be able to import existing Synplify, Synopsys, or other project files.
                  </p>
                </div>
              </div>
            </Card>

            {/* Example Project */}
            <Card
              clickable
              selected={projectType === "example"}
              onClick={() => setProjectType("example")}
              style={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="radio"
                  name="project_type"
                  checked={projectType === "example"}
                  onChange={() => setProjectType("example")}
                  style={{ marginTop: 2, cursor: "pointer" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: projectType === "example" ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      Example Project
                    </span>
                    <Badge color="cyan" size="sm">Preconfigured Systems</Badge>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    Create a new project based on an existing curated example hardware project (e.g. Gate-level Logic, UART, SPI, RISC-V, DSP MAC).
                  </p>

                  {/* Template Sub-Selection */}
                  {projectType === "example" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      {PROJECT_TEMPLATES.filter((tmpl) => tmpl.category !== "education" && tmpl.id !== "class_examples_project").map((tmpl) => {
                        const isTmplSelected = selectedTemplateId === tmpl.id;
                        return (
                          <div
                            key={tmpl.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateId(tmpl.id);
                            }}
                            style={{
                              padding: "8px 10px",
                              backgroundColor: isTmplSelected ? "rgba(59, 130, 246, 0.15)" : "var(--bg-tertiary)",
                              border: `1px solid ${isTmplSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2
                            }}
                          >
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: isTmplSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                              {tmpl.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                              {tmpl.files.length} Files • Top: {tmpl.defaultTopModule}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 3: Default Part & Board Catalog Database */}
      {currentStep === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Tab Switcher: Parts vs Boards */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border-subtle)",
              paddingBottom: 8
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setCatalogTab("parts")}
                className={catalogTab === "parts" ? "btn btn-primary" : "btn btn-ghost"}
                style={{ height: 28, fontSize: 12 }}
              >
                <Cpu size={13} />
                <span>Parts ({FPGA_PARTS_DATABASE.length})</span>
              </button>
              <button
                onClick={() => setCatalogTab("boards")}
                className={catalogTab === "boards" ? "btn btn-primary" : "btn btn-ghost"}
                style={{ height: 28, fontSize: 12 }}
              >
                <HardDrive size={13} />
                <span>Boards ({FPGA_BOARDS_DATABASE.length})</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)" }}>
              <span>Target Part:</span>
              <span className="mono-num" style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>
                {selectedPart.name}
              </span>
              {selectedPart.id === DEFAULT_PART_ID && (
                <Badge color="blue" size="sm">Default</Badge>
              )}
            </div>
          </div>

          {/* PARTS TAB */}
          {catalogTab === "parts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Filters Toolbar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
                  <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    placeholder="Search parts (e.g. xc7a100t, csg324)..."
                    className="input"
                    style={{ paddingLeft: 26, height: 28, fontSize: 11.5, width: "100%" }}
                  />
                </div>

                {/* Family Filter */}
                <select
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="input"
                  style={{ height: 28, fontSize: 11.5, padding: "0 8px" }}
                >
                  <option value="All">All Families</option>
                  <option value="Artix-7">Artix-7</option>
                  <option value="Kintex-7">Kintex-7</option>
                  <option value="Virtex-7">Virtex-7</option>
                  <option value="Zynq-7000">Zynq-7000</option>
                  <option value="Kintex UltraScale+">Kintex UltraScale+</option>
                  <option value="Virtex UltraScale+">Virtex UltraScale+</option>
                  <option value="Axiom Virtual">Axiom Virtual</option>
                </select>

                {/* Speed Filter */}
                <select
                  value={speedFilter}
                  onChange={(e) => setSpeedFilter(e.target.value)}
                  className="input"
                  style={{ height: 28, fontSize: 11.5, padding: "0 8px" }}
                >
                  <option value="All">All Speeds</option>
                  <option value="-1">-1</option>
                  <option value="-2">-2</option>
                  <option value="-3">-3</option>
                </select>
              </div>

              {/* Parts Table */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-primary)"
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-muted)", position: "sticky", top: 0, zIndex: 2 }}>
                      <th style={{ padding: "6px 10px" }}>Part Name</th>
                      <th style={{ padding: "6px 8px" }}>Family</th>
                      <th style={{ padding: "6px 8px" }}>Package</th>
                      <th style={{ padding: "6px 8px" }}>Speed</th>
                      <th style={{ padding: "6px 8px" }}>LUTs</th>
                      <th style={{ padding: "6px 8px" }}>Flip-Flops</th>
                      <th style={{ padding: "6px 8px" }}>BRAMs</th>
                      <th style={{ padding: "6px 8px" }}>DSPs</th>
                      <th style={{ padding: "6px 8px" }}>IOBs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.map((part) => {
                      const isSelected = selectedPartId === part.id;
                      return (
                        <tr
                          key={part.id}
                          onClick={() => setSelectedPartId(part.id)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: isSelected ? "rgba(59, 130, 246, 0.18)" : "transparent",
                            borderBottom: "1px solid var(--border-subtle)",
                            color: isSelected ? "var(--accent-blue)" : "var(--text-primary)",
                            fontWeight: isSelected ? 600 : 400
                          }}
                        >
                          <td style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                            {isSelected ? (
                              <CheckCircle2 size={12} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 12, height: 12, flexShrink: 0 }} />
                            )}
                            <span className="mono-num">{part.name}</span>
                            {part.id === DEFAULT_PART_ID && (
                              <Badge
                                color="blue"
                                size="sm"
                                style={{
                                  fontSize: 9.5,
                                  padding: "1px 6px",
                                  height: 16,
                                  lineHeight: "12px",
                                  marginLeft: 4,
                                  flexShrink: 0
                                }}
                              >
                                Default
                              </Badge>
                            )}
                          </td>
                          <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{part.family}</td>
                          <td style={{ padding: "6px 8px" }}>{part.package}</td>
                          <td style={{ padding: "6px 8px" }}>{part.speedGrade}</td>
                          <td style={{ padding: "6px 8px" }} className="mono-num">{part.lutElements.toLocaleString()}</td>
                          <td style={{ padding: "6px 8px" }} className="mono-num">{part.flipFlops.toLocaleString()}</td>
                          <td style={{ padding: "6px 8px" }} className="mono-num">{part.blockRams}</td>
                          <td style={{ padding: "6px 8px" }} className="mono-num">{part.dspSlices}</td>
                          <td style={{ padding: "6px 8px" }} className="mono-num">{part.availableIobs}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BOARDS TAB */}
          {catalogTab === "boards" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Boards Filters */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={boardSearch}
                    onChange={(e) => setBoardSearch(e.target.value)}
                    placeholder="Search development boards (e.g. Nexys, Basys, ZCU)..."
                    className="input"
                    style={{ paddingLeft: 26, height: 28, fontSize: 11.5, width: "100%" }}
                  />
                </div>

                <select
                  value={boardVendorFilter}
                  onChange={(e) => setBoardVendorFilter(e.target.value)}
                  className="input"
                  style={{ height: 28, fontSize: 11.5, padding: "0 8px" }}
                >
                  <option value="All">All Vendors</option>
                  <option value="digilent.com">digilent.com</option>
                  <option value="xilinx.com">xilinx.com</option>
                  <option value="avnet.com">avnet.com</option>
                  <option value="alpha-data.com">alpha-data.com</option>
                </select>
              </div>

              {/* Boards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                {filteredBoards.map((board) => {
                  const isSelected = selectedBoardId === board.id;
                  return (
                    <Card
                      key={board.id}
                      clickable
                      selected={isSelected}
                      onClick={() => handleSelectBoard(board)}
                      style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                          {board.name}
                        </span>
                        <Badge color="slate" size="sm">Rev {board.revision}</Badge>
                      </div>

                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {board.vendor} • {board.category}
                      </span>

                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0", lineHeight: 1.3 }}>
                        {board.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 10.5 }}>
                        <span style={{ color: "var(--text-muted)" }}>FPGA:</span>
                        <span className="mono-num" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                          {board.targetPartName}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Summary */}
      {currentStep === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Review your new project settings. Click <strong>Finish</strong> to generate the project directory, synthesize default templates, and launch the Axiom Studio workspace.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px"
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Project Name:</span>
              <span className="mono-num" style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>
                {projectName}
              </span>

              {isDesktop() && (
                <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Project Location:</span>
                  <span className="mono-num" style={{ color: "var(--text-secondary)" }}>
                    {projectLocation.replace(/\/$/, "")}/{createSubdir ? sanitizeProjectName(projectName) : ""}
                  </span>
                </>
              )}

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Project Type:</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {projectType === "rtl"
                  ? "RTL Project"
                  : projectType === "post_synthesis"
                  ? "Post-synthesis Project"
                  : projectType === "io_planning"
                  ? "I/O Planning Project"
                  : projectType === "imported"
                  ? "Imported Project"
                  : "Example Project"}
              </span>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Initial Sources:</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {projectType === "rtl" && !doNotSpecifySources ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--accent-emerald)" }}>
                    <Check size={13} />
                    <span>Design Sources: untitled.v (Top Module)</span>
                  </span>
                ) : projectType === "example" ? (
                  <span>Curated Starter Template ({PROJECT_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name})</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>None (empty fileset ready for Add Sources)</span>
                )}
              </span>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Target Device:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono-num" style={{ fontWeight: 600, color: "var(--accent-blue)" }}>
                  {selectedPart.name} ({selectedPart.family})
                </span>
                {selectedPart.id === DEFAULT_PART_ID && (
                  <Badge color="blue" size="sm">Default</Badge>
                )}
              </div>

              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Hardware Specs:</span>
              <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                {selectedPart.lutElements.toLocaleString()} LUTs • {selectedPart.flipFlops.toLocaleString()} FFs • {selectedPart.blockRams} BRAMs • {selectedPart.dspSlices} DSPs
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
