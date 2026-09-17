#!/usr/bin/env bash
# Betterado — Count Lines of Code (CLOC) Script
# Counts only handwritten project code while strictly excluding
# build artifacts, vendor directories, node_modules, and lockfiles.

set -euo pipefail

# Determine repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Verify cloc is installed
if ! command -v cloc &>/dev/null; then
  echo "Error: 'cloc' is not installed or not in PATH." >&2
  echo "Install it via your package manager:" >&2
  echo "  Ubuntu/Debian: sudo apt install cloc" >&2
  echo "  macOS:         brew install cloc" >&2
  echo "  Arch Linux:    sudo pacman -S cloc" >&2
  exit 1
fi

print_help() {
  cat <<EOF
Betterado CLOC Driver — Counts only handwritten code in the project.

USAGE:
    ./scripts/cloc.sh [OPTIONS] [-- <EXTRA_CLOC_ARGS>]

OPTIONS:
    -f, --by-file        Print detailed line counts per individual file
    -d, --with-docs      Include documentation and analysis specs (analysis/, vivadoanalysis/, GEMINI.md)
    -h, --help           Show this help message

EXAMPLES:
    ./scripts/cloc.sh                     # Standard summary by language
    ./scripts/cloc.sh --by-file           # Full breakdown of each file
    ./scripts/cloc.sh --with-docs         # Code + Architecture Specifications
    ./scripts/cloc.sh -- --json           # Output cloc report in JSON format
EOF
}

INCLUDE_DOCS=false
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      print_help
      exit 0
      ;;
    -f|--by-file)
      EXTRA_ARGS+=("--by-file")
      shift
      ;;
    -d|--with-docs)
      INCLUDE_DOCS=true
      shift
      ;;
    --)
      shift
      EXTRA_ARGS+=("$@")
      break
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

cd "${REPO_ROOT}"

# Hand-crafted target paths
TARGETS=(
  "Cargo.toml"
  "crates"
  "tests/fixtures"
  "ui/src"
  "ui/index.html"
  "ui/vite.config.ts"
  "ui/postcss.config.js"
  "ui/package.json"
)

if [ "$INCLUDE_DOCS" = true ]; then
  TARGETS+=(
    "README.md"
    "GEMINI.md"
    "todo.md"
    "docs"
    "analysis"
    "vivadoanalysis"
  )
fi

echo "================================================================================"
echo " Axiom EDA Codebase Size (Handwritten Code Only)"
if [ "$INCLUDE_DOCS" = true ]; then
  echo " Mode: Code + Documentation & Architecture Specs (VitePress)"
else
  echo " Mode: Pure Source Code (Rust + TypeScript/React + Verilog + Configs)"
fi
echo "================================================================================"

cloc \
  --exclude-dir=target,node_modules,dist,.git,.idea,.vscode,cache \
  --exclude-ext=lock,jsonl \
  --not-match-f='(package-lock\.json|Cargo\.lock)' \
  "${EXTRA_ARGS[@]}" \
  "${TARGETS[@]}"
