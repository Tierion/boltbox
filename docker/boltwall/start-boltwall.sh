#!/usr/bin/env bash

# A start script to get and set the env vars and run the server

# exit from script if error was raised.
set -e

# error function is used within a bash function in order to send the error
# message directly to the stderr output and exit.
error() {
    echo "$1" > /dev/stderr
    exit 0
}

# return is used within bash function in order to return the value.
return() {
    echo "$1"
}

# set_default function gives the ability to move the setting of default
# env variable from docker file to the script thereby giving the ability to the
# user override it durin container start.
set_default() {
    # docker initialized env variables with blank string and we can't just
    # use -z flag as usually.
    BLANK_STRING='""'

    VARIABLE="$1"
    DEFAULT="$2"

    if [[ -z "$VARIABLE" || "$VARIABLE" == "$BLANK_STRING" ]]; then

        if [ -z "$DEFAULT" ]; then
            error "You should specify default variable"
        else
            VARIABLE="$DEFAULT"
        fi
    fi

   return "$VARIABLE"
}

BOLTWALL_PORT=$(set_default "$BOLTWALL_PORT" "5000")
BOLTWALL_TIME_CAVEAT=$(set_default "$BOLTWALL_TIME_CAVEAT" false)

if [ -z "$LND_TLS_CERT" ]; then
  error "You must specify a base64 encoded tls cert (LND_TLS_CERT) for connecting with an lnd node"
fi

if [ -z "$LND_SOCKET" ]; then
  error "You must specify an LND_SOCKET (host:port) to connect to"
fi

if [ -z "$LND_MACAROON" ]; then
  error "You must specify a base64 encoded LND_MACAROON (admin macaroon) to connect to an lnd node"
fi

if [[ ! -f /boltwall/configs/index.js && -e /boltwall/configs/sample-index.js ]]; then
  mv /boltwall/configs/sample-index.js /boltwall/configs/index.js
fi

echo "Starting boltwall server"
exec yarn start