"""Shared Supabase access helpers."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Any

import core.env  # noqa: F401  (loads .env)


def _base_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def _rest_url() -> str:
    return f"{_base_url()}/rest/v1"


class _Response:
    def __init__(self, response):
        self._response = response
        self.data = self._parse_data()

    def _parse_data(self):
        if not self._response.content:
            return []
        try:
            return self._response.json()
        except Exception:
            return []


@dataclass
class _TableQuery:
    table_name: str
    api_key: str
    token: str | None = None
    _select: str = "*"
    _filters: list[tuple[str, str, Any]] = field(default_factory=list)
    _order: tuple[str, bool] | None = None
    _limit: int | None = None
    _range: tuple[int, int] | None = None
    _insert_rows: Any = None
    _update_rows: Any = None
    _delete: bool = False
    _upsert_rows: Any = None
    _on_conflict: str | None = None

    def select(self, columns: str = "*"):
        self._select = columns
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, "eq", value))
        return self

    def gte(self, column: str, value: Any):
        self._filters.append((column, "gte", value))
        return self

    def lte(self, column: str, value: Any):
        self._filters.append((column, "lte", value))
        return self

    def in_(self, column: str, values: list[Any]):
        self._filters.append((column, "in", values))
        return self

    def order(self, column: str, desc: bool = False):
        self._order = (column, desc)
        return self

    def limit(self, value: int):
        self._limit = value
        return self

    def range(self, start: int, end: int):
        self._range = (start, end)
        return self

    def insert(self, rows: Any):
        self._insert_rows = rows
        return self

    def update(self, rows: Any):
        self._update_rows = rows
        return self

    def delete(self):
        self._delete = True
        return self

    def upsert(self, rows: Any, on_conflict: str | None = None, ignore_duplicates: bool = False):
        self._upsert_rows = rows
        self._on_conflict = on_conflict
        self._ignore_duplicates = ignore_duplicates
        return self

    def _headers(self) -> dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.token or self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        return headers

    def _apply_filters(self, params: dict[str, Any]) -> dict[str, Any]:
        for column, op, value in self._filters:
            if op == "in":
                params[column] = f"in.({','.join(map(str, value))})"
            else:
                params[column] = f"{op}.{value}"
        if self._order:
            column, desc = self._order
            params["order"] = f"{column}.{('desc' if desc else 'asc')}"
        if self._limit is not None:
            params["limit"] = str(self._limit)
        if self._range is not None:
            start, end = self._range
            params["offset"] = str(start)
            params["limit"] = str(end - start + 1)
        return params

    def execute(self):
        url = f"{_rest_url()}/{self.table_name}"
        params: dict[str, Any] = {}
        method = "GET"
        body: bytes | None = None
        headers = self._headers()

        if self._insert_rows is None and self._update_rows is None and self._upsert_rows is None and not self._delete:
            params["select"] = self._select
            params = self._apply_filters(params)
            method = "GET"
        elif self._insert_rows is not None:
            method = "POST"
            body = json.dumps(self._insert_rows).encode("utf-8")
        elif self._upsert_rows is not None:
            prefer = ["return=representation", "resolution=merge-duplicates"]
            if getattr(self, "_ignore_duplicates", False):
                prefer.append("resolution=ignore-duplicates")
            headers["Prefer"] = ",".join(prefer)
            if self._on_conflict:
                params["on_conflict"] = self._on_conflict
            method = "POST"
            body = json.dumps(self._upsert_rows).encode("utf-8")
        elif self._update_rows is not None:
            params = self._apply_filters(params)
            method = "PATCH"
            body = json.dumps(self._update_rows).encode("utf-8")
        elif self._delete:
            params = self._apply_filters(params)
            method = "DELETE"
        else:
            method = "GET"

        query = f"?{urlencode(params, doseq=True)}" if params else ""
        request = Request(f"{url}{query}", data=body, headers=headers, method=method)
        with urlopen(request, timeout=60) as response:
            status_code = getattr(response, "status", response.getcode())
            raw = response.read()

        if status_code >= 400:
            raise RuntimeError(f"Supabase request failed for {self.table_name}: {status_code} {raw.decode('utf-8', errors='replace')}")

        class _HttpResponse:
            def __init__(self, content: bytes):
                self.content = content

            def json(self):
                return json.loads(self.content.decode("utf-8")) if self.content else []

        return _Response(_HttpResponse(raw))


class _PostgrestStub:
    def __init__(self):
        self._token: str | None = None

    def auth(self, token: str):
        self._token = token


class _RestClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.postgrest = _PostgrestStub()

    def table(self, name: str):
        return _TableQuery(name, self.api_key, token=self.postgrest._token)

    def rpc(self, fn: str, params: dict[str, Any] | None = None):
        """Call a Postgres function via PostgREST (parity with the real SDK)."""
        body = json.dumps(params or {}).encode()
        req = Request(f"{_rest_url()}/rpc/{fn}", data=body, method="POST", headers={
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.postgrest._token or self.api_key}",
            "Content-Type": "application/json",
        })
        with urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode() or "null")

        class _R:
            pass
        r = _R(); r.data = data
        class _Q:
            def execute(self_inner):
                return r
        return _Q()


def service_client():
    """Supabase client with service-role privileges for trusted server jobs."""
    try:
        from supabase import create_client  # type: ignore

        return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    except Exception:
        return _RestClient(os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def anon_client():
    """Supabase client that honors caller JWT/RLS when auth(token) is applied."""
    try:
        from supabase import create_client  # type: ignore

        return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    except Exception:
        return _RestClient(os.environ["SUPABASE_ANON_KEY"])


def client():
    """Backward-compatible service-role client for existing pipelines."""
    return service_client()


def load_measurements(city_id: str) -> list[dict]:
    """Page through all measurements for a city (PostgREST caps at 1000 rows/request)."""
    c = client()
    rows: list[dict] = []
    start, page = 0, 1000
    while True:
        batch = (
            c.table("measurements")
            .select("city_id,h3_cell,ts,variable,value")
            .eq("city_id", city_id)
            .range(start, start + page - 1)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < page:
            break
        start += page
    return rows
