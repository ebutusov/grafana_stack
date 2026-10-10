# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Docker Compose telemetry stack: **Node-RED** (Modbus/TCP polling) → **InfluxDB 2.x** → **Grafana** (Flux datasource). There is no application code, build system or test suite; the repo is `docker-compose.yml`, `.env`, and `nodered/` (`settings.js`, starter `flows.json`). It is not a git repository.

## Commands

- Start / rebuild: `docker compose up -d --build` (the Node-RED image is built inline from the compose file)
- Status: `docker compose ps` (all services should become `healthy`)
- Logs: `docker compose logs -f nodered` (or `nginx` for gateway/proxy issues)
- UIs: `http://localhost/grafana/`, `/nodered/`; InfluxDB UI at `http://localhost:8086/` (loopback only, not via the gateway)
- Validate compose/env interpolation: `docker compose config`
- Full reset (destroys all data and re-runs first-start provisioning): `docker compose down -v`

Compose refuses to start if `INFLUX_ADMIN_PASSWORD`, `INFLUX_TOKEN`, `NODE_RED_ADMIN_PASSWORD`, `NODE_RED_CREDENTIAL_SECRET` or `GRAFANA_ADMIN_PASSWORD` are unset in `.env`. The compose header mentions copying `.env.example`, but no such file exists; `.env` is the only config file and contains live secrets (don't echo them).

## Architecture

- **Single `backend` network**; services reach each other by name (`http://influxdb:8086`). The `nginx` gateway publishes `${GATEWAY_BIND:-0.0.0.0}:${GATEWAY_PORT:-80}` (set `GATEWAY_BIND=127.0.0.1` to keep it local). InfluxDB publishes `127.0.0.1:${INFLUX_UI_PORT:-8086}` (loopback only; remote access via SSH tunnel). Node-RED and Grafana publish nothing.
- **nginx gateway** (config inline in the `nginx_conf` Compose `configs` block, `$$` escaped): `/` → 302 `/grafana/`; `/grafana/` and `/nodered/` are proxied without stripping the prefix (Grafana uses `serve_from_sub_path`, Node-RED `httpAdminRoot=/nodered`); `/healthz` is the gateway healthcheck. InfluxDB is deliberately **not** proxied: 2.x has no base-path option, and its UI requests root-level assets and `/api/` regardless of prefix, so a sub-path setup would have to give InfluxDB the gateway's root. `nginx` waits for Node-RED and Grafana to be healthy.
- **Inline Dockerfile** (`dockerfile_inline` in the `nodered` service) installs `node-red-contrib-modbus` and `node-red-contrib-influxdb` and copies `nodered/flows.json` and a credentials stub into `/data`. Add Node-RED palette nodes there, not at runtime.
- **Seed-once semantics**: `flows.json` is baked into the image but `/data` lives in the `nodered-data` volume, so edits to `nodered/flows.json` do **not** affect an existing deployment. Likewise `DOCKER_INFLUXDB_INIT_*` values (org, bucket, retention, admin token, password) are ignored once `influxdb-data` is initialised. Changing them requires `docker compose down -v` (or changing them inside the running service).
- **Secrets by reference**: the InfluxDB token reaches Node-RED via a `flows_cred.json` stub containing `$(INFLUX_TOKEN)`, resolved from the container env at runtime. Grafana's datasource is provisioned through a Compose `configs` inline block, with `$${VAR}` escaped so Grafana (not Compose) expands it from its own env. `NODE_RED_CREDENTIAL_SECRET` must never change after first deploy, otherwise stored credentials become undecryptable.
- **`nodered/settings.js`** is mounted into `/data/settings.js` via Compose `configs` (so it does take effect on restart). It configures bcrypt-hashed `adminAuth` from env vars, disables `functionExternalModules`, and uses in-memory context storage.
- **Starter flow** (`nodered/flows.json`, tab "Modbus → InfluxDB"): Modbus Read → one `Decode & validate` function node (register map, scaling and min/max limits at the top) → InfluxDB out. Points are built explicitly (measurement `plc_process`, `device` tag from `DEVICE_NAME`); errors are written as `collector_events` points, with explicit Catch scopes to avoid error feedback loops; a 60 s heartbeat point supports "collector went silent" alerts in Grafana. Modbus host comes from `MODBUS_HOST`; function nodes read env via `env.get(...)`.
