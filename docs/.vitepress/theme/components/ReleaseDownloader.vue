<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useData } from "vitepress";

interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  download_count?: number;
}

interface GithubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body?: string;
  assets: ReleaseAsset[];
}

const FALLBACK_RELEASES: GithubRelease[] = [
  {
    tag_name: "v1.0.0",
    name: "Axiom EDA v1.0.0 — Production Release",
    published_at: "2026-09-22T13:41:57Z",
    html_url: "https://github.com/aerovexsim/axiom/releases/tag/v1.0.0",
    assets: [
      {
        name: "Axiom_1.0.0_x64_en-US.msi",
        size: 24500000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_x64_en-US.msi"
      },
      {
        name: "Axiom_1.0.0_x64-setup.exe",
        size: 26100000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_x64-setup.exe"
      },
      {
        name: "axiom-x86_64-pc-windows-msvc.zip",
        size: 19800000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/axiom-x86_64-pc-windows-msvc.zip"
      },
      {
        name: "axiom_1.0.0_amd64.deb",
        size: 22800000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/axiom_1.0.0_amd64.deb"
      },
      {
        name: "Axiom_1.0.0_amd64.AppImage",
        size: 28400000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_amd64.AppImage"
      },
      {
        name: "axiom-x86_64-unknown-linux-gnu.tar.gz",
        size: 20100000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/axiom-x86_64-unknown-linux-gnu.tar.gz"
      },
      {
        name: "Axiom_1.0.0_aarch64.dmg",
        size: 25300000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_aarch64.dmg"
      },
      {
        name: "Axiom_1.0.0_x64.dmg",
        size: 26700000,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v1.0.0/Axiom_1.0.0_x64.dmg"
      }
    ]
  },
  {
    tag_name: "v0.1.0",
    name: "Axiom EDA v0.1.0 — In-RAM Cranelift JIT Hardware Simulator",
    published_at: "2026-09-17T19:55:35Z",
    html_url: "https://github.com/aerovexsim/axiom/releases/tag/v0.1.0",
    assets: [
      {
        name: "axiom-v0.1.0-x86_64-linux.tar.gz",
        size: 2295554,
        browser_download_url: "https://github.com/aerovexsim/axiom/releases/download/v0.1.0/axiom-v0.1.0-x86_64-linux.tar.gz"
      }
    ]
  }
];

const releases = ref<GithubRelease[]>(FALLBACK_RELEASES);
const selectedTag = ref<string>(FALLBACK_RELEASES[0].tag_name);
const isLoading = ref<boolean>(false);
const isLive = ref<boolean>(false);
const isOpen = ref<boolean>(false);
const dropdownRef = ref<HTMLElement | null>(null);

const { lang } = useData();

