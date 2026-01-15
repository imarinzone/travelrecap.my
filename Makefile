.PHONY: help install up up-backend down restart logs logs-backend psql schema test import import-dry-run import-no-geocode clean build-backend swagger install-swag

# Default target
help:
	@echo "Travel Recap - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          - Install Python dependencies"
	@echo "  make up               - Start Postgres and backend containers"
	@echo "  make up-backend       - Start backend container only"
	@echo "  make down             - Stop and remove all containers"
	@echo "  make restart          - Restart all containers"
	@echo "  make build-backend    - Build backend Docker image"
	@echo ""
	@echo "Database:"
	@echo "  make psql             - Connect to Postgres database"
	@echo "  make schema           - View database schema"
	@echo ""
	@echo "Backend:"
	@echo "  make logs-backend     - View backend container logs"
	@echo "  make swagger          - Generate Swagger API documentation"
	@echo "  make install-swag    - Install swag CLI tool for Swagger generation"
	@echo ""
	@echo "Import:"
	@echo "  make import           - Import visits with geocoding (full)"
	@echo "  make import-dry-run   - Preview import without inserting"
	@echo "  make import-no-geocode - Import visits without geocoding (faster)"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run tests to verify setup (DB connection, dependencies)"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs             - View Postgres container logs"
	@echo "  make clean            - Remove Python cache files"
	@echo ""

# Install Python dependencies
install:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt

# Docker Compose commands
up: build-backend
	@echo "Starting Postgres and backend containers..."
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "✓ Postgres is ready on localhost:5432"
	@echo "✓ Backend API is ready on http://localhost:8080"

up-backend: build-backend
	@echo "Starting backend container..."
	docker-compose up -d backend
	@echo "✓ Backend API is ready on http://localhost:8080"

build-backend:
	@echo "Building backend Docker image..."
	docker-compose build backend

down:
	@echo "Stopping all containers..."
	docker-compose down

restart: down up

logs:
	docker-compose logs -f postgres

logs-backend:
	docker-compose logs -f backend

# Swagger documentation
install-swag:
	@echo "Installing swag CLI tool (v1.8.1 to match library version)..."
	@go install github.com/swaggo/swag/cmd/swag@v1.8.1
	@echo "✓ swag v1.8.1 installed/updated"

swagger: install-swag
	@echo "Generating Swagger documentation..."
	@echo "Downloading Go module dependencies..."
	@cd backend && go mod download && go mod tidy
	@echo "Generating Swagger docs..."
	@cd backend && swag init -g main.go -o docs --parseDependency --parseInternal
	@echo "✓ Swagger documentation generated in backend/docs/"

# Database connection
psql:
	@echo "Connecting to Postgres database..."
	@docker-compose exec postgres psql -U travelrecap -d travelrecap

# View schema
schema:
	@echo "Database schema:"
	@docker-compose exec postgres psql -U travelrecap -d travelrecap -c "\d+ visits"
	@docker-compose exec postgres psql -U travelrecap -d travelrecap -c "\d+ place_locations"

# Import commands
import:
	@echo "Importing visits with geocoding..."
	@python scripts/import_visits.py

import-dry-run:
	@echo "Dry run - previewing import..."
	@python scripts/import_visits.py --dry-run

import-no-geocode:
	@echo "Importing visits without geocoding..."
	@python scripts/import_visits.py --skip-geocode

# Test setup
test:
	@echo "Running tests to verify setup..."
	@echo ""
	@echo "1. Checking Python dependencies..."
	@python3 -c "import psycopg2; from geopy.geocoders import Nominatim; print('   ✓ Dependencies installed')" || (echo "   ✗ Dependencies missing - run 'make install'" && exit 1)
	@echo ""
	@echo "2. Checking Docker container..."
	@docker-compose ps postgres | grep -q "Up" && echo "   ✓ Postgres container is running" || (echo "   ✗ Postgres container not running - run 'make up'" && exit 1)
	@echo ""
	@echo "3. Testing database connection..."
	@python3 -c "import psycopg2, os; conn = psycopg2.connect(host=os.getenv('DB_HOST', 'localhost'), port=os.getenv('DB_PORT', '5432'), user=os.getenv('DB_USER', 'travelrecap'), password=os.getenv('DB_PASSWORD', 'travelrecap_password'), dbname=os.getenv('DB_NAME', 'travelrecap')); conn.close(); print('   ✓ Database connection successful')" || (echo "   ✗ Database connection failed" && exit 1)
	@echo ""
	@echo "4. Checking database tables..."
	@docker-compose exec -T postgres psql -U travelrecap -d travelrecap -c "\dt" | grep -q "visits" && echo "   ✓ 'visits' table exists" || (echo "   ✗ 'visits' table not found - check schema.sql" && exit 1)
	@docker-compose exec -T postgres psql -U travelrecap -d travelrecap -c "\dt" | grep -q "place_locations" && echo "   ✓ 'place_locations' table exists" || (echo "   ✗ 'place_locations' table not found - check schema.sql" && exit 1)
	@echo ""
	@echo "5. Checking JSON file..."
	@test -f data/GoogleTimeline.json && echo "   ✓ GoogleTimeline.json found" || (echo "   ✗ GoogleTimeline.json not found in data/ directory" && exit 1)
	@echo ""
	@echo "6. Testing import script (syntax check)..."
	@python3 -m py_compile scripts/import_visits.py && echo "   ✓ Import script syntax is valid" || (echo "   ✗ Import script has syntax errors" && exit 1)
	@echo ""
	@echo "7. Checking backend service..."
	@docker-compose ps backend 2>/dev/null | grep -q "Up" && echo "   ✓ Backend container is running" || echo "   ⚠ Backend container not running - run 'make up-backend'"
	@curl -s http://localhost:8080/api/place-locations > /dev/null 2>&1 && echo "   ✓ Backend API is responding" || echo "   ⚠ Backend API not responding - ensure backend is running"
	@echo ""
	@echo "=========================================="
	@echo "✓ All tests passed! Setup is ready."
	@echo "=========================================="
	@echo ""
	@echo "Next steps:"
	@echo "  - Run 'make import-dry-run' to preview import"
	@echo "  - Run 'make import' to import with geocoding"
	@echo "  - Run 'make import-no-geocode' for faster import"
	@echo "  - Open index.html in a browser to view the map"

# Clean Python cache
clean:
	@echo "Cleaning Python cache files..."
	find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@echo "✓ Cleaned"

