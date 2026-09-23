<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

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

onMounted(async () => {
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

const formattedDate = computed(() => {
  if (!currentRelease.value?.published_at) return "";
  try {
    const d = new Date(currentRelease.value.published_at);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
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
        <label for="release-select" class="release-label">Select Release Version:</label>
        <div class="select-wrapper">
          <select id="release-select" v-model="selectedTag" class="release-select">
            <option
              v-for="(rel, idx) in releases"
              :key="rel.tag_name"
              :value="rel.tag_name"
            >
              {{ rel.tag_name }} {{ idx === 0 ? "(Latest)" : "" }}
            </option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <span v-if="isLatest" class="badge-latest">Latest GA</span>
      </div>

      <div class="release-meta-right">
        <span v-if="formattedDate" class="release-date">Released {{ formattedDate }}</span>
        <a
          :href="currentRelease.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="release-notes-link"
        >
          <span>Changelog & Notes</span>
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
              <!-- Linux SVG (Terminal) -->
              <svg v-else-if="platform.id === 'linux'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              <!-- Apple SVG -->
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.66-.82 1.11-1.96.99-3.1-.96.04-2.11.64-2.8 1.45-.6.7-1.13 1.83-.99 2.94 1.07.08 2.15-.55 2.8-1.29"/>
              </svg>
            </span>
            <span class="platform-name">{{ platform.name }}</span>
          </div>
          <span class="platform-badge mono-num">{{ platform.assets.length }} packages</span>
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

.select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.release-select {
  appearance: none;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  padding: 0.35rem 1.8rem 0.35rem 0.65rem;
  font-size: 0.825rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.release-select:hover {
  border-color: var(--vp-c-brand-1);
}

.select-chevron {
  position: absolute;
  right: 0.5rem;
  pointer-events: none;
  color: var(--vp-c-text-3);
}

.badge-latest {
  font-size: 0.675rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(6, 182, 212, 0.15);
  color: #00f2fe;
  border: 1px solid rgba(6, 182, 212, 0.35);
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
