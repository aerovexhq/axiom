import type { DefaultTheme } from "vitepress";

export interface LocaleStrings {
  label: string;
  lang: string;
  description: string;
  outlineTitle: string;
  docFooterPrev: string;
  docFooterNext: string;
  lastUpdatedText: string;
  darkModeSwitchLabel: string;
  sidebarMenuLabel: string;
  returnToTopLabel: string;
  nav: {
    guide: string;
    studioUi: string;
    verilogHdl: string;
    languages: string;
    verilog: string;
    systemVerilog: string;
    vhdl: string;
    xdc: string;
    primitives: string;
    architecture: string;
    vivadoMigration: string;
    cliReference: string;
    webStudio: string;
    version: string;
    changelog: string;
    platform: string;
  };
  sidebar: {
    studioWorkspace: string;
    studioOverview: string;
    projectsLifecycle: string;
    securitySandbox: string;
    coreDesignViews: string;
    monacoEditor: string;
    schematicViewer: string;
    virtualLab: string;
    analysisViews: string;
    waveformViewer: string;
    timingRadar: string;
    telemetryEnergy: string;
    advancedSynthesis: string;
    techMapping: string;
    floorplanning: string;
    formalVerification: string;
    protocolAnalyzer: string;
    microarchitecture: string;
    controlsDiagnostics: string;
    simulationDock: string;

    otherLanguages: string;

    verilogGroup: string;
    langOverview: string;
    dataTypesNets: string;
    operatorsExprs: string;
    continuousAssigns: string;
    proceduralBlocks: string;
    controlFlow: string;
    modulesHierarchy: string;
    tasksFunctions: string;
    systemTasks: string;
    linterRules: string;

    svGroup: string;
    svTypes: string;
    svProcesses: string;
    svInterfaces: string;
    svAssertions: string;
    svConstrained: string;

    vhdlGroup: string;
    vhdlEntities: string;
    vhdlPackages: string;
    vhdlConcurrent: string;
    vhdlLinter: string;

    xdcGroup: string;
    xdcArch: string;
    xdcPhysical: string;
    xdcClock: string;
    xdcIo: string;
    xdcExceptions: string;
    xdcLsp: string;

    primGroup: string;
    primArch: string;
    primClb: string;
    primClock: string;
    primDsp: string;
    primBram: string;

    gettingStarted: string;
    guideIntro: string;
    guideQuickstart: string;
    guideDesktopWeb: string;

    coreArch: string;
    archJit: string;
    archArena: string;
    archScheduler: string;
    archPower: string;

    vivadoGroup: string;
    vivadoMigration: string;
    vivadoSaifVcd: string;
    vivadoMatrix: string;

    refGroup: string;
    refCli: string;
  };
}

