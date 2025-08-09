# PaulStretch NPM Package Makefile
# Comprehensive build and publishing automation

.PHONY: help build test clean package publish commit push release version-patch version-minor version-major install lint check pre-publish dev

# Default target
help:
	@echo "PaulStretch Build & Publishing Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install dependencies"
	@echo "  make build        - Build the distribution files"
	@echo "  make test         - Run test suite"
	@echo "  make lint         - Run linters (if configured)"
	@echo "  make dev          - Start development server"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "NPM Package:"
	@echo "  make package      - Prepare package for publishing (build + test)"
	@echo "  make check        - Check package validity (npm pack --dry-run)"
	@echo "  make pre-publish  - Full pre-publish check (package + check)"
	@echo "  make publish      - Publish to npm registry"
	@echo "  make claim-name   - Claim npm package name (placeholder publish)"
	@echo ""
	@echo "Version Management:"
	@echo "  make version-patch - Bump patch version (1.0.0 -> 1.0.1)"
	@echo "  make version-minor - Bump minor version (1.0.0 -> 1.1.0)"
	@echo "  make version-major - Bump major version (1.0.0 -> 2.0.0)"
	@echo ""
	@echo "Git Integration:"
	@echo "  make commit       - Stage and commit all changes"
	@echo "  make push         - Push to remote repository"
	@echo "  make release      - Full release (package + publish + tag + push)"
	@echo ""
	@echo "Workflow Shortcuts:"
	@echo "  make release-patch - Patch release (bump + package + publish + push)"
	@echo "  make release-minor - Minor release (bump + package + publish + push)"
	@echo "  make release-major - Major release (bump + package + publish + push)"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install

# Build distribution files
build:
	@echo "🔨 Building distribution files..."
	npm run build
	@echo "✅ Build complete: dist/paulstretch.js"

# Run tests
test:
	@echo "🧪 Running tests..."
	npm test

# Run linters (add when configured)
lint:
	@echo "🔍 Running linters..."
	@if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then \
		npx eslint src/; \
	else \
		echo "No ESLint configuration found, skipping..."; \
	fi

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist/
	rm -f *.tgz
	@echo "✅ Clean complete"

# Start development server
dev:
	@echo "🚀 Starting development server..."
	npm run serve-test

# Prepare package for publishing
package: clean build test
	@echo "📦 Package ready for publishing"
	@echo "Version: $$(node -p "require('./package.json').version")"

# Check package validity
check:
	@echo "🔍 Checking package validity..."
	npm pack --dry-run
	@echo "✅ Package check passed"

# Full pre-publish check
pre-publish: package check
	@echo "✅ Pre-publish checks complete"
	@echo "Package is ready to publish!"

# Publish to npm
publish: pre-publish
	@echo "🚀 Publishing to npm..."
	npm publish
	@echo "✅ Published successfully!"

# Git commit with message
commit:
	@echo "💾 Committing changes..."
	@read -p "Enter commit message: " msg; \
	git add -A && \
	git commit -m "$$msg"

# Push to remote
push:
	@echo "⬆️ Pushing to remote..."
	git push origin $$(git branch --show-current)
	@echo "✅ Pushed successfully!"

# Version bumping
version-patch:
	@echo "📌 Bumping patch version..."
	npm version patch

version-minor:
	@echo "📌 Bumping minor version..."
	npm version minor

version-major:
	@echo "📌 Bumping major version..."
	npm version major

# Complete release workflow
release: package
	@echo "🎉 Starting release process..."
	@echo "Current version: $$(node -p "require('./package.json').version")"
	@read -p "Confirm publish to npm? (y/n) " confirm; \
	if [ "$$confirm" = "y" ]; then \
		$(MAKE) publish && \
		git push && \
		git push --tags && \
		echo "✅ Release complete!"; \
	else \
		echo "❌ Release cancelled"; \
	fi

# Release with version bump shortcuts
release-patch:
	@echo "🎉 Starting patch release..."
	$(MAKE) version-patch
	$(MAKE) release

release-minor:
	@echo "🎉 Starting minor release..."
	$(MAKE) version-minor
	$(MAKE) release

release-major:
	@echo "🎉 Starting major release..."
	$(MAKE) version-major
	$(MAKE) release

# NPM login check
check-npm-login:
	@echo "🔐 Checking npm login status..."
	@npm whoami || (echo "❌ Not logged in to npm. Run 'npm login' first" && exit 1)

# Publish with login check
publish-safe: check-npm-login publish

# Create git tag for current version
tag:
	@echo "🏷️ Creating git tag..."
	git tag -a "v$$(node -p "require('./package.json').version")" -m "Release v$$(node -p "require('./package.json').version")"
	@echo "✅ Tag created: v$$(node -p "require('./package.json').version")"

# Check for uncommitted changes
check-clean:
	@echo "🔍 Checking for uncommitted changes..."
	@git diff-index --quiet HEAD -- || (echo "❌ Uncommitted changes found. Please commit first." && exit 1)
	@echo "✅ Working directory clean"

# Safe release with all checks
release-safe: check-clean check-npm-login release

# Claim npm package name with placeholder
claim-name: check-npm-login build
	@echo "🎯 Claiming npm package name..."
	@echo "📦 Creating name reservation package..."
	@ORIGINAL_VERSION=$$(node -p "require('./package.json').version"); \
	npm version 0.0.1 --no-git-tag-version; \
	npm publish; \
	echo "$$ORIGINAL_VERSION" | xargs npm version --no-git-tag-version; \
	echo "✅ Package name 'paulstretch' claimed on npm!" && \
	echo "🔄 Version restored to original"

# Show current package info
info:
	@echo "📋 Package Information:"
	@echo "Name: $$(node -p "require('./package.json').name")"
	@echo "Version: $$(node -p "require('./package.json').version")"
	@echo "Description: $$(node -p "require('./package.json').description")"
	@echo "Main: $$(node -p "require('./package.json').main")"
	@echo "License: $$(node -p "require('./package.json').license")"