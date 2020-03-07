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
LISTEN=$(set_default "$LISTEN" "9735")
RPCUSER=$(set_default "$RPCUSER" "devuser")
RPCPASS=$(set_default "$RPCPASS" "devpass")
DEBUG=$(set_default "$DEBUG" "debug")
NETWORK=$(set_default "$NETWORK" "simnet")
CHAIN=$(set_default "$CHAIN" "bitcoin")
BACKEND=$(set_default "$BACKEND" "btcd")
LND_DIR=$(set_default "$LND_DIR" "/root/.lnd")
RESTLISTEN=$(set_default "$RESTLISTEN" "8080")
RPCLISTEN=$(set_default "$RPCLISTEN" "10009")
MONITORLISTEN=$(set_default "$MONITORLISTEN" "8989")
CHAN_CONFS=$(set_default "$CHAN_CONFS" 3)

# For btcd and bitcoind
RPCHOST=$(set_default "$RPCHOST" "blockchain")
BACKEND_RPC_PORT=$(set_default "$BACKEND_RPC_PORT" "8332")
BACKEND_RPC_HOST=$(set_default "$BACKEND_RPC_HOST" "$RPCHOST:$BACKEND_RPC_PORT")

# For bitcoind
BITCOIND_ZMQPUBRAWBLOCK_PORT=$(set_default "$BITCOIND_ZMQPUBRAWBLOCK_PORT" "28332")
BITCOIND_ZMQPUBRAWTX_PORT=$(set_default "$BITCOIND_ZMQPUBRAWTX_PORT" "28333")
BITCOIND_ZMQPUBRAWBLOCK=$(set_default "$BITCOIND_ZMQPUBRAWBLOCK" "tcp://$RPCHOST:$BITCOIND_ZMQPUBRAWBLOCK_PORT")
BITCOIND_ZMQPUBRAWTX=$(set_default "$BITCOIND_ZMQPUBRAWTX" "tcp://$RPCHOST:$BITCOIND_ZMQPUBRAWTX")


PARAMS=$(echo $PARAMS \
    "--lnddir=$LND_DIR" \
    "--debuglevel=$DEBUG" \
    "--logdir=$LND_DIR/logs" \
    "--datadir=$LND_DIR/data" \
    "--$CHAIN.active" \
    "--$CHAIN.$NETWORK" \
    "--$CHAIN.node=$BACKEND" \
    "--externalip=$PUBLICIP:$LISTEN" \
    "--listen=0.0.0.0:$LISTEN" \
    "--restlisten=0.0.0.0:$RESTLISTEN" \
    "--rpclisten=0.0.0.0:$RPCLISTEN" \
    "--$CHAIN.defaultchanconfs=$CHAN_CONFS" \
)

if [[ -n $BACKEND && "$BACKEND" == "neutrino" ]]; then
    if [[ -n $NEUTRINO ]]; then
        PARAMS="$PARAMS --neutrino.connect=$NEUTRINO"
    fi
    if [[ $NETWORK == "testnet" || $NETWORK == "mainnet" ]]; then
        PARAMS="${PARAMS} --neutrino.connect=btcd-${NETWORK}.lightning.computer"
        PARAMS="${PARAMS} --neutrino.connect=${NETWORK}1-btcd.zaphq.io"
        PARAMS="${PARAMS} --neutrino.connect=${NETWORK}2-btcd.zaphq.io"
    fi
fi


if [[ "$CHAIN" == "litecoin" ]]; then
    BACKEND="ltcd"
fi

if [[ $BACKEND == "bitcoind" ]]; then
    PARAMS=$(echo $PARAMS \
        "--bitcoind.rpchost=$BACKEND_RPC_HOST" \
        "--bitcoind.rpcuser=$RPCUSER" \
        "--bitcoind.rpcpass=$RPCPASS" \
        "--bitcoind.zmqpubrawblock=$BITCOIND_ZMQPUBRAWBLOCK" \
        "--bitcoind.zmqpubrawtx=$BITCOIND_ZMQPUBRAWTX"
    )
fi

if [[ $BACKEND == "btcd" ]]; then
    PARAMS=$(echo $PARAMS \
        "--btcd.rpchost=$BACKEND_RPC_HOST" \
        "--btcd.rpccert=/rpc/rpc.cert" \
        "--btcd.rpcuser=$RPCUSER" \
        "--btcd.rpcpass=$RPCPASS"
    )
fi

if [[ -n $TLSEXTRADOMAIN ]]; then
    PARAMS="$PARAMS --tlsextradomain=$TLSEXTRADOMAIN"
fi

if [[ -n $PUBLICIP ]]; then
    PARAMS="$PARAMS --tlsextraip=$PUBLICIP"
fi

if [[ -n $NOSEEDBACKUP ]]; then
    PARAMS="$PARAMS --noseedbackup"
fi

if [[ -n $LND_ALIAS ]]; then
    PARAMS="$PARAMS --alias=$LND_ALIAS"
fi

if [[ -n $MONITORING ]]; then
    PARAMS="$PARAMS --prometheus.enable --prometheus.listen=0.0.0.0:$MONITORLISTEN"
fi

# Add user parameters to command.
PARAMS="$PARAMS $@"

echo "Command: lnd $PARAMS"
exec lnd $PARAMS
