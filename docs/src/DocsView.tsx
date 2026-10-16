import React, { useState, useEffect } from 'react';
import { 
  Search, ChevronRight, ChevronDown, Play, Copy, 
  Check, ArrowLeft, ArrowRight, X, Terminal, Cpu, ShieldCheck
} from 'lucide-react';
import { AXIOM_DOC_TREE, DocSection, DocCategory } from './docsData';

interface DocsViewProps {
  onLoadPreset?: (code: string) => void;
}

interface InlineCodeBlockProps {
  section: DocSection;
}

function InlineCodeBlock({ section }: InlineCodeBlockProps) {
  const [codeTab, setCodeTab] = useState<'verilog' | 'sv' | 'cpp'>('verilog');
  const [copied, setCopied] = useState<boolean>(false);

  const getActiveCode = () => {
    if (codeTab === 'sv' && section.content.svCode) return section.content.svCode;
    if (codeTab === 'cpp' && section.content.cppCode) return section.content.cppCode;
    return section.content.verilogCode || '';
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCode = getActiveCode();
  if (!activeCode) return null;

  return (
    <div className="bg-[#0f1012] rounded-xl border border-white/[0.08] overflow-hidden mb-6 shadow-xl">
      <div className="bg-[#15171a] px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {section.content.verilogCode && (
            <button
              onClick={() => setCodeTab('verilog')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
                codeTab === 'verilog' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Verilog
            </button>
          )}
          {section.content.svCode && (
            <button
              onClick={() => setCodeTab('sv')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
                codeTab === 'sv' ? 'bg-[#5e6ad2] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              SystemVerilog
            </button>
          )}
          {section.content.cppCode && (
            <button
              onClick={() => setCodeTab('cpp')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
                codeTab === 'cpp' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              C++ Testbench
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopyCode(activeCode)}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded transition hover:bg-white/[0.05]"
            title="Copy snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#08090a] font-mono text-xs text-slate-200 overflow-x-auto">
        <pre className="leading-relaxed">
          <code>{activeCode}</code>
        </pre>
      </div>
    </div>
  );
}

function ArchitectureSpecTable({ specs }: { specs?: { param: string; val: string; note: string }[] }) {
  if (!specs || specs.length === 0) return null;

  return (
    <div className="bg-[#0f1012] rounded-xl border border-white/[0.08] overflow-hidden mb-6">
      <div className="px-4 py-2.5 bg-[#15171a] border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-amber-400" /> Formal Invariants &amp; Specifications
        </span>
        <span className="text-[10px] font-mono text-slate-500">IEEE 1800-2017</span>
      </div>
      <table className="w-full text-left border-collapse text-xs font-mono">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[10px] text-slate-500 uppercase tracking-wider">
            <th className="py-2.5 px-4 font-semibold">Parameter</th>
            <th className="py-2.5 px-4 font-semibold">Value</th>
            <th className="py-2.5 px-4 font-semibold">Architectural Directive</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {specs.map((s, idx) => (
            <tr key={idx} className="hover:bg-white/[0.01] transition">
              <td className="py-2 px-4 text-slate-400">{s.param}</td>
              <td className="py-2 px-4 text-amber-400 font-semibold">{s.val}</td>
              <td className="py-2 px-4 text-slate-500">{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsView({ onLoadPreset }: DocsViewProps) {
  const allSections: DocSection[] = AXIOM_DOC_TREE.flatMap((c) => c.sections);

  const getInitialSectionId = (): string => {
    const rawHash = window.location.hash.replace('#', '').trim();
    const secId = rawHash.startsWith('docs/') ? rawHash.replace('docs/', '') : rawHash;
    if (secId && allSections.some((s) => s.id === secId)) {
      return secId;
    }
    return 'why_axiom';
  };

  const [activeSectionId, setActiveSectionIdState] = useState<string>(getInitialSectionId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    getting_started: true,
    hdl_syntax: true,
    cranelift_jit: true,
    timing_waveform: true,
    cli_api: true
  });

  const setActiveSectionId = (id: string) => {
    setActiveSectionIdState(id);
    window.location.hash = `#docs/${id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace('#', '').trim();
      const secId = rawHash.startsWith('docs/') ? rawHash.replace('docs/', '') : rawHash;
      if (secId && allSections.some((s) => s.id === secId)) {
        setActiveSectionIdState(secId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [allSections]);

  const activeSection = allSections.find((s) => s.id === activeSectionId) || allSections[0];
  const activeSectionIndex = allSections.findIndex((s) => s.id === activeSectionId);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const filteredTree = AXIOM_DOC_TREE.map((category) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return category;
    const matchedSections = category.sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.content.title.toLowerCase().includes(q) ||
        sec.content.description.toLowerCase().includes(q)
    );
    return { ...category, sections: matchedSections };
  }).filter((category) => category.sections.length > 0);

  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 gap-8">
      {/* Left Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 shrink-0 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Axiom Documentation..."
            className="w-full bg-[#0f1012] border border-white/[0.08] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition"
          />
        </div>

        {/* Category Navigation */}
        <div className="bg-[#0f1012] border border-white/[0.08] rounded-xl p-3 space-y-2">
          {filteredTree.map((category) => {
            const isExpanded = expandedCategories[category.id] !== false;
            return (
              <div key={category.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-300 hover:text-white transition rounded hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <span>{category.title}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                      {category.badge}
                    </span>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="pl-3 space-y-0.5 border-l border-white/[0.06] ml-2 mt-1">
                    {category.sections.map((section) => {
                      const isActive = section.id === activeSectionId;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveSectionId(section.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                            isActive
                              ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                          }`}
                        >
                          <span className="truncate">{section.title}</span>
                          <span className="text-[9px] font-mono text-slate-500 ml-1">
                            {section.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Documentation Content Area */}
      <main className="flex-1 min-w-0 space-y-8">
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Axiom Documentation</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400">{activeSection.title}</span>
        </div>

        {/* Section Title & Description */}
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono uppercase text-amber-400 mb-3">
            {activeSection.content.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans mb-3">
            {activeSection.content.title}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {activeSection.content.description}
          </p>
        </div>

        {/* Callout Box */}
        {activeSection.content.callout && (
          <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs space-y-1">
            <div className="font-mono font-bold text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{activeSection.content.callout.title}</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {activeSection.content.callout.text}
            </p>
          </div>
        )}

        {/* Specification Table */}
        <ArchitectureSpecTable specs={activeSection.content.specs} />

        {/* Steps Guide if available */}
        {activeSection.content.steps && (
          <div className="space-y-4 my-6">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">
              Execution Sequence
            </h3>
            <div className="space-y-3">
              {activeSection.content.steps.map((st, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#0f1012] border border-white/[0.08] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[10px]">
                      {idx + 1}
                    </span>
                    <span>{st.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 pl-7">{st.desc}</p>
                  {st.cmd && (
                    <div className="pl-7 pt-1">
                      <pre className="p-2.5 rounded-lg bg-[#08090a] border border-white/[0.06] text-amber-400 font-mono text-xs overflow-x-auto">
                        <code>{st.cmd}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Code Snippets Block */}
        <InlineCodeBlock section={activeSection} />

        {/* Next / Previous Section Navigation */}
        <div className="pt-8 border-t border-white/[0.08] flex items-center justify-between gap-4">
          {activeSectionIndex > 0 ? (
            <button
              type="button"
              onClick={() => setActiveSectionId(allSections[activeSectionIndex - 1].id)}
              className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition px-4 py-2.5 rounded-xl bg-[#0f1012] border border-white/[0.08] hover:border-white/[0.16]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{allSections[activeSectionIndex - 1].title}</span>
            </button>
          ) : <div />}

          {activeSectionIndex < allSections.length - 1 && (
            <button
              type="button"
              onClick={() => setActiveSectionId(allSections[activeSectionIndex + 1].id)}
              className="flex items-center gap-2 text-xs font-mono text-amber-400 hover:text-amber-300 transition px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50"
            >
              <span>{allSections[activeSectionIndex + 1].title}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