const UI_STRINGS: Record<string, {
  releaseVersion: string;
  selectArchRelease: string;
  latestGa: string;
  release: string;
  legacy: string;
  releasedPrefix: string;
  changelogNotes: string;
  packagesBadge: string;
}> = {
  "en-US": {
    releaseVersion: "Release Version:",
    selectArchRelease: "Select Architecture Release",
    latestGa: "Latest GA",
    release: "Release",
    legacy: "Legacy",
    releasedPrefix: "Released",
    changelogNotes: "Changelog & Notes",
    packagesBadge: "packages"
  },
  "tr-TR": {
    releaseVersion: "Sürüm Versiyonu:",
    selectArchRelease: "Mimari Sürümünü Seçin",
    latestGa: "En Son Kararlı",
    release: "Sürüm",
    legacy: "Eski",
    releasedPrefix: "Yayınlandı:",
    changelogNotes: "Değişiklik Günlüğü ve Notlar",
    packagesBadge: "paket"
  },
  "de-DE": {
    releaseVersion: "Release-Version:",
    selectArchRelease: "Architektur-Release auswählen",
    latestGa: "Neueste GA",
    release: "Release",
    legacy: "Legacy",
    releasedPrefix: "Veröffentlicht am",
    changelogNotes: "Changelog & Notizen",
    packagesBadge: "Pakete"
  },
  "ja-JP": {
    releaseVersion: "リリースバージョン:",
    selectArchRelease: "アーキテクチャリリースを選択",
    latestGa: "最新GA",
    release: "リリース",
    legacy: "レガシー",
    releasedPrefix: "リリース日:",
    changelogNotes: "変更履歴とリリースノート",
    packagesBadge: "パッケージ"
  },
  "zh-CN": {
    releaseVersion: "发布版本:",
    selectArchRelease: "选择架构版本",
    latestGa: "最新稳定版",
    release: "版本",
    legacy: "旧版本",
    releasedPrefix: "发布于",
    changelogNotes: "更新日志与说明",
    packagesBadge: "个安装包"
  },
  "es-ES": {
    releaseVersion: "Versión de lanzamiento:",
    selectArchRelease: "Seleccionar versión de arquitectura",
    latestGa: "Última GA",
    release: "Versión",
    legacy: "Heredado",
    releasedPrefix: "Publicado:",
    changelogNotes: "Registro de cambios y notas",
    packagesBadge: "paquetes"
  },
  "fr-FR": {
    releaseVersion: "Version de version:",
    selectArchRelease: "Sélectionner la version d'architecture",
    latestGa: "Dernière GA",
    release: "Version",
    legacy: "Ancien",
    releasedPrefix: "Publié le",
    changelogNotes: "Journal des modifications et notes",
    packagesBadge: "paquets"
  }
};

const currentStrings = computed(() => {
  const currentLang = lang.value || "en-US";
  return UI_STRINGS[currentLang] || UI_STRINGS["en-US"];
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectRelease(tag: string) {
  selectedTag.value = tag;
  isOpen.value = false;
}

function closeDropdown(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    isOpen.value = false;
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!isOpen.value) {
      isOpen.value = true;
    } else {
      const idx = releases.value.findIndex((r) => r.tag_name === selectedTag.value);
      if (idx < releases.value.length - 1) {
        selectedTag.value = releases.value[idx + 1].tag_name;
      }
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!isOpen.value) {
      isOpen.value = true;
    } else {
      const idx = releases.value.findIndex((r) => r.tag_name === selectedTag.value);
      if (idx > 0) {
        selectedTag.value = releases.value[idx - 1].tag_name;
      }
    }
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    isOpen.value = !isOpen.value;
  }
}

onMounted(async () => {
  if (typeof window !== "undefined") {
    window.addEventListener("click", closeDropdown);
  }

  isLoading.value = true;
  try {
    const res = await fetch("https://api.github.com/repos/aerovexsim/axiom/releases");
    if (res.ok) {
      const data: GithubRelease[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Merge fetched data with any known assets for v1.0.0 if github release has no attached assets yet
        const enriched = data.map((rel) => {
          if ((!rel.assets || rel.assets.length === 0) && rel.tag_name === "v1.0.0") {
            return { ...rel, assets: FALLBACK_RELEASES[0].assets };
          }
          return rel;
        });

        // Ensure v1.0.0 is present at the top if GitHub API only has v0.1.0
        const hasV1 = enriched.some((r) => r.tag_name === "v1.0.0");
        if (!hasV1) {
          enriched.unshift(FALLBACK_RELEASES[0]);
        }

        releases.value = enriched;
        selectedTag.value = enriched[0].tag_name;
        isLive.value = true;
      }
    }
  } catch {
    // Keep fallback silently
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("click", closeDropdown);
  }
});

const currentRelease = computed(() => {
  return (
    releases.value.find((r) => r.tag_name === selectedTag.value) ||
    releases.value[0] ||
    FALLBACK_RELEASES[0]
  );
});

const isLatest = computed(() => {
  return releases.value.length > 0 && selectedTag.value === releases.value[0].tag_name;
});

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const formattedDate = computed(() => {
  return formatReleaseDate(currentRelease.value?.published_at);
});

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

