# Boltbox Monitoring

## lndmon

lndmon has been implemented as a monitoring solution within Boltbox.
The description from [their readme](https://github.com/lightninglabs/lndmon) states it is...

> A drop-in monitoring solution for your lnd node using Prometheus and Grafana.

### Usage

To run and view locally, all you need to run is `docker` + `docker-compose`. Most configuration
can be done via environment variables which tell lndmon where to find your lnd node
and data. Here are some of the environment variables you can use when running `docker-compose`
to customize your setup:

- `NETWORK`- Network your lnd instance is running on (_default_: "mainnet")
- `LND_HOST`- RPC host where lndmon can communicate with your lnd instance (_default_: "lnd:10009")
- `LND_DIR`- Where all lnd node data can be found including tls cert and macaroons (_default_: "/root/.lnd")
- `MACAROON_DIR`- path to the readonly.macaroon file (_default_:`$LND_DIR/data/chain/bitcoin/$NETWORK`, this will fill in using other env vars and fallbacks)
- `TLS_CERT_PATH`- absolute path to tls.cert file (_default_: `$LND_DIR/tls.cert`)
- `PROMETHEUS_LISTEN`- this is the port where prometheus (the data manager for the lndmon system) needs to access lndmon
  from (_default_: 9092)

`LND_HOST`, `LND_DIR`, and `NETWORK` are the most important configurations. These tell
lndmon how to connect to your lightning node, and if everything else is set to default,
then that should be all you need.

_NOTE_: lndmon currently only supports monitoring on one node per host (out of the box;
it could theoretically support more with customization).

### Custom Configuration

For further information about configuration options, please read the [INSTALL
documentation](https://github.com/lightninglabs/lndmon/blob/master/INSTALL.md) in the lndmon repo.

Please also be aware, that the local `docker/monitor/docker-compose.yml` file is needed
for startup as the architecture requires the networking of 3 different persistent containers:
grafana (dashboard), prometheus (data management), and lndmon (hooking it up altogether for lnd monitoring).
If you wish to extend or customize a different configuration, you can either directly edit
the `docker-compose.yml` or [extend the services](https://docs.docker.com/compose/extends/)
with your own compose file (as the simnet script does) using the `-f` option in the compose cli.

#### Simnet

A sample dashboard is run with boltbox's simnet startup script. Because only one
node at a time is supported, it will connect to `bob`'s node by default, which has the most
"complex" network topology. See the `simnet/README.md` for further details.
