# IIIT Lucknow Training & Placement Portal
#
# Two commands matter:
#   make up     build and run the whole stack
#   make seed   fill the database with the complete dataset
#
# Everything else is a subcommand of those two. `make` on its own lists them.
#
# Every target runs in Docker, so a contributor needs Docker and nothing else:
# no Node, no Python, no psql. The handful of targets that deliberately run on
# the host are marked "(host)" in their help text.

.DEFAULT_GOAL := help
SHELL := /bin/bash
# A half-written .env is worse than none: it would satisfy the file rule and
# never be regenerated.
.DELETE_ON_ERROR:

COMPOSE     := docker compose
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
# The database toolbox: a one-shot container on the stack's network. Compose
# starts `db` first because the service declares it as a healthy dependency.
TOOLS       := $(COMPOSE) run --rm tools
APP_SERVICES := db backend frontend

.PHONY: help up dev down stop start restart build rebuild clear-cache ps urls health logs \
        logs-frontend logs-backend logs-db seed env secrets admin password \
        db-migrate db-migrate-new db-seed-admins db-seed-students db-seed-demo \
        db-remove-demo db-pack-demo db-sync-admins db-reset db-studio db-psql \
        db-admin db-admin-password db-dump db-restore check lint type-check test test-backend \
        sh-frontend sh-backend sh-db sh-tools clean nuke doctor

##@ Help

help: ## List every command
	@awk 'BEGIN { FS = ":.*##"; printf "\nIIIT Lucknow T&P Portal\n\nUsage:\n  make \033[36m<command>\033[0m\n" } \
		/^[a-zA-Z0-9_.-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@printf "\nFirst run:  make up && make seed\n\n"

##@ Run the stack

up: .env ## Build, start, and wait for the whole stack
	@$(MAKE) --no-print-directory doctor
	$(COMPOSE) up --build -d
	@$(MAKE) --no-print-directory wait-healthy
	@$(MAKE) --no-print-directory urls
	@grep -Eq '^ADMIN_EMAILS=("")?$$' .env \
		&& printf "  ADMIN_EMAILS is empty, so no administrator exists yet.\n  Run: make admin EMAIL=you@iiitl.ac.in\n\n" || true

dev: .env ## Start the stack with hot reload on both apps
	@$(MAKE) --no-print-directory doctor
	$(COMPOSE_DEV) up --build

down: ## Stop the stack and remove its containers
	$(COMPOSE) down

stop: ## Stop the containers but keep them
	$(COMPOSE) stop

start: ## Start previously stopped containers
	$(COMPOSE) start

restart: ## Restart the application services
	$(COMPOSE) restart $(APP_SERVICES)

build: ## Build the images
	$(COMPOSE) build

rebuild: ## Build the images from scratch, ignoring the cache
	$(COMPOSE) build --no-cache

# The frontend's .next lives in a named volume so container builds never write
# to the host tree. That volume outlives `down` and `up --build`, so a compile
# error cached in it survives every restart and goes on being served after the
# file is fixed. This is the way out, and it leaves the database alone.
clear-cache: ## Delete the frontend build cache (fixes a compile error that outlives a fix)
	@# -s stops the container first; -v takes the anonymous and named volumes
	@# attached to it, which is the .next cache and nothing else.
	$(COMPOSE) rm -fsv frontend
	@volume=$$(docker volume ls -q --filter name=frontend_next | head -1); \
		if [ -n "$$volume" ]; then docker volume rm "$$volume"; fi
	@printf "\n  Cache cleared. Start the stack again with: make dev\n\n"

##@ Inspect

ps: ## Show what is running
	$(COMPOSE) ps