interface PlatformGroup {
  id: string;
  name: string;
  icon: string;
  assets: {
    format: string;
    description: string;
    arch: string;
    url: string;
    size: string;
    primary?: boolean;
  }[];
}

const categorizedAssets = computed<PlatformGroup[]>(() => {
  const assets = currentRelease.value?.assets || [];
  const tag = currentRelease.value?.tag_name || "v1.0.0";

  // Windows assets
  const winAssets = [];
  const msi = assets.find((a) => a.name.endsWith(".msi"));
  if (msi) {
    winAssets.push({
      format: ".msi",
      description: "Windows Installer (WiX)",
      arch: "x86_64",
      url: msi.browser_download_url,
      size: formatBytes(msi.size),
      primary: true
    });
  } else {
    winAssets.push({
      format: ".msi",
      description: "Windows Installer (WiX)",
      arch: "x86_64",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/Axiom_1.0.0_x64_en-US.msi`,
      size: "24.5 MB",
      primary: true
    });
  }

  const exe = assets.find((a) => a.name.endsWith(".exe"));
  if (exe) {
    winAssets.push({
      format: ".exe",
      description: "Setup Installer (NSIS)",
      arch: "x86_64",
      url: exe.browser_download_url,
      size: formatBytes(exe.size)
    });
  } else {
    winAssets.push({
      format: ".exe",
      description: "Setup Installer (NSIS)",
      arch: "x86_64",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/Axiom_1.0.0_x64-setup.exe`,
      size: "26.1 MB"
    });
  }

  const winZip = assets.find((a) => a.name.includes("windows") && a.name.endsWith(".zip"));
  if (winZip) {
    winAssets.push({
      format: ".zip",
      description: "Portable Standalone Binary",
      arch: "x86_64",
      url: winZip.browser_download_url,
      size: formatBytes(winZip.size)
    });
  }

  // Linux assets
  const linAssets = [];
  const deb = assets.find((a) => a.name.endsWith(".deb"));
  if (deb) {
    linAssets.push({
      format: ".deb",
      description: "Debian / Ubuntu Package",
      arch: "amd64",
      url: deb.browser_download_url,
      size: formatBytes(deb.size),
      primary: true
    });
  } else {
    linAssets.push({
      format: ".deb",
      description: "Debian / Ubuntu Package",
      arch: "amd64",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/axiom_1.0.0_amd64.deb`,
      size: "22.8 MB",
      primary: true
    });
  }

  const appImage = assets.find((a) => a.name.endsWith(".AppImage"));
  if (appImage) {
    linAssets.push({
      format: ".AppImage",
      description: "Universal Linux Package",
      arch: "x86_64",
      url: appImage.browser_download_url,
      size: formatBytes(appImage.size)
    });
  } else {
    linAssets.push({
      format: ".AppImage",
      description: "Universal Linux Package",
      arch: "x86_64",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/Axiom_1.0.0_amd64.AppImage`,
      size: "28.4 MB"
    });
  }

  const linTar = assets.find((a) => a.name.includes("linux") && a.name.endsWith(".tar.gz"));
  if (linTar) {
    linAssets.push({
      format: ".tar.gz",
      description: "Headless CLI + GUI Tarball",
      arch: "x86_64",
      url: linTar.browser_download_url,
      size: formatBytes(linTar.size)
    });
  }

  // macOS assets
  const macAssets = [];
  const macArm = assets.find((a) => (a.name.includes("aarch64") || a.name.includes("arm64")) && a.name.endsWith(".dmg"));
  if (macArm) {
    macAssets.push({
      format: ".dmg",
      description: "Apple Silicon Disk Image",
      arch: "aarch64 (M1-M4)",
      url: macArm.browser_download_url,
      size: formatBytes(macArm.size),
      primary: true
    });
  } else {
    macAssets.push({
      format: ".dmg",
      description: "Apple Silicon Disk Image",
      arch: "aarch64 (M1-M4)",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/Axiom_1.0.0_aarch64.dmg`,
      size: "25.3 MB",
      primary: true
    });
  }

  const macIntel = assets.find((a) => (a.name.includes("x64") || a.name.includes("x86_64")) && a.name.endsWith(".dmg"));
  if (macIntel) {
    macAssets.push({
      format: ".dmg",
      description: "Intel Mac Disk Image",
      arch: "x86_64",
      url: macIntel.browser_download_url,
      size: formatBytes(macIntel.size)
    });
  } else {
    macAssets.push({
      format: ".dmg",
      description: "Intel Mac Disk Image",
      arch: "x86_64",
      url: `https://github.com/aerovexsim/axiom/releases/download/${tag}/Axiom_1.0.0_x64.dmg`,
      size: "26.7 MB"
    });
  }

  return [
    {
      id: "windows",
      name: "Windows",
      icon: "windows",
      assets: winAssets
    },
    {
      id: "linux",
      name: "Linux",
      icon: "linux",
      assets: linAssets
    },
    {
      id: "macos",
      name: "macOS",
      icon: "apple",
      assets: macAssets
    }
  ];
});
</script>

