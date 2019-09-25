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
PUBLICIP=$(set_default "$PUBLICIP" "127.0.0.1")
RPCUSER=$(set_default "$RPCUSER" "devuser")
RPCPASS=$(set_default "$RPCPASS" "devpass")
DEBUG=$(set_default "$DEBUG" "debug")
NETWORK=$(set_default "$NETWORK" "simnet")
CHAIN=$(set_default "$CHAIN" "bitcoin")
BACKEND=$(set_default "$BACKEND" "btcd")
LNDDIR=$(set_default "$LNDDIR" "/lnd-data")
RESTLISTEN=$(set_default "$RESTLISTEN" "8080")
RPCLISTEN=$(set_default "$RPCLISTEN" "10009")
if [[ "$CHAIN" == "litecoin" ]]; then
    BACKEND="ltcd"
fi

PARAMS=$(echo $PARAMS \
    "--noseedbackup" \
    "--lnddir=$LNDDIR" \
    "--logdir=$LNDDIR/logs" \
    "--datadir=$LNDDIR/data" \
    "--$CHAIN.active" \
    "--$CHAIN.$NETWORK" \
    "--$CHAIN.node=btcd" \
    "--$BACKEND.rpccert=/rpc/rpc.cert" \
    "--$BACKEND.rpchost=blockchain" \
    "--$BACKEND.rpcuser=$RPCUSER" \
    "--$BACKEND.rpcpass=$RPCPASS" \
    "--externalip=$PUBLICIP" \
    "--restlisten=0.0.0.0:$RESTLISTEN" \
    "--rpclisten=0.0.0.0:$RPCLISTEN" \
    "--tlsextradomain=alice"\
)

# Add user parameters to command.
PARAMS="$PARAMS $@"

echo "Command: lnd $PARAMS"
exec lnd $PARAMS
