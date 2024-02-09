include .env

SERVICE_SLUG = passport

NODE_PATH=node_modules/.bin

MOCHA_OPTIONS ?= \
	--recursive \
	--exit \
	--timeout 10000

mocha=$(NODE_PATH)/mocha $(MOCHA_OPTIONS)
exportVar = export

DB_CONNECTION_STRING = postgres://$(DB_USER):$(DB_PASS)@127.0.0.1:$(DB_PORT)

.PHONY: deps
deps:
	npm ci

.PHONY: build
build: clean
build: 
	@$(NODE_PATH)/tsc --build

.PHONY: lint
lint: 
	@$(NODE_PATH)/eslint src/**/*.ts

.PHONY: format
format:
	@$(NODE_PATH)/prettier --config .prettierrc 'src/**/*.ts' --write

.PHONY: run
run: build
run:
	@node out/app/app.js

.PHONY: dev
dev: build
dev: 
	@$(NODE_PATH)/nodemon src/app/app.ts

.PHONY: clean
clean:
	@rm -rf out

define start-local-db =
	@echo "Starting local db:"
	@echo "building image..."
	@cd .dev/database && docker build -t $(SERVICE_SLUG)-db .
	@echo "starting a container..."
	@cd .dev/database && docker compose up -d $(SERVICE_SLUG)-db 
	@exit
endef

.PHONY: db.local-start
db.local-start: 
	$(start-local-db)

.PHONY: db.connect
db.connect:
	@psql $(CONNECTION_STRING)

.PHONY: db.local-connect
db.local-connect: CONNECTION_STRING=$(DB_CONNECTION_STRING)/$(DB_NAME)
db.local-connect: db.connect

.PHONY: db.migrate
db.migrate: DB_CONNECTION_NAME=passport
db.migrate:
	@echo "migrating..."
	@sleep 1
	@cat ./db/migrations/*.sql | psql $(DB_CONNECTION_STRING)/$(DB_CONNECTION_NAME)

.PHONY: db.local-stop
db.local-stop:
	@echo "stopping databse container..."
	@cd .dev/database && docker compose down $(SERVICE_SLUG)-db 

.PHONY: db.local-reset
db.local-reset: DB_CONNECTION_NAME=passport
db.local-reset: db.local-stop db.local-start db.migrate

define create-empty-func 
"CREATE FUNCTION empty_tables() RETURNS void AS \$$\$$ \
	DECLARE \
		tables CURSOR FOR \
			SELECT tablename FROM pg_tables \
			WHERE tableowner='$(DB_USER)' AND schemaname='public' AND tablename != 'schema_version'; \
	BEGIN \
		FOR cur_table IN tables LOOP \
			EXECUTE 'TRUNCATE TABLE ' || quote_ident(cur_table.tablename) || ' RESTART IDENTITY CASCADE;'; \
		END LOOP; \
	END; \
	\$$\$$ LANGUAGE plpgsql;"
endef

.PHONY: db.create-test-db
db.create-test-db: 
	@echo "Creating testing database..."
	@psql $(DB_CONNECTION_STRING)/$(DB_NAME) \
		-c "DROP DATABASE IF EXISTS $(TEST_DB_NAME);" \
		-c "CREATE DATABASE $(TEST_DB_NAME);"

.PHONY: db.init-testing-db
db.init-testing-db: build
db.init-testing-db: db.create-test-db
db.init-testing-db: 
	@echo "Using clear_database function..."
	@psql $(DB_CONNECTION_STRING)/$(TEST_DB_NAME) -c $(create-empty-func)
		

define run-integration-tests =
	@echo "Running integration tests..."
	@$(mocha) out/tests/integration
endef

.PHONY: integration-testing
integration-testing: build
integration-testing: export NODE_ENV=ci
integration-testing: DB_CONNECTION_NAME=$(TEST_DB_NAME)
integration-testing: db.init-testing-db db.migrate
integration-testing:
	$(run-integration-tests)










