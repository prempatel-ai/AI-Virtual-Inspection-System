.PHONY: setup data seed-users seed-activity dev-api dev-web lint typecheck test-backend test-frontend test check types e2e demo check-contrast

ifeq ($(OS),Windows_NT)
    VENV_BIN := .venv/Scripts
    PYTHON := $(VENV_BIN)/python.exe
    RUFF := $(VENV_BIN)/ruff.exe
    PYTEST := $(VENV_BIN)/pytest.exe
    MYPY := $(VENV_BIN)/mypy.exe
    UVICORN := $(VENV_BIN)/uvicorn.exe
    NPM := npm.cmd
    NPX := npx.cmd
else
    VENV_BIN := .venv/bin
    PYTHON := $(VENV_BIN)/python
    RUFF := $(VENV_BIN)/ruff
    PYTEST := $(VENV_BIN)/pytest
    MYPY := $(VENV_BIN)/mypy
    UVICORN := $(VENV_BIN)/uvicorn
    NPM := npm
    NPX := npx
endif

SHOPS ?= 500
WEEKS ?= 12
SEED ?= 42

setup:
	python -m venv .venv
	$(PYTHON) -m pip install -e "backend[dev]"
	cd frontend && $(NPM) install

seed-users:
	$(PYTHON) -m app.data.seed_users

seed-activity:
	$(PYTHON) -m app.data.seed_activity

data:
	$(PYTHON) -m app.data.generator --shops $(SHOPS) --weeks $(WEEKS) --seed $(SEED)
	$(PYTHON) -m app.data.seed_users

dev-api:
	$(PYTHON) -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload

dev-web:
	cd frontend && $(NPM) run dev

lint:
	$(RUFF) check backend
	cd frontend && $(NPM) run lint

typecheck:
	$(MYPY) backend/app
	cd frontend && $(NPM) run typecheck

test-backend:
	$(PYTHON) -m pytest backend/tests

test-frontend:
	cd frontend && $(NPM) run test

test: test-backend test-frontend

check-contrast:
	$(PYTHON) scripts/check_contrast.py

check: lint typecheck test check-contrast

types:
	$(PYTHON) -c "import json; from app.main import app; open('frontend/openapi.json', 'w', encoding='utf-8').write(json.dumps(app.openapi(), indent=2))"
	cd frontend && $(NPM) run types

e2e:
	$(PYTHON) scripts/demo.py --setup-only
	cd frontend && $(NPM) run e2e

demo:
	$(PYTHON) scripts/demo.py