export const LOCALES_DATA: Record<string, LocaleStrings> = {
  en: {
    label: "English",
    lang: "en-US",
    description: "Next-Generation In-RAM HDL Processor, Cranelift JIT Simulator & Silicon Telemetry Engine",
    outlineTitle: "On this page",
    docFooterPrev: "Previous page",
    docFooterNext: "Next page",
    lastUpdatedText: "Last updated",
    darkModeSwitchLabel: "Appearance",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Return to top",
    nav: {
      guide: "Guide",
      studioUi: "Studio UI",
      verilogHdl: "Verilog HDL",
      languages: "Languages",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "XDC Constraints",
      primitives: "Xilinx Primitives",
      architecture: "Architecture",
      vivadoMigration: "Vivado Migration",
      cliReference: "CLI Reference",
      webStudio: "Web Studio",
      version: "v1.0.0",
      changelog: "Changelog",
      platform: "Aerovex Platform"
    },
    sidebar: {
      studioWorkspace: "Axiom Studio Workspace",
      studioOverview: "Studio Overview & Shortcuts",
      projectsLifecycle: "Projects & File Sets",
      securitySandbox: "Security & Sandboxing",
      coreDesignViews: "Core Design & Edit Views",
      monacoEditor: "Monaco HDL Editor & LSP",
      schematicViewer: "Schematic DAG Visualizer",
      virtualLab: "Virtual Lab & Basys 3",
      analysisViews: "Analysis & Telemetry Views",
      waveformViewer: "Waveforms & Logic Analyzer",
      timingRadar: "Timing Radar & STA",
      telemetryEnergy: "Silicon Telemetry & Energy",
      advancedSynthesis: "Advanced Synthesis & Floorplanning",
      techMapping: "Technology Mapping",
      floorplanning: "Silicon Floorplanning",
      formalVerification: "Formal Verification (BMC)",
      protocolAnalyzer: "Protocol Analyzer",
      microarchitecture: "Microarchitecture & Multi-Die",
      controlsDiagnostics: "Controls & Diagnostics",
      simulationDock: "Simulation Dock & Console",

      otherLanguages: "Other Languages",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "Language Overview",
      dataTypesNets: "Data Types & Nets",
      operatorsExprs: "Operators & Expressions",
      continuousAssigns: "Continuous Assignments",
      proceduralBlocks: "Procedural Blocks & Timing",
      controlFlow: "Control Flow Statements",
      modulesHierarchy: "Modules & Hierarchy",
      tasksFunctions: "Tasks & Functions",
      systemTasks: "System Tasks & I/O",
      linterRules: "Static Linter Rules",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "Data Types & Declarations",
      svProcesses: "Specialized Processes",
      svInterfaces: "Interfaces & Packages",
      svAssertions: "Assertions (SVA) & Formal",
      svConstrained: "Constrained Randomization",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "Entities & Architectures",
      vhdlPackages: "Packages & Types",
      vhdlConcurrent: "Concurrent & Sequential",
      vhdlLinter: "VHDL Linter Diagnostics",

      xdcGroup: "Xilinx Design Constraints (XDC)",
      xdcArch: "Constraints Architecture",
      xdcPhysical: "Physical Constraints",
      xdcClock: "Clock Constraints",
      xdcIo: "I/O Timing Constraints",
      xdcExceptions: "Timing Exceptions",
      xdcLsp: "Monaco XDC Language Server",

      primGroup: "Xilinx Primitive Library",
      primArch: "In-Engine Architecture",
      primClb: "CLB & Logic Cells",
      primClock: "Clocking & I/O Buffers",
      primDsp: "DSP48 Arithmetic Slices",
      primBram: "Block RAM (RAMB)",

      gettingStarted: "Getting Started",
      guideIntro: "Introduction & Manifesto",
      guideQuickstart: "Quickstart (60-Second Setup)",
      guideDesktopWeb: "Desktop & Web Architecture",

      coreArch: "Core Architecture",
      archJit: "In-RAM Cranelift JIT",
      archArena: "4-State Logic State Arena",
      archScheduler: "Stratified Event Scheduler",
      archPower: "Physics Power & PDN Telemetry",

      vivadoGroup: "Vivado Design Suite Parity",
      vivadoMigration: "Migration from Vivado",
      vivadoSaifVcd: "SAIF & VCD Interoperability",
      vivadoMatrix: "Feature Comparison Matrix",

      refGroup: "Reference Manual",
      refCli: "CLI Commands & Options"
    }
  },

  tr: {
    label: "Türkçe",
    lang: "tr-TR",
    description: "Yeni Nesil Bellek-İçi HDL İşlemcisi, Cranelift JIT Simülatörü ve Silikon Telemetri Motoru",
    outlineTitle: "Bu Sayfada",
    docFooterPrev: "Önceki Sayfa",
    docFooterNext: "Sonraki Sayfa",
    lastUpdatedText: "Son Güncelleme",
    darkModeSwitchLabel: "Görünüm",
    sidebarMenuLabel: "Menü",
    returnToTopLabel: "Başa Dön",
    nav: {
      guide: "Rehber",
      studioUi: "Studio Arayüzü",
      verilogHdl: "Verilog HDL",
      languages: "Diller",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "XDC Kısıtlamaları",
      primitives: "Xilinx Primitifleri",
      architecture: "Mimari",
      vivadoMigration: "Vivado Göçü",
      cliReference: "CLI Başvurusu",
      webStudio: "Web Stüdyosu",
      version: "v1.0.0",
      changelog: "Değişiklik Günlüğü",
      platform: "Aerovex Platformu"
    },
    sidebar: {
      studioWorkspace: "Axiom Stüdyo Çalışma Alanı",
      studioOverview: "Stüdyo Genel Bakış & Kısayollar",
      projectsLifecycle: "Projeler & Dosya Kümeleri",
      securitySandbox: "Güvenlik & İzolasyon",
      coreDesignViews: "Tasarım & Düzenleme Görünümleri",
      monacoEditor: "Monaco HDL Editörü & LSP",
      schematicViewer: "Şematik DAG Görselleştirici",
      virtualLab: "Sanal Laboratuvar & Basys 3",
      analysisViews: "Analiz & Telemetri Görünümleri",
      waveformViewer: "Dalga Biçimleri & Mantık Analizörü",
      timingRadar: "Zamanlama Radarı & STA",
      telemetryEnergy: "Silikon Telemetrisi & Enerji",
      advancedSynthesis: "Gelişmiş Sentez & Yerleşim",
      techMapping: "Teknoloji Eşleme (Tech Mapping)",
      floorplanning: "Silikon Yerleşimi (Floorplanning)",
      formalVerification: "Biçimsel Doğrulama (BMC)",
      protocolAnalyzer: "Protokol Analizörü",
      microarchitecture: "Mikromimari & Çoklu Yonga",
      controlsDiagnostics: "Denetimler & Tanılama",
      simulationDock: "Benzetim Çekmecesi & Konsol",

      otherLanguages: "Diğer Diller",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "Dil Genel Bakışı",
      dataTypesNets: "Veri Tipleri & Hatlar",
      operatorsExprs: "İşleçler & İfadeler",
      continuousAssigns: "Sürekli Atamalar (assign)",
      proceduralBlocks: "Yordamsal Bloklar & Zamanlama",
      controlFlow: "Akış Denetim İfadeleri",
      modulesHierarchy: "Modüller & Hiyerarşi",
      tasksFunctions: "Görevler & Fonksiyonlar",
      systemTasks: "Sistem Görevleri & G/Ç",
      linterRules: "Statik Linter Kuralları",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "Veri Tipleri & Bildirimler",
      svProcesses: "Özelleşmiş Süreçler",
      svInterfaces: "Arayüzler & Paketler",
      svAssertions: "Ösavlar (SVA) & Biçimsel",
      svConstrained: "Kısıtlı Rastgeleleştirme",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "Varlıklar & Mimariler",
      vhdlPackages: "Paketler & Tipler",
      vhdlConcurrent: "Eşzamanlı & Sıralı İfadeler",
      vhdlLinter: "VHDL Linter Tanılaması",

      xdcGroup: "Xilinx Tasarım Kısıtlamaları (XDC)",
      xdcArch: "Kısıtlama Mimarisi",
      xdcPhysical: "Fiziksel Kısıtlamalar",
      xdcClock: "Saat Kısıtlamaları",
      xdcIo: "G/Ç Zamanlama Kısıtlamaları",
      xdcExceptions: "Zamanlama İstisnaları",
      xdcLsp: "Monaco XDC Dil Sunucusu",

      primGroup: "Xilinx Primitif Kitaplığı",
      primArch: "Motor İçi Mimari",
      primClb: "CLB & Mantık Hücreleri",
      primClock: "Saat & G/Ç Tamponları",
      primDsp: "DSP48 Aritmetik Dilimleri",
      primBram: "Blok RAM (RAMB)",

      gettingStarted: "Başlarken",
      guideIntro: "Giriş & Manifesto",
      guideQuickstart: "Hızlı Başlangıç (60 Saniyede Kurulum)",
      guideDesktopWeb: "Masaüstü & Web Mimarisi",

      coreArch: "Çekirdek Mimari",
      archJit: "RAM İçi Cranelift JIT",
      archArena: "4 Durumlu Mantık Arenası",
      archScheduler: "Katmanlı Olay Zamanlayıcı",
      archPower: "Fiziksel Güç & PDN Telemetrisi",

      vivadoGroup: "Vivado Uyumluluğu",
      vivadoMigration: "Vivado'dan Geçiş",
      vivadoSaifVcd: "SAIF & VCD Birlikte Çalışabilirlik",
      vivadoMatrix: "Özellik Karşılaştırma Matrisi",

      refGroup: "Referans Kılavuzu",
      refCli: "CLI Komutları & Seçenekleri"
    }
  },

  de: {
    label: "Deutsch",
    lang: "de-DE",
    description: "HDL-Prozessor der nächsten Generation im RAM, Cranelift JIT-Simulator und Silizium-Telemetrie-Engine",
    outlineTitle: "Auf dieser Seite",
    docFooterPrev: "Vorherige Seite",
    docFooterNext: "Nächste Seite",
    lastUpdatedText: "Zuletzt aktualisiert",
    darkModeSwitchLabel: "Erscheinungsbild",
    sidebarMenuLabel: "Menü",
    returnToTopLabel: "Zurück nach oben",
    nav: {
      guide: "Leitfaden",
      studioUi: "Studio UI",
      verilogHdl: "Verilog HDL",
      languages: "Sprachen",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "XDC Constraints",
      primitives: "Xilinx Primitiven",
      architecture: "Architektur",
      vivadoMigration: "Vivado Migration",
      cliReference: "CLI Referenz",
      webStudio: "Web Studio",
      version: "v1.0.0",
      changelog: "Änderungsprotokoll",
      platform: "Aerovex Plattform"
    },
    sidebar: {
      studioWorkspace: "Axiom Studio Arbeitsbereich",
      studioOverview: "Studio Übersicht & Tastenkürzel",
      projectsLifecycle: "Projekte & Dateisätze",
      securitySandbox: "Sicherheit & Sandboxing",
      coreDesignViews: "Design- & Bearbeitungsansichten",
      monacoEditor: "Monaco HDL Editor & LSP",
      schematicViewer: "Schematischer DAG Visualisierer",
      virtualLab: "Virtuelles Labor & Basys 3",
      analysisViews: "Analyse- & Telemetrieansichten",
      waveformViewer: "Signalverläufe & Logikanalysator",
      timingRadar: "Timing-Radar & STA",
      telemetryEnergy: "Silizium-Telemetrie & Energie",
      advancedSynthesis: "Erweiterte Synthese & Floorplanning",
      techMapping: "Technologie-Mapping",
      floorplanning: "Silizium-Floorplanning",
      formalVerification: "Formale Verifikation (BMC)",
      protocolAnalyzer: "Protokoll-Analysator",
      microarchitecture: "Mikroarchitektur & Multi-Die",
      controlsDiagnostics: "Steuerung & Diagnose",
      simulationDock: "Simulations-Dock & Konsole",

      otherLanguages: "Weitere Sprachen",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "Sprachübersicht",
      dataTypesNets: "Datentypen & Netze",
      operatorsExprs: "Operatoren & Ausdrücke",
      continuousAssigns: "Kontinuierliche Zuweisungen",
      proceduralBlocks: "Prozedurale Blöcke & Timing",
      controlFlow: "Ablaufsteuerungs-Anweisungen",
      modulesHierarchy: "Module & Hierarchie",
      tasksFunctions: "Tasks & Funktionen",
      systemTasks: "System-Tasks & E/A",
      linterRules: "Statische Linter-Regeln",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "Datentypen & Deklarationen",
      svProcesses: "Spezialisierte Prozesse",
      svInterfaces: "Schnittstellen & Pakete",
      svAssertions: "Assertionen (SVA) & Formal",
      svConstrained: "Eingeschränkte Zufallsgenerierung",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "Entitäten & Architekturen",
      vhdlPackages: "Pakete & Typen",
      vhdlConcurrent: "Nebenläufig & Sequenziell",
      vhdlLinter: "VHDL Linter-Diagnose",

      xdcGroup: "Xilinx Design Constraints (XDC)",
      xdcArch: "Constraints-Architektur",
      xdcPhysical: "Physische Constraints",
      xdcClock: "Takt-Constraints",
      xdcIo: "E/A-Timing-Constraints",
      xdcExceptions: "Timing-Ausnahmen",
      xdcLsp: "Monaco XDC Sprachserver",

      primGroup: "Xilinx Primitiven-Bibliothek",
      primArch: "Engine-interne Architektur",
      primClb: "CLB & Logikzellen",
      primClock: "Taktung & E/A-Puffer",
      primDsp: "DSP48 Arithmetik-Slices",
      primBram: "Block-RAM (RAMB)",

      gettingStarted: "Erste Schritte",
      guideIntro: "Einführung & Manifest",
      guideQuickstart: "Schnellstart (60-Sekunden-Setup)",
      guideDesktopWeb: "Desktop- & Web-Architektur",

      coreArch: "Kern-Architektur",
      archJit: "Cranelift JIT im RAM",
      archArena: "4-Zustands-Logikarena",
      archScheduler: "Schichten-Ereignis-Scheduler",
      archPower: "Physikalische Leistung & PDN-Telemetrie",

      vivadoGroup: "Vivado Suite Parität",
      vivadoMigration: "Migration von Vivado",
      vivadoSaifVcd: "SAIF & VCD Interoperabilität",
      vivadoMatrix: "Feature-Vergleichsmatrix",

      refGroup: "Referenzhandbuch",
      refCli: "CLI-Befehle & Optionen"
    }
  },

  ja: {
    label: "日本語",
    lang: "ja-JP",
    description: "次世代インRAM HDLプロセッサ、Cranelift JITシミュレータ＆シリコンテレメトリエンジン",
    outlineTitle: "目次",
    docFooterPrev: "前のページ",
    docFooterNext: "次のページ",
    lastUpdatedText: "最終更新",
    darkModeSwitchLabel: "外観",
    sidebarMenuLabel: "メニュー",
    returnToTopLabel: "トップに戻る",
    nav: {
      guide: "ガイド",
      studioUi: "Studio UI",
      verilogHdl: "Verilog HDL",
      languages: "言語",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "XDC制約",
      primitives: "Xilinxプリミティブ",
      architecture: "アーキテクチャ",
      vivadoMigration: "Vivado移行",
      cliReference: "CLIリファレンス",
      webStudio: "Web Studio",
      version: "v1.0.0",
      changelog: "変更履歴",
      platform: "Aerovexプラットフォーム"
    },
    sidebar: {
      studioWorkspace: "Axiom Studio ワークスペース",
      studioOverview: "Studio概要＆ショートカット",
      projectsLifecycle: "プロジェクト＆ファイルセット",
      securitySandbox: "セキュリティ＆サンドボックス",
      coreDesignViews: "設計＆編集ビュー",
      monacoEditor: "Monaco HDLエディタ＆LSP",
      schematicViewer: "回路図DAGビジュアライザ",
      virtualLab: "バーチャルラボ＆Basys 3",
      analysisViews: "解析＆テレメトリビュー",
      waveformViewer: "波形＆ロジックアナライザ",
      timingRadar: "タイミングレーダー＆STA",
      telemetryEnergy: "シリコンテレメトリ＆消費電力",
      advancedSynthesis: "高度な論理合成＆配置",
      techMapping: "テクノロジマッピング",
      floorplanning: "シリコンフロアプラン",
      formalVerification: "形式検証 (BMC)",
      protocolAnalyzer: "プロトコルアナライザ",
      microarchitecture: "マイクロアーキテクチャ＆マルチダイ",
      controlsDiagnostics: "制御＆診断",
      simulationDock: "シミュレーションドック＆コンソール",

      otherLanguages: "その他の言語",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "言語概要",
      dataTypesNets: "データ型＆ネット",
      operatorsExprs: "演算子＆式",
      continuousAssigns: "継続的代入 (assign)",
      proceduralBlocks: "プロシージャルブロック＆タイミング",
      controlFlow: "制御フロー文",
      modulesHierarchy: "モジュール＆階層構造",
      tasksFunctions: "タスク＆関数",
      systemTasks: "システムタスク＆入出力",
      linterRules: "静的リンター規則",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "データ型＆宣言",
      svProcesses: "専用プロセス",
      svInterfaces: "インターフェース＆パッケージ",
      svAssertions: "アサーション (SVA)＆形式検証",
      svConstrained: "制約付きランダム化",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "エンティティ＆アーキテクチャ",
      vhdlPackages: "パッケージ＆型",
      vhdlConcurrent: "並行＆逐次処理",
      vhdlLinter: "VHDLリンター診断",

      xdcGroup: "Xilinx設計制約 (XDC)",
      xdcArch: "制約アーキテクチャ",
      xdcPhysical: "物理的制約",
      xdcClock: "クロック制約",
      xdcIo: "入出力タイミング制約",
      xdcExceptions: "タイミング例外",
      xdcLsp: "Monaco XDC言語サーバー",

      primGroup: "Xilinxプリミティブライブラリ",
      primArch: "エンジン内蔵アーキテクチャ",
      primClb: "CLB＆論理セル",
      primClock: "クロック＆入出力バッファ",
      primDsp: "DSP48演算スライス",
      primBram: "ブロックRAM (RAMB)",

      gettingStarted: "はじめに",
      guideIntro: "導入＆マニフェスト",
      guideQuickstart: "クイックスタート (60秒セットアップ)",
      guideDesktopWeb: "デスクトップ＆Webアーキテクチャ",

      coreArch: "コアアーキテクチャ",
      archJit: "インRAM Cranelift JIT",
      archArena: "4値論理ステートアリーナ",
      archScheduler: "階層化イベントスケジューラ",
      archPower: "物理電力＆PDNテレメトリ",

      vivadoGroup: "Vivado互換性",
      vivadoMigration: "Vivadoからの移行",
      vivadoSaifVcd: "SAIF＆VCD相互運用性",
      vivadoMatrix: "機能比較マトリックス",

      refGroup: "リファレンスマニュアル",
      refCli: "CLIコマンド＆オプション"
    }
  },

  zh: {
    label: "简体中文",
    lang: "zh-CN",
    description: "下一代内存原生 HDL 处理器、Cranelift JIT 仿真器与芯片遥测引擎",
    outlineTitle: "本页目录",
    docFooterPrev: "上一页",
    docFooterNext: "下一页",
    lastUpdatedText: "最后更新",
    darkModeSwitchLabel: "外观",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    nav: {
      guide: "指南",
      studioUi: "Studio 界面",
      verilogHdl: "Verilog HDL",
      languages: "硬件描述语言",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "XDC 约束",
      primitives: "Xilinx 原语库",
      architecture: "核心架构",
      vivadoMigration: "Vivado 迁移",
      cliReference: "CLI 参考手册",
      webStudio: "网页版 Studio",
      version: "v1.0.0",
      changelog: "更新日志",
      platform: "Aerovex 平台"
    },
    sidebar: {
      studioWorkspace: "Axiom Studio 工作区",
      studioOverview: "工作区概览与快捷键",
      projectsLifecycle: "工程管理与文件集",
      securitySandbox: "安全模型与沙箱隔离",
      coreDesignViews: "核心设计与编辑视图",
      monacoEditor: "Monaco HDL 编辑器与 LSP",
      schematicViewer: "门级原理图 DAG 可视化",
      virtualLab: "虚拟硬件实验台与 Basys 3",
      analysisViews: "分析与硅芯片遥测视图",
      waveformViewer: "高密度数字波形与逻辑分析",
      timingRadar: "静态时序分析 (STA) 雷达",
      telemetryEnergy: "芯片动态功耗与 PDN 压降遥测",
      advancedSynthesis: "高级综合与布局规划",
      techMapping: "门级技术映射 (Tech Mapping)",
      floorplanning: "硅片布局规划 (Floorplanning)",
      formalVerification: "形式化验证 (BMC 限界模型检查)",
      protocolAnalyzer: "协议分析仪 (UART/SPI/I2C/CAN)",
      microarchitecture: "微架构检查与 Multi-Die MCM",
      controlsDiagnostics: "仿真控制与系统诊断",
      simulationDock: "仿真操作面板与 REPL 控制台",

      otherLanguages: "其他支持语言",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "语言概览",
      dataTypesNets: "数据类型与连线网表",
      operatorsExprs: "运算符与表达式优先级",
      continuousAssigns: "持续赋值 (assign)",
      proceduralBlocks: "过程块与仿真时钟调度",
      controlFlow: "分支与循环流程控制语句",
      modulesHierarchy: "模块定义与层次化例化",
      tasksFunctions: "任务 (Tasks) 与函数 (Functions)",
      systemTasks: "系统任务与文件输入输出",
      linterRules: "内存原生静态检查规则",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "增强数据类型与声明",
      svProcesses: "专用过程块 (always_comb/ff)",
      svInterfaces: "接口 (Interface) 与包机制",
      svAssertions: "断言系统 (SVA) 与形式化验证",
      svConstrained: "约束随机测试平台生成",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "实体 (Entity) 与架构 (Architecture)",
      vhdlPackages: "标准程序包与数据类型",
      vhdlConcurrent: "并行赋值与顺序进程",
      vhdlLinter: "VHDL 语言诊断与规则",

      xdcGroup: "Xilinx 设计约束 (XDC)",
      xdcArch: "物理与时序约束架构",
      xdcPhysical: "管脚与电气标准约束",
      xdcClock: "时钟定义与不确定度约束",
      xdcIo: "端口输入输出延迟约束",
      xdcExceptions: "时序异常 (False/Multicycle Path)",
      xdcLsp: "Monaco XDC 语言服务器与自动补全",

      primGroup: "Xilinx 7 系列与 UltraScale+ 原语",
      primArch: "原生内置原语无缝降解机制",
      primClb: "可配置逻辑块 (CLB) 与 LUT 原语",
      primClock: "全局时钟网络与缓冲器 (BUFG/IBUF)",
      primDsp: "DSP48 乘加硬件算术单元",
      primBram: "块状双端口静态内存 (RAMB36)",

      gettingStarted: "快速上手",
      guideIntro: "产品介绍与核心使命宣言",
      guideQuickstart: "快速开始 (60 秒极速体验)",
      guideDesktopWeb: "桌面原生与 WebAssembly 架构",

      coreArch: "底层内核架构",
      archJit: "内存原生 Cranelift JIT 编译器",
      archArena: "四态逻辑 (0/1/X/Z) 内存管理",
      archScheduler: "分层事件队列与 Delta 周期调度",
      archPower: "物理功耗模型与 PDN 电感压降",

      vivadoGroup: "AMD Vivado 兼容性与迁移",
      vivadoMigration: "从 Vivado 平滑迁移指南",
      vivadoSaifVcd: "SAIF 功耗与 VCD 波形互操作性",
      vivadoMatrix: "深度特性对比矩阵与性能测试",

      refGroup: "命令行与参考手册",
      refCli: "Axiom CLI 统一命令行接口"
    }
  },

  es: {
    label: "Español",
    lang: "es-ES",
    description: "Procesador HDL en RAM de última generación, simulador JIT Cranelift y motor de telemetría de silicio",
    outlineTitle: "En esta página",
    docFooterPrev: "Página anterior",
    docFooterNext: "Página siguiente",
    lastUpdatedText: "Última actualización",
    darkModeSwitchLabel: "Apariencia",
    sidebarMenuLabel: "Menú",
    returnToTopLabel: "Volver arriba",
    nav: {
      guide: "Guía",
      studioUi: "Studio UI",
      verilogHdl: "Verilog HDL",
      languages: "Lenguajes",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "Restricciones XDC",
      primitives: "Primitivas Xilinx",
      architecture: "Arquitectura",
      vivadoMigration: "Migración de Vivado",
      cliReference: "Referencia CLI",
      webStudio: "Web Studio",
      version: "v1.0.0",
      changelog: "Registro de cambios",
      platform: "Plataforma Aerovex"
    },
    sidebar: {
      studioWorkspace: "Espacio de trabajo Axiom Studio",
      studioOverview: "Resumen de Studio y atajos",
      projectsLifecycle: "Proyectos y conjuntos de archivos",
      securitySandbox: "Seguridad y aislamiento",
      coreDesignViews: "Vistas de diseño y edición",
      monacoEditor: "Editor Monaco HDL y LSP",
      schematicViewer: "Visualizador DAG esquemático",
      virtualLab: "Laboratorio virtual y Basys 3",
      analysisViews: "Vistas de análisis y telemetría",
      waveformViewer: "Formas de onda y analizador lógico",
      timingRadar: "Radar de temporización y STA",
      telemetryEnergy: "Telemetría de silicio y energía",
      advancedSynthesis: "Síntesis avanzada y floorplanning",
      techMapping: "Mapeo tecnológico (Tech Mapping)",
      floorplanning: "Floorplanning de silicio",
      formalVerification: "Verificación formal (BMC)",
      protocolAnalyzer: "Analizador de protocolos",
      microarchitecture: "Microarquitectura y Multi-Die",
      controlsDiagnostics: "Controles y diagnósticos",
      simulationDock: "Panel de simulación y consola",

      otherLanguages: "Otros lenguajes",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "Resumen del lenguaje",
      dataTypesNets: "Tipos de datos y redes",
      operatorsExprs: "Operadores y expresiones",
      continuousAssigns: "Asignaciones continuas",
      proceduralBlocks: "Bloques procedimentales y temporización",
      controlFlow: "Sentencias de control de flujo",
      modulesHierarchy: "Módulos y jerarquía",
      tasksFunctions: "Tareas y funciones",
      systemTasks: "Tareas del sistema y E/S",
      linterRules: "Reglas de linter estático",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "Tipos de datos y declaraciones",
      svProcesses: "Procesos especializados",
      svInterfaces: "Interfaces y paquetes",
      svAssertions: "Aserciones (SVA) y formal",
      svConstrained: "Aleatorización restringida",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "Entidades y arquitecturas",
      vhdlPackages: "Paquetes y tipos",
      vhdlConcurrent: "Concurrente y secuencial",
      vhdlLinter: "Diagnósticos de linter VHDL",

      xdcGroup: "Restricciones de diseño Xilinx (XDC)",
      xdcArch: "Arquitectura de restricciones",
      xdcPhysical: "Restricciones físicas",
      xdcClock: "Restricciones de reloj",
      xdcIo: "Restricciones de temporización de E/S",
      xdcExceptions: "Excepciones de temporización",
      xdcLsp: "Servidor de lenguaje Monaco XDC",

      primGroup: "Biblioteca de primitivas Xilinx",
      primArch: "Arquitectura integrada",
      primClb: "CLB y celdas lógicas",
      primClock: "Relojes y búferes de E/S",
      primDsp: "Slices aritméticos DSP48",
      primBram: "Bloques RAM (RAMB)",

      gettingStarted: "Primeros pasos",
      guideIntro: "Introducción y manifiesto",
      guideQuickstart: "Inicio rápido (configuración en 60 segundos)",
      guideDesktopWeb: "Arquitectura de escritorio y web",

      coreArch: "Arquitectura principal",
      archJit: "JIT Cranelift en RAM",
      archArena: "Arena de lógica de 4 estados",
      archScheduler: "Planificador de eventos estratificado",
      archPower: "Potencia física y telemetría PDN",

      vivadoGroup: "Compatibilidad con Vivado",
      vivadoMigration: "Migración desde Vivado",
      vivadoSaifVcd: "Interoperabilidad SAIF y VCD",
      vivadoMatrix: "Matriz comparativa de características",

      refGroup: "Manual de referencia",
      refCli: "Comandos y opciones de CLI"
    }
  },

  fr: {
    label: "Français",
    lang: "fr-FR",
    description: "Processeur HDL en RAM de nouvelle génération, simulateur JIT Cranelift et moteur de télémétrie sur silicium",
    outlineTitle: "Sur cette page",
    docFooterPrev: "Page précédente",
    docFooterNext: "Page suivante",
    lastUpdatedText: "Dernière mise à jour",
    darkModeSwitchLabel: "Apparence",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Retour en haut",
    nav: {
      guide: "Guide",
      studioUi: "Studio UI",
      verilogHdl: "Verilog HDL",
      languages: "Langages",
      verilog: "Verilog HDL (IEEE 1364)",
      systemVerilog: "SystemVerilog (IEEE 1800)",
      vhdl: "VHDL (IEEE 1076)",
      xdc: "Contraintes XDC",
      primitives: "Primitives Xilinx",
      architecture: "Architecture",
      vivadoMigration: "Migration Vivado",
      cliReference: "Référence CLI",
      webStudio: "Web Studio",
      version: "v1.0.0",
      changelog: "Journal des modifications",
      platform: "Plateforme Aerovex"
    },
    sidebar: {
      studioWorkspace: "Espace de travail Axiom Studio",
      studioOverview: "Aperçu de Studio et raccourcis",
      projectsLifecycle: "Projets et ensembles de fichiers",
      securitySandbox: "Sécurité et isolation",
      coreDesignViews: "Vues de conception et d'édition",
      monacoEditor: "Éditeur Monaco HDL et LSP",
      schematicViewer: "Visualiseur DAG schématique",
      virtualLab: "Laboratoire virtuel et Basys 3",
      analysisViews: "Vues d'analyse et télémétrie",
      waveformViewer: "Formes d'onde et analyseur logique",
      timingRadar: "Radar de temporisation et STA",
      telemetryEnergy: "Télémétrie silicium et énergie",
      advancedSynthesis: "Synthèse avancée et floorplanning",
      techMapping: "Mappage technologique (Tech Mapping)",
      floorplanning: "Floorplanning silicium",
      formalVerification: "Vérification formelle (BMC)",
      protocolAnalyzer: "Analyseur de protocoles",
      microarchitecture: "Microarchitecture et Multi-Die",
      controlsDiagnostics: "Contrôles et diagnostics",
      simulationDock: "Panneau de simulation et console",

      otherLanguages: "Autres langages",

      verilogGroup: "Verilog HDL (IEEE 1364)",
      langOverview: "Aperçu du langage",
      dataTypesNets: "Types de données et équipotentielles",
      operatorsExprs: "Opérateurs et expressions",
      continuousAssigns: "Assignations continues",
      proceduralBlocks: "Blocs procéduraux et timing",
      controlFlow: "Instructions de contrôle de flux",
      modulesHierarchy: "Modules et hiérarchie",
      tasksFunctions: "Tâches et fonctions",
      systemTasks: "Tâches système et E/S",
      linterRules: "Règles de linter statique",

      svGroup: "SystemVerilog (IEEE 1800)",
      svTypes: "Types de données et déclarations",
      svProcesses: "Processus spécialisés",
      svInterfaces: "Interfaces et paquets",
      svAssertions: "Assertions (SVA) et formel",
      svConstrained: "Aléatoire sous contraintes",

      vhdlGroup: "VHDL (IEEE 1076)",
      vhdlEntities: "Entités et architectures",
      vhdlPackages: "Paquets et types",
      vhdlConcurrent: "Concurrent et séquentiel",
      vhdlLinter: "Diagnostics linter VHDL",

      xdcGroup: "Contraintes de conception Xilinx (XDC)",
      xdcArch: "Architecture des contraintes",
      xdcPhysical: "Contraintes physiques",
      xdcClock: "Contraintes d'horloge",
      xdcIo: "Contraintes de timing d'E/S",
      xdcExceptions: "Exceptions de timing",
      xdcLsp: "Serveur de langage Monaco XDC",

      primGroup: "Bibliothèque de primitives Xilinx",
      primArch: "Architecture intégrée",
      primClb: "CLB et cellules logiques",
      primClock: "Horloges et tampons d'E/S",
      primDsp: "Slices arithmétiques DSP48",
      primBram: "Mémoires RAM bloc (RAMB)",

      gettingStarted: "Pour commencer",
      guideIntro: "Introduction et manifeste",
      guideQuickstart: "Démarrage rapide (installation en 60s)",
      guideDesktopWeb: "Architecture bureau et web",

      coreArch: "Architecture du noyau",
      archJit: "JIT Cranelift en RAM",
      archArena: "Arène logique à 4 états",
      archScheduler: "Planificateur d'événements stratifié",
      archPower: "Puissance physique et télémétrie PDN",

      vivadoGroup: "Compatibilité Vivado",
      vivadoMigration: "Migration depuis Vivado",
      vivadoSaifVcd: "Interopérabilité SAIF et VCD",
      vivadoMatrix: "Matrice de comparaison des fonctionnalités",

      refGroup: "Manuel de référence",
      refCli: "Commandes et options de la CLI"
    }
  }
};