urls: ## Print the published URLs
	@# Asked of Compose rather than assembled from FRONTEND_PORT, so the output
	@# is the port actually published even when .env or the shell overrides it.
	@front=$$($(COMPOSE) port frontend 3000 2>/dev/null | sed 's/.*://'); \
		back=$$($(COMPOSE) port backend 8000 2>/dev/null | sed 's/.*://'); \
		if [ -z "$$front" ]; then echo "Nothing is running. Start it with: make up"; exit 0; fi; \
		printf "\n  Portal    http://localhost:%s\n  API       http://localhost:%s\n  API docs  http://localhost:%s/docs\n" \
			"$$front" "$$back" "$$back"; \
		if grep -Eq '^DB_ADMIN_PASSWORD=("")?$$' .env 2>/dev/null; then printf "\n"; \
		else printf "  Tables    http://localhost:%s/admin\n\n" "$$back"; fi

health: ## Report each service's health
	@for id in $$($(COMPOSE) ps -q $(APP_SERVICES)); do \
		docker inspect -f '{{.Name}} -> {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $$id; \
	done

logs: ## Follow logs from every service
	$(COMPOSE) logs -f --tail 100

logs-frontend: ## Follow the frontend log
	$(COMPOSE) logs -f --tail 100 frontend

logs-backend: ## Follow the backend log
	$(COMPOSE) logs -f --tail 100 backend

logs-db: ## Follow the database log
	$(COMPOSE) logs -f --tail 100 db

##@ Data

seed: .env ## Populate the database with the complete dataset
	@printf "Applying migrations, then seeding administrators, the student roster, and the demonstration data.\n"
	$(TOOLS) sh -c 'npm run db:deploy \
		&& npm run db:seed \
		&& npm run db:import-students \
		&& npm run db:seed:demo'
	@printf "\nDone. Give an administrator a password with: make password EMAIL=<address>\n"

db-migrate: .env ## Apply pending migrations
	$(TOOLS) npm run db:deploy

db-migrate-new: .env ## Create a migration from schema changes (NAME=add_field)
	@test -n "$(NAME)" || { echo "NAME is required: make db-migrate-new NAME=add_field"; exit 1; }
	$(COMPOSE) run --rm \
		-v "$(CURDIR)/database/prisma/migrations:/app/database/prisma/migrations" \
		tools npx prisma migrate dev --name "$(NAME)" --schema database/prisma/schema.prisma

db-seed-admins: .env ## Seed administrator accounts from ADMIN_EMAILS
	$(TOOLS) npm run db:seed

db-seed-students: .env ## Import the student roster from students_data.json
	$(TOOLS) npm run db:import-students

db-seed-demo: .env ## Seed the demonstration dataset (EMAIL= attaches it to an account)
	@if [ -n "$(EMAIL)" ]; then \
		$(TOOLS) npm run db:seed:demo -- "$(EMAIL)"; \
	else \
		$(TOOLS) npm run db:seed:demo; \
	fi

db-remove-demo: .env ## Delete every demonstration row, keeping real records
	$(TOOLS) npm run db:remove-demo

db-pack-demo: ## Rebuild database/seed-data.zip from database/seed-data/ (host)
	npm run db:pack:demo

db-sync-admins: .env ## Reconcile stored roles with ADMIN_EMAILS
	$(TOOLS) npm run db:sync-admins

db-reset: .env ## Drop the database volume and rebuild it from scratch (destructive)
	@printf "This deletes the database volume and every row in it.\n"
	@read -p "Type the word reset to continue: " reply; \
		[ "$$reply" = "reset" ] || { echo "Cancelled."; exit 1; }
	$(COMPOSE) down -v
	@$(MAKE) --no-print-directory up
	@$(MAKE) --no-print-directory seed

