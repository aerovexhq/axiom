import React, { useState } from 'react';
import { 
  Zap, ArrowRight, BookOpen, Play, Terminal, ShieldCheck, 
  Layers, Download, Box, Copy, Check, ChevronDown, ChevronRight, Activity, Cpu 
} from 'lucide-react';
import { AXIOM_SUBSYSTEMS, Subsystem } from './data/subsystems';
import { SubsystemCard } from './components/SubsystemCard';
import { ArchitectureModal } from './components/ArchitectureModal';
import { BenchmarkMatrix } from './components/BenchmarkMatrix';

interface HomeViewProps {
  onNavigate: (tab: 'home' | 'docs', hashTarget?: string) => void;
}

type FilterDomain = 'all' | 'jit' | 'kernel' | 'timing' | 'waveform';

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [selectedSubsystem, setSelectedSubsystem] = useState<Subsystem | null>(null);
  const [domainFilter, setDomainFilter] = useState<FilterDomain>('all');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const filteredSubsystems = AXIOM_SUBSYSTEMS.filter((sub) => {
    if (domainFilter === 'all') return true;
    return sub.domain === domainFilter;
  });

  const filterTabs: { key: FilterDomain; label: string; count: number }[] = [
    { key: 'all', label: 'All Subsystems', count: AXIOM_SUBSYSTEMS.length },
    { key: 'jit', label: 'Cranelift JIT', count: AXIOM_SUBSYSTEMS.filter((s) => s.domain === 'jit').length },
    { key: 'kernel', label: '4-State Kernel', count: AXIOM_SUBSYSTEMS.filter((s) => s.domain === 'kernel').length },
    { key: 'timing', label: 'STA Timing', count: AXIOM_SUBSYSTEMS.filter((s) => s.domain === 'timing').length },
    { key: 'waveform', label: 'FST Waveforms', count: AXIOM_SUBSYSTEMS.filter((s) => s.domain === 'waveform').length },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const heroMetrics = [
    { val: '2.81 ms', lbl: 'Mean In-RAM JIT Compilation' },
    { val: '14.8M/s', lbl: '4-State Gate Transitions' },
    { val: '0 Byte', lbl: 'Intermediate Disk Writes' },
    { val: '100%', lbl: 'IEEE 1800-2017 Core' },
  ];

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="nx-ambient-glow" />

      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 pb-16 px-6 max-w-7xl mx-auto w-full z-10">
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0f1012] border border-white/[0.08] text-xs font-mono tracking-wider text-slate-300 mb-6 shadow-lg shadow-black/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-amber-400 font-bold">01 //</span>
            <span>HIGH-PERFORMANCE IN-RAM HDL SIMULATOR</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white font-sans leading-[1.08] mb-6">
            Cycle-Accurate Silicon Simulation <br className="hidden sm:inline" />
            <span className="text-amber-400">at the Speed of Memory</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl font-normal leading-relaxed mb-8">
            High-throughput Verilog and SystemVerilog simulator engineered with Cranelift JIT compilation in pure RAM, eliminating intermediate C++ transpile passes and multi-second build latency.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
            <button
              type="button"
              onClick={() => onNavigate('docs', '#docs/why_axiom')}
              className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm shadow-xl shadow-amber-500/20 flex items-center gap-2.5 transition"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Documentation</span>
            </button>

            <a
              href="#subsystems"
              className="px-6 py-3.5 rounded-xl bg-[#15171a] hover:bg-[#1c1e22] text-white font-semibold text-sm border border-white/[0.08] hover:border-white/[0.16] shadow-xl shadow-black/40 flex items-center gap-2.5 transition"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Inspect Subsystems</span>
            </a>
          </div>

          {/* Empirical Metrics Ticker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
            {heroMetrics.map((m, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#0f1012] border border-white/[0.08] text-center">
                <div className="text-2xl font-mono font-bold text-amber-400 tracking-tight">{m.val}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subsystems Bento Grid Section */}
      <section id="subsystems" className="py-20 px-6 max-w-7xl mx-auto w-full z-10 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-amber-400 mb-3">
              <Cpu className="w-3.5 h-3.5" />
              <span>SYSTEMS ARCHITECTURE &amp; HARDWARE ENGINES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
              Five Foundational Silicon Subsystems
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Complete index of Axiom's core architecture across in-RAM Cranelift JIT compilation, bit-parallel 4-state simulation, static timing analysis, and compressed waveform streaming.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-[#0f1012] p-1.5 rounded-xl border border-white/[0.08]">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDomainFilter(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  domainFilter === tab.key
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  domainFilter === tab.key ? 'bg-black/20 text-slate-900 font-bold' : 'bg-white/[0.06] text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSubsystems.map((sub) => (
            <SubsystemCard
              key={sub.id}
              subsystem={sub}
              onInspect={setSelectedSubsystem}
              onNavigateToDocs={(sectionId) => onNavigate('docs', `#docs/${sectionId}`)}
            />
          ))}
        </div>
      </section>

      {/* Benchmark Matrix */}
      <BenchmarkMatrix />

      {/* Architecture Modal */}
      <ArchitectureModal
        subsystem={selectedSubsystem}
        onClose={() => setSelectedSubsystem(null)}
        onNavigateToDocs={(sectionId) => onNavigate('docs', `#docs/${sectionId}`)}
      />
    </div>
  );
}
