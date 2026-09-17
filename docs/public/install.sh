#!/usr/bin/env bash
# ==============================================================================
# Axiom EDA — Universal Single-Line Installer (Linux & macOS)
# https://axiom.aerovex.net/install.sh
# ==============================================================================

set -euo pipefail

# ANSI Styling
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
AMBER="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

REPO="larvance/axiom"
DEFAULT_VERSION="v0.1.0"
VERSION="${AXIOM_VERSION:-}"
INSTALL_DIR="${AXIOM_INSTALL_DIR:-${HOME}/.axiom}"
BIN_DIR="${INSTALL_DIR}/bin"
FORCE_BUILD=false

print_help() {
    echo -e "${BOLD}Axiom EDA — Official Installer${RESET}

${BOLD}USAGE:${RESET}
    curl -fsSL https://axiom.aerovex.net/install.sh | bash
    curl -fsSL https://axiom.aerovex.net/install.sh | bash -s -- [OPTIONS]

${BOLD}OPTIONS:${RESET}
    -v, --version <TAG>    Specify target version (e.g., v0.1.0, latest)
    -d, --dir <DIR>        Installation directory (default: \$HOME/.axiom)
    -b, --build            Build from source using cargo instead of pre-built binary
    -h, --help             Show this help message

${BOLD}ENVIRONMENT VARIABLES:${RESET}
    AXIOM_VERSION          Target version to install (e.g. v0.1.0)
    AXIOM_INSTALL_DIR      Target directory path
"
}

# Parse Command-Line Arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            print_help
            exit 0
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -d|--dir)
            INSTALL_DIR="$2"
            BIN_DIR="${INSTALL_DIR}/bin"
            shift 2
            ;;
        -b|--build)
            FORCE_BUILD=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${RESET}" >&2
            print_help
            exit 1
            ;;
    esac
done

echo -e "${BOLD}${CYAN}"
echo "================================================================================"
echo " Axiom EDA — In-RAM HDL Engine & Silicon Telemetry Installer"
echo " Platform: Aerovex (https://axiom.aerovex.net)"
echo "================================================================================"
echo -e "${RESET}"

# 1. Detect Operating System & Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
    Linux)
        OS_NAME="linux"
        ;;
    Darwin)
        OS_NAME="darwin"
        ;;
    *)
        echo -e "${RED}Error: Unsupported operating system '${OS}'.${RESET}" >&2
        echo "For Windows, run in PowerShell: irm https://axiom.aerovex.net/install.ps1 | iex" >&2
        exit 1
        ;;
esac

case "${ARCH}" in
    x86_64|amd64)
        ARCH_NAME="x86_64"
        ;;
    arm64|aarch64)
        ARCH_NAME="aarch64"
        ;;
    *)
        echo -e "${RED}Error: Unsupported processor architecture '${ARCH}'.${RESET}" >&2
        exit 1
        ;;
esac

TARGET="${ARCH_NAME}-${OS_NAME}"
echo -e "${CYAN}==> Detected Platform:${RESET} ${BOLD}${OS_NAME} (${ARCH_NAME})${RESET}"

# 2. Resolve Target Version
if [ -z "${VERSION}" ] || [ "${VERSION}" = "latest" ]; then
    echo -e "${CYAN}==> Checking latest release on GitHub...${RESET}"
    LATEST_TAG=""
    if command -v curl &>/dev/null; then
        LATEST_TAG="$(curl -sSf "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep -o '"tag_name": *"[^"]*"' | head -n 1 | cut -d '"' -f 4 || true)"
    fi
    if [ -n "${LATEST_TAG}" ]; then
        VERSION="${LATEST_TAG}"
    else
        VERSION="${DEFAULT_VERSION}"
    fi
fi

# Ensure leading 'v' in version tag
if [[ ! "${VERSION}" =~ ^v ]]; then
    VERSION="v${VERSION}"
fi

echo -e "${CYAN}==> Target Version:${RESET} ${BOLD}${GREEN}${VERSION}${RESET}"

