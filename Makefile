SHELL := /bin/bash
PNPM ?= pnpm
COMPOSE ?= docker compose
IMAGE ?= vault-ui
TAG ?= $(shell node -p "require('./package.json').version" 2>/dev/null || echo latest)
NODE_VERSION ?= 24

.DEFAULT_GOAL := help

.PHONY: help install dev dev-web dev-server dev-desktop \
	build build-web build-desktop build-server start preview \
	lint lint-fix format format-check typecheck test test-watch coverage check \
	docker-build docker-up docker-down docker-logs docker-shell docker-restart \
	package package-mac package-win package-linux clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nVault-UI targets:\n\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@printf "\nEnvironment: NODE_VERSION=%s IMAGE=%s TAG=%s\n\n" "$(NODE_VERSION)" "$(IMAGE)" "$(TAG)"

##@ Setup

install: ## Install dependencies with pnpm
	$(PNPM) install

##@ Development

dev: ## Run the Vite dev server and the API server together
	$(PNPM) dev

dev-web: ## Run only the Vite frontend dev server (proxies API to :8000)
	$(PNPM) dev:web

dev-server: ## Run only the Express API server with hot reload
	$(PNPM) dev:server

dev-desktop: ## Run the Electron app against the Vite dev server
	$(PNPM) dev:desktop

##@ Build

build: ## Build the web frontend and the API server
	$(PNPM) build

build-web: ## Build the production web bundle into dist/
	$(PNPM) build:web

build-server: ## Compile the API server into dist-server/
	$(PNPM) build:server

build-desktop: ## Build the Electron bundle and main process
	$(PNPM) build:desktop

start: ## Start the compiled API/SPA server
	$(PNPM) start

preview: ## Preview the built frontend with Vite
	$(PNPM) preview

##@ Quality

lint: ## Run ESLint
	$(PNPM) lint

lint-fix: ## Run ESLint with automatic fixes
	$(PNPM) lint:fix

format: ## Format the repository with Prettier
	$(PNPM) format

format-check: ## Check formatting without writing changes
	$(PNPM) format:check

typecheck: ## Type-check frontend, server, and Electron code
	$(PNPM) typecheck

test: ## Run the test suite once
	$(PNPM) test

test-watch: ## Run tests in watch mode
	$(PNPM) test:watch

coverage: ## Run tests with coverage
	$(PNPM) coverage

check: ## Run lint, type-check, and tests (CI gate)
	$(PNPM) check

##@ Docker

docker-build: ## Build the production Docker image
	docker build -t $(IMAGE):$(TAG) -t $(IMAGE):latest .

docker-up: ## Start Vault and Vault-UI with docker compose
	$(COMPOSE) up -d --build

docker-down: ## Stop and remove docker compose services
	$(COMPOSE) down

docker-restart: docker-down docker-up ## Restart docker compose services

docker-logs: ## Follow docker compose logs
	$(COMPOSE) logs -f --tail=200

docker-shell: ## Open a shell inside the Vault-UI container
	$(COMPOSE) exec vault-ui sh

##@ Packaging

package: ## Build desktop bundles for the current platform
	$(PNPM) package

package-mac: ## Package the macOS desktop app
	$(PNPM) package:mac

package-win: ## Package the Windows desktop app
	$(PNPM) package:win

package-linux: ## Package the Linux desktop app
	$(PNPM) package:linux

##@ Maintenance

clean: ## Remove build and coverage output
	$(PNPM) clean