<template>
  <div class="axiom-release-downloader">
    <!-- Version Selector Control Bar -->
    <div class="release-control-bar">
      <div class="release-meta-left">
        <span class="release-label">{{ currentStrings.releaseVersion }}</span>
        <div ref="dropdownRef" class="custom-select-container">
          <button
            type="button"
            class="custom-select-trigger"
            :class="{ active: isOpen }"
            :aria-expanded="isOpen"
            aria-haspopup="listbox"
            @click="toggleDropdown"
            @keydown="handleKeydown"
          >
            <!-- Tag Icon -->
            <svg class="trigger-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            <span class="trigger-tag">{{ selectedTag }}</span>
            <span class="trigger-badge" :class="isLatest ? 'badge-primary' : 'badge-subtle'">
              {{ isLatest ? currentStrings.latestGa : currentStrings.release }}
            </span>
            <svg class="trigger-chevron" :class="{ rotated: isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <!-- Floating Dropdown Menu -->
          <Transition name="dropdown-fade">
            <div v-if="isOpen" class="custom-select-menu" role="listbox">
              <div class="custom-select-menu-header">
                <span>{{ currentStrings.selectArchRelease }}</span>
              </div>
              <div class="custom-select-menu-list">
                <button
                  v-for="(rel, idx) in releases"
                  :key="rel.tag_name"
                  type="button"
                  class="custom-select-item"
                  :class="{ selected: rel.tag_name === selectedTag }"
                  role="option"
                  :aria-selected="rel.tag_name === selectedTag"
                  @click="selectRelease(rel.tag_name)"
                >
                  <div class="item-left">
                    <span class="item-tag">{{ rel.tag_name }}</span>
                    <span
                      class="item-badge"
                      :class="idx === 0 ? 'badge-primary' : 'badge-subtle'"
                    >
                      {{ idx === 0 ? currentStrings.latestGa : currentStrings.legacy }}
                    </span>
                  </div>
                  <div class="item-right">
                    <span v-if="rel.published_at" class="item-date">
                      {{ formatReleaseDate(rel.published_at) }}
                    </span>
                    <svg
                      v-if="rel.tag_name === selectedTag"
                      class="item-check"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="release-meta-right">
        <span v-if="formattedDate" class="release-date">{{ currentStrings.releasedPrefix }} {{ formattedDate }}</span>
        <a
          :href="currentRelease.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="release-notes-link"
        >
          <span>{{ currentStrings.changelogNotes }}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    </div>

    <!-- Platform Cards Grid -->
    <div class="platform-grid">
      <div
        v-for="platform in categorizedAssets"
        :key="platform.id"
        class="platform-card"
      >
        <div class="platform-header">
          <div class="platform-title-group">
            <span class="platform-icon" :class="`icon-${platform.id}`">
              <!-- Windows SVG -->
              <svg v-if="platform.id === 'windows'" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
              </svg>
              <!-- Linux SVG (Tux Penguin) -->
              <svg v-else-if="platform.id === 'linux'" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z"/>
              </svg>
              <!-- Apple SVG -->
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.66-.82 1.11-1.96.99-3.1-.96.04-2.11.64-2.8 1.45-.6.7-1.13 1.83-.99 2.94 1.07.08 2.15-.55 2.8-1.29"/>
              </svg>
            </span>
            <span class="platform-name">{{ platform.name }}</span>
          </div>
          <span class="platform-badge mono-num">{{ platform.assets.length }} {{ currentStrings.packagesBadge }}</span>
        </div>

        <div class="asset-list">
          <a
            v-for="asset in platform.assets"
            :key="asset.format + asset.arch"
            :href="asset.url"
            class="asset-item"
            :class="{ 'asset-primary': asset.primary }"
          >
            <div class="asset-meta">
              <div class="asset-title-row">
                <span class="asset-format mono-num">{{ asset.format }}</span>
                <span class="asset-arch mono-num">{{ asset.arch }}</span>
              </div>
              <span class="asset-desc">{{ asset.description }}</span>
            </div>

            <div class="asset-action">
              <span v-if="asset.size" class="asset-size mono-num">{{ asset.size }}</span>
              <span class="download-button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </span>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.axiom-release-downloader {
  margin: 1.5rem 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.release-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
}

