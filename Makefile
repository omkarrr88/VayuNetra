.PHONY: install api web seed migrate live-bootstrap test lint benchmark benchmark-history

install:        ## install lean python (CPU, no CUDA) + web deps
	pip install -r requirements.txt
	cd web && npm install

install-ml:     ## heavy ML stack — CPU PyTorch + transformers (only if you need local embeddings/training)
	pip install torch --index-url https://download.pytorch.org/whl/cpu
	pip install -r requirements-ml.txt

dev:            ## run the WHOLE app (API + web) in ONE terminal — Ctrl+C stops both
	./scripts/dev.sh

api:            ## run only the FastAPI backend
	uvicorn api.main:app --reload

web:            ## run the Vite frontend
	cd web && npm run dev

seed:           ## generate the Delhi seed fixture
	python scripts/seed_delhi.py

live-bootstrap:  ## populate live Supabase with kb_chunks, enforcement_recs, and action_traces
	python scripts/bootstrap_live.py

link:           ## link the local repo to the remote Supabase project (one-time)
	npx supabase link --project-ref dwqjqpohgkxekqilhotr

migrate:        ## push migrations (schema + RLS + city seed) to the linked project
	npx supabase db push

db-status:      ## show which migrations are applied vs pending
	npx supabase migration list

test:           ## run tests with coverage
	pytest -q --cov=. --cov-report=term-missing

lint:           ## ruff lint
	ruff check .

refresh-cities: ## bring every city's forecasts/attribution/worklist/advisories current (run the morning of a demo)
	./scripts/refresh_all_cities.sh

benchmark:      ## recompute the live 90-day forecast benchmark for every city + mirror fixtures (docs/BENCHMARKS.md)
	for c in $$(python -c "from core.cities import list_city_ids; print(' '.join(list_city_ids()))"); do python -m ml.eval.benchmark --city $$c --source live --no-ablation; done
	python scripts/build_benchmark_fixture.py

benchmark-history: ## multi-season Delhi/Kolkata benchmark (needs data/hist from scripts/fetch_history.py)
	python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01 --protocol rolling --window-days 90
	python -m ml.eval.benchmark --city kolkata --source hist --split 2025-11-01 --protocol rolling --window-days 90
	python scripts/build_benchmark_fixture.py

prewarm:        ## judging-morning pre-warm + GO/NO-GO smoke check (run ~15 min before demo)
	./scripts/prewarm_demo.sh
