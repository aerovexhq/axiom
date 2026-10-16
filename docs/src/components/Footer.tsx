import React from 'react';
import { ExternalLink, Terminal, ShieldCheck } from 'lucide-react';

interface FooterProps {
  onNavigate?: (tab: 'home' | 'docs', hashTarget?: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#08090a] border-t border-white/[0.08] text-slate-400 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-2 space-y-4 pr-6">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Axiom" className="w-6 h-6 rounded-md object-contain border border-amber-500/30" />
              <span className="font-extrabold text-xl tracking-tight text-white font-sans">
                Axiom<span className="text-amber-400">.</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              High-performance in-RAM Verilog/SystemVerilog simulator and Cranelift JIT compiler for mission-critical silicon design and autonomous robotics coprocessors.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0f1012] border border-white/[0.08] text-[11px] font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ALL CIRCUITS NOMINAL // 14.8M TRANSITIONS/S</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Core Subsystems
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#subsystems" className="hover:text-white transition">
                  Cranelift JIT Engine
                </a>
              </li>
              <li>
                <a href="#subsystems" className="hover:text-white transition">
                  4-State Logic Kernel
                </a>
              </li>
              <li>
                <a href="#subsystems" className="hover:text-white transition">
                  Static Timing Analysis
                </a>
              </li>
              <li>
                <a href="#subsystems" className="hover:text-white transition">
                  VCD & FST Waveforms
                </a>
              </li>
              <li>
                <a href="#subsystems" className="hover:text-white transition">
                  Interactive Studio
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Documentation
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#docs/getting_started" className="hover:text-white transition">
                  Getting Started
                </a>
              </li>
              <li>
                <a href="#docs/systemverilog_syntax" className="hover:text-white transition">
                  SystemVerilog Syntax
                </a>
              </li>
              <li>
                <a href="#docs/cranelift_jit" className="hover:text-white transition">
                  Cranelift JIT Internals
                </a>
              </li>
              <li>
                <a href="#docs/cli_tooling" className="hover:text-white transition">
                  Axiom CLI Guide
                </a>
              </li>
              <li>
                <a href="#docs/ffi_api" className="hover:text-white transition">
                  C / Rust FFI API
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Aerovex Ecosystem
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="https://aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Aerovex Platform <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://phonon.aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Phonon TCAD <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://atoma.aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Atoma Quantum CAD <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://sonon.aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Sonon Acoustic DSP <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://vexel.aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Vexel Systems Lang <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://appify.aerovex.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                  Appify Bundler <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px] font-mono">
          <div>
            &copy; {currentYear} Aerovex. All rights reserved. Commercial Robotics & Silicon Systems.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% In-RAM JIT
            </span>
            <span>SYSTEMVERILOG 2017</span>
            <span>CRANELIFT JIT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