export function getNav(prefix: string, lang: string = "en"): DefaultTheme.NavItem[] {
  const l = (LOCALES_DATA[lang] || LOCALES_DATA.en).nav;
  const p = prefix ? `${prefix}` : "";

  return [
    { text: l.guide, link: `${p}/guide/introduction` },
    { text: l.studioUi, link: `${p}/ui/overview` },
    { text: l.verilogHdl, link: `${p}/languages/verilog/overview` },
    {
      text: l.languages,
      items: [
        { text: l.verilog, link: `${p}/languages/verilog/overview` },
        { text: l.systemVerilog, link: `${p}/languages/systemverilog/overview` },
        { text: l.vhdl, link: `${p}/languages/vhdl/overview` },
        { text: l.xdc, link: `${p}/languages/xdc/overview` },
        { text: l.primitives, link: `${p}/languages/primitives/overview` }
      ]
    },
    { text: l.architecture, link: `${p}/architecture/in-ram-jit` },
    { text: l.vivadoMigration, link: `${p}/vivado/migration` },
    { text: l.cliReference, link: `${p}/reference/cli` },
    { text: l.webStudio, link: "/studio/", target: "_blank" },
    {
      text: l.version,
      items: [
        { text: l.changelog, link: "https://github.com/aerovexsim/axiom/releases" },
        { text: l.platform, link: "https://aerovex.net" }
      ]
    }
  ];
}

