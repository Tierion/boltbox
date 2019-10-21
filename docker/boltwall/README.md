# Boltwall

[Boltwall](https://github.com/Tierion/boltwall) is a lightning-based paywall middlware for
Nodejs + Expressjs API services. Boltbox offers a version of boltwall packaged in a docker image
which allows a developer to deploy a boltwall paywall as a proxy server.

Learn more about how boltwall works, how it can be configured, and the API for interacting with it
from its [documentation](https://github.com/Tierion/boltwall).

## Usage

Using `docker-compose` with environment variables is the easiest way to deploy a boltwall server.

### Environment Variables

The docker image is configurable via environment variables.

#### Required Environment Variables:

These are required for boltwall to be operational as they tell the boltwall server
how to connect to the lightning node. Currently only base64 encoded values are supported (not path).

- `LND_TLS_CERT`
- `LND_SOCKET`
- `LND_MACAROON`

This one is not technically required as boltwall will work without, it just serves little purpose
as there is nothing being protected by the paywall.

- `BOLTWALL_PROTECTED_URL` - URL to proxy the request to after a payment has been confirmed

#### Optional Environment Variables

- `BOLTWALL_PORT` (defaults to 5000) - port on docker container to access the endpoint
- `BOLTWALL_TIME_CAVEAT` (defaults to false) - whether or not to use the time based access restriction
  (1 second of access per satoshi paid)
- `BOLTWALL_PATH`- path behind which to apply boltwall endpoints
- `CAVEAT_KEY` - a "password" used for signing the macaroon caveats. This is necessary if a 3rd party will be
  interacting with your boltwall and needs to confirm validity of your boltwall's macaroon
- `SESSION_SECRET` - 32-byte signing secret for session cookies. Randomly generated if none present

### Custom Caveat Configuration

If you would like to use a custom caveat configuration instead of the time-based or empty/single-use ones
you can make a `configs` directory available that exposes an object with the required configs. Map a local directory
to the mounted docker `/configs` volume to make it available to the container (see the simnet docker compose file
for an example). You can read more about boltwall's custom caveat configs [here](https://github.com/Tierion/boltwall#custom-configs).