.release-meta-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.release-label {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.custom-select-container {
  position: relative;
  display: inline-block;
}

.custom-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-size: 0.825rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.custom-select-trigger:hover,
.custom-select-trigger.active {
  border-color: #00f2fe;
  background: rgba(0, 242, 254, 0.06);
  box-shadow: 0 0 12px rgba(0, 242, 254, 0.15);
}

.trigger-icon {
  color: #00f2fe;
  flex-shrink: 0;
}

.trigger-tag {
  letter-spacing: 0.02em;
}

.trigger-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.badge-primary {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.badge-subtle {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.trigger-chevron {
  color: var(--vp-c-text-3);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
  color: #00f2fe;
}

/* Floating Dropdown Panel */
.custom-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 290px;
  max-width: 90vw;
  background: #141418;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 100;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
}

.custom-select-menu-header {
  padding: 0.4rem 0.65rem 0.35rem 0.65rem;
  font-size: 0.675rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 0.3rem;
}

.custom-select-menu-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.custom-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  text-align: left;
}

.custom-select-item:hover {
  background: rgba(0, 242, 254, 0.08);
  border-color: rgba(0, 242, 254, 0.2);
}

.custom-select-item.selected {
  background: rgba(0, 242, 254, 0.12);
  border-color: rgba(0, 242, 254, 0.35);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-tag {
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.custom-select-item.selected .item-tag {
  color: #00f2fe;
}

.item-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.35rem;
  border-radius: 4px;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-date {
  font-size: 0.725rem;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.item-check {
  color: #00f2fe;
  flex-shrink: 0;
}

/* Transition */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.release-meta-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.8rem;
}

.release-date {
  color: var(--vp-c-text-3);
}

.release-notes-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;
}

.release-notes-link:hover {
  opacity: 0.85;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.platform-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-border);
}

.platform-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.platform-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.platform-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-windows {
  color: #00a4ef;
}

.icon-linux {
  color: #10b981;
}

.icon-macos {
  color: #a855f7;
}

.platform-badge {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.75rem;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: all 0.15s ease;
}

.asset-item:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
  transform: translateY(-1px);
}

.asset-primary {
  border-color: rgba(6, 182, 212, 0.4);
  background: rgba(6, 182, 212, 0.05);
}

.asset-primary:hover {
  border-color: #00f2fe;
}

.asset-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.asset-title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.asset-format {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.asset-arch {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--vp-c-border);
}

.asset-desc {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}

.asset-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.asset-size {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
}

.download-button {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  background: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
  transition: all 0.15s ease;
}

.asset-item:hover .download-button {
  background: var(--vp-c-brand-1);
  color: #ffffff;
  border-color: var(--vp-c-brand-1);
}
</style>
