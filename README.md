# grafana_stack

A Docker Compose telemetry stack: **Node-RED** polls a device over Modbus/TCP, writes the readings to **InfluxDB 2.x**, and **Grafana** visualizes them and raises alerts.

```
Modbus/TCP device → Node-RED → InfluxDB → Grafana
```

Grafana and Node-RED sit behind an nginx gateway on a single port. InfluxDB is not proxied (it has no base-path option); its UI and API are published on the Docker host's loopback interface only:

| URL | Service |
| --- | --- |
| `http://<host>/grafana/` | Grafana |
| `http://<host>/nodered/` | Node-RED |
| `http://localhost:8086/` | InfluxDB UI (Docker host only) |

To reach the InfluxDB UI from another machine, tunnel it: `ssh -L 8086:localhost:8086 <host>`, then open `http://localhost:8086/`. Day-to-day admin (tokens, buckets, backups) also works through the CLI, e.g. `docker compose exec influxdb influx bucket list`.

## Quick start

```sh
cp .env.example .env      # then set every secret in .env
docker compose up -d --build
docker compose ps         # wait until all services are healthy
```

Set `MODBUS_HOST` in `.env` to the device you want to poll. Set `GATEWAY_BIND=127.0.0.1` to keep the gateway local-only.

## What's included

- `docker-compose.yml`: the stack, with the Node-RED image built inline and the nginx config embedded.
- `nodered/`: `settings.js` (admin auth) and a starter flow that reads Modbus registers, validates and scales them, and writes them to InfluxDB. It also writes error events and a 60 s heartbeat so Grafana can alert if the collector goes silent.
- `.env.example`: configuration template. `.env` holds your real secrets and is git-ignored.

Grafana's datasource is provisioned automatically. Dashboards and alert rules are not provisioned; create them in Grafana or through its API.

## Notes

- The starter flow and the InfluxDB init values (org, bucket, token, admin password) are applied only on first start. To change them on an existing install, edit them in the running service or reset with `docker compose down -v` (this deletes all data).
- Never change `NODE_RED_CREDENTIAL_SECRET` after the first deploy, or stored Node-RED credentials become unreadable.
