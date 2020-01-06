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
    # use -z flag as usual.
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

# shared vars
PUBLICIP=$(set_default "$PUBLICIP" "127.0.0.1")
NETWORK=$(set_default "$NETWORK" "testnet")
CHAIN=$(set_default "$CHAIN" "bitcoin")
TLSPATH=$(set_default "$TLSPATH" "/root/.lnd/tls.cert")
LND_DIR=$(set_default "$LND_DIR" "/root/.lnd")
MACAROONDIR="$LND_DIR/data/chain/$CHAIN/$NETWORK"

# Loop
LOOP_RPC_PORT=$(set_default "$LOOP_RPC_PORT" "11010")
LOOP_REST_PORT=$(set_default "$LOOP_REST_PORT" "8081")

# LND
LND_RPC_PORT=$(set_default "$LND_RPC_PORT" "10009")
LND_REST_PORT=$(set_default "$LND_REST_PORT" "8080")
LND_HOST=$(set_default "$LND_HOST" "lnd")
LND_RPC_SERVER="${LND_HOST}:${LND_RPC_PORT}"
LND_REST_SERVER="${LND_HOST}:${LND_REST_PORT}"

if [[ "$CHAIN" == "litecoin" ]]; then
    BACKEND="ltcd"
fi


# get wallet password from environment variable
# and unlock via REST API
# can't start loopd unless it's unlocked

# LND_WALLET_PASS must be base64 encoded
curl --insecure --header "Grpc-Metadata-macaroon: \
    $(xxd -ps -u -c 1000 $MACAROONDIR/admin.macaroon)" \
    -X POST https://$LND_REST_SERVER/v1/unlockwallet -d \
    '{"wallet_password":"'$LND_WALLET_PASS'"}'


exec loopd \
    --network="$NETWORK" \
    --restlisten="0.0.0.0:$LOOP_REST_PORT" \
    --rpclisten="0.0.0.0:$LOOP_RPC_PORT" \
    --lnd.macaroondir="$MACAROONDIR" \
    --lnd.tlspath="$TLSPATH" \
    --lnd.host="$LND_RPC_SERVER" \
    "$@"
