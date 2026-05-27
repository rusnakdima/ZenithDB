#!/bin/bash

set -e

echo "🚀 Starting optimized build process..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
	echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

check_frontend_changes() {
	local frontend_dist="dist/zenithdb/browser"
	local last_build_file=".last-frontend-build"
	local force_build="${FORCE_BUILD:-false}"

	if [ "$CI" = "true" ] || [ "$force_build" = "true" ]; then
		print_status "CI environment or forced build - building frontend..."
		return 0
	fi

	if [ ! -d "$frontend_dist" ]; then
		print_status "Frontend not built yet, building..."
		return 0
	fi

	if [ ! -f "$last_build_file" ]; then
		print_status "No previous build record found, building..."
		return 0
	fi

	local last_build_time=$(cat "$last_build_file")
	local changed_files=$(find src/ -name "*.ts" -o -name "*.html" -o -name "*.scss" -o -name "*.css" -newer "$last_build_file" 2>/dev/null | wc -l)

	if [ "$changed_files" -gt 0 ]; then
		print_status "Frontend files changed, rebuilding..."
		return 0
	else
		print_status "Frontend unchanged, skipping rebuild"
		return 1
	fi
}

check_rust_changes() {
	local rust_target="src-tauri/target"
	local last_rust_build=".last-rust-build"
	local force_build="${FORCE_BUILD:-false}"

	if [ "$CI" = "true" ] || [ "$force_build" = "true" ]; then
		print_status "CI environment or forced build - building Rust code..."
		return 0
	fi

	if [ ! -d "$rust_target" ]; then
		print_status "Rust not built yet, building..."
		return 0
	fi

	if [ ! -f "$last_rust_build" ]; then
		print_status "No previous Rust build record found, building..."
		return 0
	fi

	local last_build_time=$(cat "$last_rust_build")
	local changed_files=$(find src-tauri/src/ -name "*.rs" -newer "$last_rust_build" 2>/dev/null | wc -l)

	if [ "$changed_files" -gt 0 ]; then
		print_status "Rust files changed, rebuilding..."
		return 0
	else
		print_status "Rust code unchanged, using cached build"
		return 1
	fi
}

build_optimized() {
	local target="${1:-desktop}"
	local build_type="${2:-release}"

	print_status "Building for target: $target, type: $build_type"

	if check_frontend_changes; then
		print_status "Building frontend..."
		if [ "$build_type" = "debug" ]; then
			bun run build
		else
			bun run build:prod
		fi
		print_success "Frontend built successfully"
	fi

	print_status "Building Tauri application..."
	case $target in
	"desktop")
		if [ "$build_type" = "debug" ]; then
			bun run tauri:build:debug
		else
			bun run tauri:build
		fi
		;;
	*)
		print_error "Unknown target: $target"
		echo "Available targets: desktop"
		exit 1
		;;
	esac

	date +%s >.last-rust-build
	print_success "Build completed successfully!"
}

clean() {
	print_status "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf src-tauri/target/
	rm -f .last-frontend-build
	rm -f .last-rust-build
	print_success "Clean completed"
}

usage() {
	echo "Usage: $0 [command] [options]"
	echo ""
	echo "Commands:"
	echo "  build [target] [type]  - Build the application (default: desktop release)"
	echo "  clean                 - Clean all build artifacts"
	echo "  help                  - Show this help"
	echo ""
	echo "Targets:"
	echo "  desktop               - Desktop application (default)"
	echo ""
	echo "Types:"
	echo "  release               - Release build (default)"
	echo "  debug                 - Debug build"
	echo ""
	echo "Examples:"
	echo "  $0 build                    # Build desktop release"
	echo "  $0 clean                    # Clean all artifacts"
}

case "${1:-build}" in
"build")
	build_optimized "${2:-desktop}" "${3:-release}"
	;;
"clean")
	clean
	;;
"help" | "-h" | "--help")
	usage
	;;
*)
	print_error "Unknown command: $1"
	usage
	exit 1
	;;
esac