export function getSidebar(prefix: string, lang: string = "en"): DefaultTheme.Sidebar {
  const s = (LOCALES_DATA[lang] || LOCALES_DATA.en).sidebar;
  const p = prefix ? `${prefix}` : "";

  const otherLangs = [
    { text: s.verilogGroup, link: `${p}/languages/verilog/overview` },
    { text: s.svGroup, link: `${p}/languages/systemverilog/overview` },
    { text: s.vhdlGroup, link: `${p}/languages/vhdl/overview` },
    { text: s.xdcGroup, link: `${p}/languages/xdc/overview` },
    { text: s.primGroup, link: `${p}/languages/primitives/overview` }
  ];

  return {
    [`${p}/ui/`]: [
      {
        text: s.studioWorkspace,
        items: [
          { text: s.studioOverview, link: `${p}/ui/overview` },
          { text: s.projectsLifecycle, link: `${p}/ui/projects-lifecycle` },
          { text: s.securitySandbox, link: `${p}/ui/security-sandbox` }
        ]
      },
      {
        text: s.coreDesignViews,
        items: [
          { text: s.monacoEditor, link: `${p}/ui/monaco-editor` },
          { text: s.schematicViewer, link: `${p}/ui/schematic-viewer` },
          { text: s.virtualLab, link: `${p}/ui/virtual-lab` }
        ]
      },
      {
        text: s.analysisViews,
        items: [
          { text: s.waveformViewer, link: `${p}/ui/waveform-viewer` },
          { text: s.timingRadar, link: `${p}/ui/timing-radar` },
          { text: s.telemetryEnergy, link: `${p}/ui/telemetry-energy` }
        ]
      },
      {
        text: s.advancedSynthesis,
        items: [
          { text: s.techMapping, link: `${p}/ui/tech-mapping` },
          { text: s.floorplanning, link: `${p}/ui/floorplanning` },
          { text: s.formalVerification, link: `${p}/ui/formal-verification` },
          { text: s.protocolAnalyzer, link: `${p}/ui/protocol-analyzer` },
          { text: s.microarchitecture, link: `${p}/ui/microarchitecture` }
        ]
      },
      {
        text: s.controlsDiagnostics,
        items: [
          { text: s.simulationDock, link: `${p}/ui/simulation-dock` }
        ]
      }
    ],

    [`${p}/languages/verilog/`]: [
      {
        text: s.verilogGroup,
        items: [
          { text: s.langOverview, link: `${p}/languages/verilog/overview` },
          { text: s.dataTypesNets, link: `${p}/languages/verilog/data-types-nets` },
          { text: s.operatorsExprs, link: `${p}/languages/verilog/operators-expressions` },
          { text: s.continuousAssigns, link: `${p}/languages/verilog/continuous-assigns` },
          { text: s.proceduralBlocks, link: `${p}/languages/verilog/procedural-blocks` },
          { text: s.controlFlow, link: `${p}/languages/verilog/control-flow` },
          { text: s.modulesHierarchy, link: `${p}/languages/verilog/modules-hierarchy` },
          { text: s.tasksFunctions, link: `${p}/languages/verilog/tasks-functions` },
          { text: s.systemTasks, link: `${p}/languages/verilog/system-tasks` },
          { text: s.linterRules, link: `${p}/languages/verilog/linter-diagnostics` }
        ]
      },
      {
        text: s.otherLanguages,
        items: otherLangs.filter((item) => !item.link.includes("/verilog/"))
      }
    ],

    [`${p}/languages/systemverilog/`]: [
      {
        text: s.svGroup,
        items: [
          { text: s.langOverview, link: `${p}/languages/systemverilog/overview` },
          { text: s.svTypes, link: `${p}/languages/systemverilog/types-declarations` },
          { text: s.svProcesses, link: `${p}/languages/systemverilog/specialized-processes` },
          { text: s.svInterfaces, link: `${p}/languages/systemverilog/interfaces-packages` },
          { text: s.svAssertions, link: `${p}/languages/systemverilog/assertions-sva` },
          { text: s.svConstrained, link: `${p}/languages/systemverilog/constrained-random` }
        ]
      },
      {
        text: s.otherLanguages,
        items: otherLangs.filter((item) => !item.link.includes("/systemverilog/"))
      }
    ],

    [`${p}/languages/vhdl/`]: [
      {
        text: s.vhdlGroup,
        items: [
          { text: s.langOverview, link: `${p}/languages/vhdl/overview` },
          { text: s.vhdlEntities, link: `${p}/languages/vhdl/entities-architectures` },
          { text: s.vhdlPackages, link: `${p}/languages/vhdl/packages-types` },
          { text: s.vhdlConcurrent, link: `${p}/languages/vhdl/concurrent-sequential` },
          { text: s.vhdlLinter, link: `${p}/languages/vhdl/linter-rules` }
        ]
      },
      {
        text: s.otherLanguages,
        items: otherLangs.filter((item) => !item.link.includes("/vhdl/"))
      }
    ],

    [`${p}/languages/xdc/`]: [
      {
        text: s.xdcGroup,
        items: [
          { text: s.langOverview, link: `${p}/languages/xdc/overview` },
          { text: s.xdcPhysical, link: `${p}/languages/xdc/physical-constraints` },
          { text: s.xdcClock, link: `${p}/languages/xdc/clock-constraints` },
          { text: s.xdcIo, link: `${p}/languages/xdc/io-timing` },
          { text: s.xdcExceptions, link: `${p}/languages/xdc/timing-exceptions` },
          { text: s.xdcLsp, link: `${p}/languages/xdc/lsp-and-validation` }
        ]
      },
      {
        text: s.otherLanguages,
        items: otherLangs.filter((item) => !item.link.includes("/xdc/"))
      }
    ],

    [`${p}/languages/primitives/`]: [
      {
        text: s.primGroup,
        items: [
          { text: s.primArch, link: `${p}/languages/primitives/overview` },
          { text: s.primClb, link: `${p}/languages/primitives/clb-and-logic` },
          { text: s.primClock, link: `${p}/languages/primitives/clocking-and-io` },
          { text: s.primDsp, link: `${p}/languages/primitives/dsp-slices` },
          { text: s.primBram, link: `${p}/languages/primitives/block-ram` }
        ]
      },
      {
        text: s.otherLanguages,
        items: otherLangs.filter((item) => !item.link.includes("/primitives/"))
      }
    ],

    [`${p}/guide/`]: [
      {
        text: s.gettingStarted,
        items: [
          { text: s.guideIntro, link: `${p}/guide/introduction` },
          { text: s.guideQuickstart, link: `${p}/guide/quickstart` },
          { text: s.guideDesktopWeb, link: `${p}/guide/desktop-web` }
        ]
      }
    ],

    [`${p}/architecture/`]: [
      {
        text: s.coreArch,
        items: [
          { text: s.archJit, link: `${p}/architecture/in-ram-jit` },
          { text: s.archArena, link: `${p}/architecture/four-state-arena` },
          { text: s.archScheduler, link: `${p}/architecture/stratified-scheduler` },
          { text: s.archPower, link: `${p}/architecture/power-pdn-telemetry` }
        ]
      }
    ],

    [`${p}/vivado/`]: [
      {
        text: s.vivadoGroup,
        items: [
          { text: s.vivadoMigration, link: `${p}/vivado/migration` },
          { text: s.vivadoSaifVcd, link: `${p}/vivado/saif-vcd-interop` },
          { text: s.vivadoMatrix, link: `${p}/vivado/feature-matrix` }
        ]
      }
    ],

    [`${p}/reference/`]: [
      {
        text: s.refGroup,
        items: [
          { text: s.refCli, link: `${p}/reference/cli` }
        ]
      }
    ]
  };
}