mkdir -p "${BIN_DIR}"
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'axiom-install')"
cleanup() {
    rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# 3. Download Pre-built Binary or Fallback to Source Build
INSTALLED=false

if [ "${FORCE_BUILD}" = false ]; then
    TARBALL="axiom-${VERSION}-${TARGET}.tar.gz"
    RELEASE_URL="https://github.com/${REPO}/releases/download/${VERSION}/${TARBALL}"
    echo -e "${CYAN}==> Attempting download of pre-built release...${RESET}"
    echo -e "    ${RELEASE_URL}"

    if curl -fsSL "${RELEASE_URL}" -o "${TMP_DIR}/${TARBALL}" 2>/dev/null; then
        echo -e "  ✓ Download completed successfully."
        echo -e "${CYAN}==> Extracting binary to ${BIN_DIR}...${RESET}"
        tar -xzf "${TMP_DIR}/${TARBALL}" -C "${BIN_DIR}"
        chmod +x "${BIN_DIR}/axiom"
        ln -sf "axiom" "${BIN_DIR}/betterado"
        INSTALLED=true
    else
        echo -e "${AMBER}Note: Pre-built release archive for ${VERSION} (${TARGET}) not yet published on GitHub.${RESET}"
        echo -e "${CYAN}==> Falling back to building directly from source...${RESET}"
    fi
fi

if [ "${INSTALLED}" = false ]; then
    if ! command -v cargo &>/dev/null || ! command -v rustc &>/dev/null; then
        echo -e "${RED}Error: Rust toolchain (cargo/rustc) is required to build from source.${RESET}" >&2
        echo "Install Rust via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" >&2
        exit 1
    fi

    echo -e "${CYAN}==> Cloning repository and compiling from source...${RESET}"
    git clone --depth 1 "https://github.com/${REPO}.git" "${TMP_DIR}/axiom-src"
    cd "${TMP_DIR}/axiom-src"
    cargo build --release -p betterado-cli --bin axiom
    cp -f "${TMP_DIR}/axiom-src/target/release/axiom" "${BIN_DIR}/axiom"
    chmod +x "${BIN_DIR}/axiom"
    ln -sf "axiom" "${BIN_DIR}/betterado"
    INSTALLED=true
fi

# 4. PATH Configuration Check
SHELL_NAME="$(basename "${SHELL:-bash}")"
RC_FILE=""
case "${SHELL_NAME}" in
    zsh)
        RC_FILE="${HOME}/.zshrc"
        ;;
    bash)
        if [ -f "${HOME}/.bashrc" ]; then
            RC_FILE="${HOME}/.bashrc"
        else
            RC_FILE="${HOME}/.bash_profile"
        fi
        ;;
    fish)
        RC_FILE="${HOME}/.config/fish/config.fish"
        ;;
    *)
        RC_FILE="${HOME}/.profile"
        ;;
esac

PATH_UPDATED=false
if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    if [ -n "${RC_FILE}" ] && [ -w "${RC_FILE}" ]; then
        if ! grep -q "${BIN_DIR}" "${RC_FILE}" 2>/dev/null; then
            echo "" >> "${RC_FILE}"
            echo "# Axiom EDA PATH" >> "${RC_FILE}"
            echo "export PATH=\"${BIN_DIR}:\$PATH\"" >> "${RC_FILE}"
            PATH_UPDATED=true
        fi
    fi
fi

# 5. Output Verification & Welcome Banner
echo -e "${BOLD}${GREEN}"
echo "================================================================================"
echo " Axiom EDA (${VERSION}) successfully installed!"
echo "================================================================================"
echo -e "${RESET}"

echo -e "Binary:   ${BOLD}${BIN_DIR}/axiom${RESET}"
echo -e "Version:  ${BOLD}$("${BIN_DIR}/axiom" --version 2>/dev/null || echo "${VERSION}")${RESET}"

if [ "${PATH_UPDATED}" = true ]; then
    echo ""
    echo -e "${GREEN}✓ Added ${BIN_DIR} to ${RC_FILE}${RESET}"
    echo -e "Run ${BOLD}source ${RC_FILE}${RESET} or open a new terminal session to use the 'axiom' command."
elif [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    echo ""
    echo -e "${AMBER}Note: ${BIN_DIR} is not in your current PATH.${RESET}"
    echo -e "Add this to your ${RC_FILE}:"
    echo -e "    ${CYAN}export PATH=\"${BIN_DIR}:\$PATH\"${RESET}"
fi

echo ""
echo -e "Next steps:"
echo -e "    ${CYAN}axiom compile tests/fixtures/alu.v -t alu${RESET}"
echo -e "    ${CYAN}axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd wave.vcd${RESET}"
echo -e "    ${CYAN}axiom --help${RESET}"
echo ""
echo -e "Documentation: ${BOLD}https://axiom.aerovex.net${RESET}"
echo ""