db-admin: .env ## Show the table browser at /admin on the backend
	@# The password itself is not printed. It is a live credential for every
	@# row in the database, and a terminal is a log, a scrollback, and often a
	@# screen share.
	@back=$$($(COMPOSE) port backend 8000 2>/dev/null | sed 's/.*://'); \
		if [ -z "$$back" ]; then echo "The backend is not running. Start it with: make up"; exit 0; fi; \
		if grep -Eq '^DB_ADMIN_PASSWORD=("")?$$' .env; then \
			printf "\n  The table browser is off: DB_ADMIN_PASSWORD is empty in .env.\n  Turn it on with: make db-admin-password && make restart\n\n"; \
		else \
			printf "\n  Tables    http://localhost:%s/admin\n  Password  in .env, as DB_ADMIN_PASSWORD\n\n  It reaches every row in every table, around the portal's role\n  permissions. Prisma Studio (make db-studio) is the read-only-ish\n  alternative for a quick look.\n\n" "$$back"; \
		fi

db-admin-password: .env ## Generate a new password for the table browser
	@command -v openssl >/dev/null || { echo "openssl is required to generate a password."; exit 1; }
	@# An .env written before this variable existed has no line to substitute,
	@# so append one rather than silently changing nothing.
	@grep -q '^DB_ADMIN_PASSWORD=' .env || printf '\nDB_ADMIN_PASSWORD=""\n' >> .env
	@pass=$$(openssl rand -base64 24); \
		tmp=$$(mktemp); \
		sed "s|^DB_ADMIN_PASSWORD=.*|DB_ADMIN_PASSWORD=\"$$pass\"|" .env > $$tmp && mv $$tmp .env
	@printf "Wrote a new DB_ADMIN_PASSWORD to .env. Apply it with: make restart\n"

db-psql: ## Open a psql shell on the database
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-dump: ## Write a SQL dump to backups/ (FILE= overrides the name)
	@mkdir -p backups
	@out="$(or $(FILE),backups/tnp-$$(date +%Y%m%d-%H%M%S).sql)"; \
		$(COMPOSE) exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > "$$out" \
		&& echo "Wrote $$out"

db-restore: ## Restore a SQL dump (FILE=backups/tnp-....sql)
	@test -n "$(FILE)" || { echo "FILE is required: make db-restore FILE=backups/tnp-....sql"; exit 1; }
	@test -f "$(FILE)" || { echo "No such file: $(FILE)"; exit 1; }
	$(COMPOSE) exec -T db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < "$(FILE)"

##@ Accounts

admin: .env ## Add an administrator address to ADMIN_EMAILS (EMAIL=you@iiitl.ac.in)
	@test -n "$(EMAIL)" || { echo "EMAIL is required: make admin EMAIL=you@iiitl.ac.in"; exit 1; }
	@current=$$(grep '^ADMIN_EMAILS=' .env | sed -e 's/^ADMIN_EMAILS=//' -e 's/^"//' -e 's/"$$//'); \
		case ",$$current," in \
			*",$(EMAIL),"*) echo "$(EMAIL) is already on the allowlist.";; \
			*) if [ -z "$$current" ]; then next="$(EMAIL)"; else next="$$current,$(EMAIL)"; fi; \
			   tmp=$$(mktemp); \
			   sed "s|^ADMIN_EMAILS=.*|ADMIN_EMAILS=\"$$next\"|" .env > $$tmp && mv $$tmp .env; \
			   echo "ADMIN_EMAILS is now $$next";; \
		esac
	@$(MAKE) --no-print-directory db-seed-admins
	@printf "\nSet a password next: make password EMAIL=$(EMAIL)\n"

password: .env ## Set an account's password (EMAIL=someone@iiitl.ac.in)
	@test -n "$(EMAIL)" || { echo "EMAIL is required: make password EMAIL=someone@iiitl.ac.in"; exit 1; }
	@# No -T: the script prompts for the password on stdin, so it needs a TTY.
	$(COMPOSE) run --rm tools npm run db:set-password -- "$(EMAIL)"

##@ Environment

env: .env ## Create .env from .env.example with generated secrets
	@echo ".env is ready."

