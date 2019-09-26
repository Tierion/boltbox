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
CHAN_CONFS=$(set_default "$CHAN_CONFS" 3)

if [[ -n $BACKEND && "$BACKEND" == "neutrino" ]]; then
  NEUTRINO=$(set_default "$NEUTRINO" "faucet.lightning.community:18333")
fi 

if [[ "$CHAIN" == "litecoin" ]]; then
    BACKEND="ltcd"
fi

PARAMS=$(echo $PARAMS \
    "--lnddir=$LNDDIR" \
    "--debuglevel=$DEBUG" \
    "--logdir=$LNDDIR/logs" \
    "--datadir=$LNDDIR/data" \
    "--$CHAIN.active" \
    "--$CHAIN.$NETWORK" \
    "--$CHAIN.node=$BACKEND" \
    "--externalip=$PUBLICIP" \
    "--restlisten=0.0.0.0:$RESTLISTEN" \
    "--rpclisten=0.0.0.0:$RPCLISTEN" \
    "--$CHAIN.defaultchanconfs=$CHAN_CONFS" \
)

if [[ $BACKEND == "btcd" ]]; then
    PARAMS=$(echo $PARAMS \
        "--btcd.rpchost=blockchain" \
        "--btcd.rpccert=/rpc/rpc.cert" \
        "--btcd.rpcuser=$RPCUSER" \
        "--btcd.rpcpass=$RPCPASS"
    )
fi

if [[ -n $TLSEXTRADOMAIN ]]; then
  PARAMS="$PARAMS --tlsextradomain=$TLSEXTRADOMAIN"
fi

if [[ -n $NOSEEDBACKUP ]]; then
  PARAMS="$PARAMS --noseedbackup"
fi

if [[ -n $NEUTRINO ]]; then
  PARAMS="$PARAMS --neutrino.connect=$NEUTRINO"
fi

# Add user parameters to command.
PARAMS="$PARAMS $@"

echo "Command: lnd $PARAMS"
exec lnd $PARAMS
