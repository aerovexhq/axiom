#!/usr/bin/env bash
# ==============================================================================
# Axiom EDA — High-Performance Build from Source Script
# Compiles the in-RAM Cranelift JIT engine, CLI driver, and Web/Desktop UI.
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
AMBER="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Defaults
BUILD_PROFILE="release"
PREFIX="${HOME}/.axiom"
CLI_ONLY=false
RUN_TESTS=true

print_help() {
    echo -e "${BOLD}Axiom EDA — Build from Source Driver${RESET}

${BOLD}USAGE:${RESET}
    ./scripts/build_from_source.sh [OPTIONS]

${BOLD}OPTIONS:${RESET}
    -p, --prefix <DIR>     Installation directory (default: \$HOME/.axiom)
    -c, --cli-only         Only compile the headless Rust CLI driver (skip Node/UI)
    -d, --debug            Build in debug mode instead of release
    --no-tests             Skip running workspace test suites before install
    -h, --help             Show this help message

${BOLD}EXAMPLES:${RESET}
    ./scripts/build_from_source.sh
    ./scripts/build_from_source.sh --prefix /usr/local
    ./scripts/build_from_source.sh --cli-only"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            print_help
            exit 0
            ;;
        -p|--prefix)
            PREFIX="$2"
            shift 2
            ;;
        -c|--cli-only)
            CLI_ONLY=true
            shift
            ;;
        -d|--debug)
            BUILD_PROFILE="debug"
            shift
            ;;
        --no-tests)
            RUN_TESTS=false
            shift
            ;;
        *)
            echo -e "${RED}Error: Unknown argument '$1'${RESET}" >&2
            print_help
            exit 1
            ;;
    esac
done

echo -e "${BOLD}${CYAN}"
echo "================================================================================"
echo " Axiom EDA — In-RAM HDL Engine & Silicon Telemetry"
echo " Build from Source Driver (${BUILD_PROFILE} profile)"
echo "================================================================================"
echo -e "${RESET}"

# 1. Check Prerequisites
echo -e "${CYAN}==> Checking system dependencies...${RESET}"

if ! command -v cargo &>/dev/null || ! command -v rustc &>/dev/null; then
    echo -e "${RED}Error: Rust toolchain (cargo/rustc) is required.${RESET}" >&2
    echo "Install Rust via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" >&2
    exit 1
fi

RUST_VER="$(rustc --version | awk '{print $2}')"
echo -e "  ✓ Rust toolchain found: ${GREEN}${RUST_VER}${RESET}"

if [ "$CLI_ONLY" = false ]; then
    if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
        echo -e "${AMBER}Warning: Node.js/npm not found. Building in CLI-only mode.${RESET}"
        CLI_ONLY=true
    else
        NODE_VER="$(node -v)"
        echo -e "  ✓ Node.js found: ${GREEN}${NODE_VER}${RESET}"
    fi
fi

# 2. Run Tests if requested
cd "${REPO_ROOT}"

if [ "$RUN_TESTS" = true ]; then
    echo -e "${CYAN}==> Running test suite...${RESET}"
    cargo test --workspace
    echo -e "  ✓ All workspace tests passed successfully!"
fi

# 3. Build Rust Binaries
echo -e "${CYAN}==> Building Axiom CLI binary (${BUILD_PROFILE})...${RESET}"
CARGO_FLAGS=()
if [ "$BUILD_PROFILE" = "release" ]; then
    CARGO_FLAGS+=("--release")
fi

cargo build "${CARGO_FLAGS[@]}" -p axiom-cli --bin axiom

TARGET_BIN="${REPO_ROOT}/target/${BUILD_PROFILE}/axiom"
if [ ! -f "${TARGET_BIN}" ]; then
    echo -e "${RED}Error: Failed to find built binary at ${TARGET_BIN}${RESET}" >&2
    exit 1
fi
echo -e "  ✓ Binary compiled: ${GREEN}${TARGET_BIN}${RESET}"

# 4. Build UI if requested
if [ "$CLI_ONLY" = false ]; then
    echo -e "${CYAN}==> Building modern Web/Desktop UI bundle...${RESET}"
    cd "${REPO_ROOT}/ui"
    npm install --silent
    npm run build
    echo -e "  ✓ UI production assets generated in ${GREEN}ui/dist/${RESET}"
    cd "${REPO_ROOT}"
fi

# 5. Install to Prefix
BIN_DIR="${PREFIX}/bin"
echo -e "${CYAN}==> Installing to ${GREEN}${BIN_DIR}${RESET}..."
mkdir -p "${BIN_DIR}"
cp -f "${TARGET_BIN}" "${BIN_DIR}/axiom"
chmod +x "${BIN_DIR}/axiom"

# Also create backward-compatible symlink 'axiom'
ln -sf "axiom" "${BIN_DIR}/axiom"

# 6. Check PATH
PATH_OK=false
if [[ ":$PATH:" == *":${BIN_DIR}:"* ]]; then
    PATH_OK=true
fi

echo -e "${BOLD}${GREEN}"
echo "================================================================================"
echo " Axiom EDA build & installation completed successfully!"
echo "================================================================================"
echo -e "${RESET}"

echo -e "Binary Installed: ${BOLD}${BIN_DIR}/axiom${RESET}"
echo -e "Version:          ${BOLD}$("${BIN_DIR}/axiom" --version)${RESET}"

if [ "$PATH_OK" = false ]; then
    echo ""
    echo -e "${AMBER}${BOLD}Note:${RESET} ${BIN_DIR} is not currently in your \$PATH."
    echo "Add it to your shell configuration file (~/.bashrc, ~/.zshrc, etc.):"
    echo ""
    echo -e "    ${CYAN}export PATH=\"${BIN_DIR}:\$PATH\"${RESET}"
    echo ""
fi

echo -e "Get started with:"
echo -e "    ${CYAN}axiom compile tests/fixtures/alu.v -t alu${RESET}"
echo -e "    ${CYAN}axiom run tests/fixtures/counter.v -t counter --ticks 100 --vcd wave.vcd${RESET}"
echo -e "    ${CYAN}axiom --help${RESET}"
echo ""