# A real file rule, so every target that needs configuration can depend on it
# and a first-time contributor never sees a missing-variable error from Compose.
.env:
	@command -v openssl >/dev/null || { echo "openssl is required to generate secrets."; exit 1; }
	@cp .env.example .env
	@auth=$$(openssl rand -base64 32); \
		enc=$$(openssl rand -hex 32); \
		dbadmin=$$(openssl rand -base64 24); \
		tmp=$$(mktemp); \
		sed -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$$auth\"|" \
		    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$$enc\"|" \
		    -e "s|^DB_ADMIN_PASSWORD=.*|DB_ADMIN_PASSWORD=\"$$dbadmin\"|" .env > $$tmp \
		&& mv $$tmp .env
	@printf "Created .env from .env.example with a fresh AUTH_SECRET, ENCRYPTION_KEY,\nand DB_ADMIN_PASSWORD. See the last of those with: make db-admin\n"

secrets: ## Regenerate AUTH_SECRET and ENCRYPTION_KEY in .env
	@test -f .env || { echo "No .env yet. Run: make env"; exit 1; }
	@printf "Regenerating these invalidates existing sessions, and ENCRYPTION_KEY\nalso makes stored Aadhaar/PAN values unreadable.\n"
	@read -p "Type the word rotate to continue: " reply; \
		[ "$$reply" = "rotate" ] || { echo "Cancelled."; exit 1; }
	@auth=$$(openssl rand -base64 32); \
		enc=$$(openssl rand -hex 32); \
		tmp=$$(mktemp); \
		sed -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$$auth\"|" \
		    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$$enc\"|" .env > $$tmp \
		&& mv $$tmp .env
	@echo "Rotated. Restart the stack: make restart"

##@ Quality

check: ## Run lint, type-check, unit tests, and the production build
	@$(MAKE) --no-print-directory lint
	@$(MAKE) --no-print-directory type-check
	@$(MAKE) --no-print-directory test
	npm run build

lint: ## Lint the frontend (host)
	npm run lint

type-check: ## Type-check the frontend and database packages (host)
	npm run type-check

test: ## Run the frontend unit tests (host)
	npm test

test-backend: ## Run the backend pytest suite in its container
	@# The image runs as a non-root user that cannot write a cache into /app.
	$(COMPOSE) exec backend pytest -p no:cacheprovider

##@ Shells

sh-frontend: ## Shell into the frontend container
	$(COMPOSE) exec frontend sh

sh-backend: ## Shell into the backend container
	$(COMPOSE) exec backend bash

sh-db: ## Shell into the database container
	$(COMPOSE) exec db sh

sh-tools: ## Shell into a database toolbox container
	$(COMPOSE) run --rm tools sh

##@ Cleanup

clean: ## Stop the stack and remove its volumes (deletes the database)
	$(COMPOSE) down -v

nuke: ## Remove containers, volumes, and this project's images
	$(COMPOSE) down -v --rmi local --remove-orphans

doctor: ## Check that Docker is installed and running
	@command -v docker >/dev/null || { echo "Docker is not installed: https://docs.docker.com/get-docker/"; exit 1; }
	@docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required (docker compose, not docker-compose)."; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Docker is installed but not running. Start Docker Desktop and retry."; exit 1; }

# --- internals ---------------------------------------------------------------

.PHONY: wait-healthy
wait-healthy:
	@printf "Waiting for services"
	@for i in $$(seq 1 90); do \
		pending=""; \
		for id in $$($(COMPOSE) ps -q $(APP_SERVICES)); do \
			state=$$(docker inspect -f '{{if .State.Health}}health:{{.State.Health.Status}}{{else}}state:{{.State.Status}}{{end}}' $$id); \
			case "$$state" in \
				health:healthy|state:running) ;; \
				*) pending="yes" ;; \
			esac; \
		done; \
		if [ -z "$$pending" ]; then printf " ready\n"; exit 0; fi; \
		printf "."; \
		sleep 2; \
	done; \
	printf "\nServices did not become healthy in time. Check: make health && make logs\n"; \
	exit 1
