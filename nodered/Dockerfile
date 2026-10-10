# Custom image so the Modbus and InfluxDB nodes are baked in (reproducible, no palette installs at runtime).
ARG NODERED_TAG=latest-22
FROM nodered/node-red:${NODERED_TAG}

RUN npm install --no-audit --no-fund --omit=dev \
      node-red-contrib-modbus \
      node-red-contrib-influxdb

# Starter flow, copied into the /data volume on its FIRST start only
# (an existing volume is never overwritten, so your edits are safe).
COPY --chown=node-red:root flows.json /data/flows.json

# Credentials stub: the token is a $(ENV) reference resolved at runtime, never the secret itself.
# Node-RED encrypts this file with NODE_RED_CREDENTIAL_SECRET on the first deploy.
RUN printf '{"influx_cfg":{"token":"$(INFLUX_TOKEN)"}}' > /data/flows_cred.json
