#!/usr/bin/env bash

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

# Set default variables if needed.
PROMETHEUSLISTEN=$(set_default "$PROMETHEUSLISTEN" "9092")
NETWORK=$(set_default "$NETWORK" "simnet")
LND_HOST=$(set_default "$LND_HOST" "lnd")
LND_RPC_PORT=$(set_default "$LND_RPC_PORT" "10009")
LND_DIR=$(set_default "$LND_DIR" "/root/.lnd")
MACAROON_DIR=$(set_default "$MACAROON_DIR" "$LND_DIR/data/chain/bitcoin/$NETWORK/")
TLS_CERT_PATH=$(set_default "$TLS_CERT_PATH" "$LND_DIR/tls.cert")

PARAMS=$(echo $PARAMS \
    "--prometheus.listenaddr=0.0.0.0:$PROMETHEUSLISTEN" \
    "--lnd.network=$NETWORK" \
    "--lnd.host=$LND_HOST:$LND_RPC_PORT" \
    "--lnd.macaroondir=$MACAROON_DIR" \
    "--lnd.tlspath=$TLS_CERT_PATH"
)

# Add user parameters to command.
PARAMS="$PARAMS $@"

echo "Command: lndmon $PARAMS"
exec lndmon $PARAMS
