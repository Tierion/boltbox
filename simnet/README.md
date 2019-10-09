# Bootstrap Simnet Testing Environment

## Introduction

The purpose of this script is to allow developers to quickly and easily bootstrap a simnet
testing environment for working with lnd.

Everything is run in its own docker container. This allows you to run a portable, isolated,
and easily reproducible testing environment.

## Usage

#### Requirements

- node >12.0.0
- docker and docker-compose

Once you have the above dependencies installed, get the repo by either downloading it or git
cloning to the machine you want to run the simnet from and then cd to this directory.

```bash
$ git clone https://github.com/Tierion/boltbox.git
$ cd boltbox/simnet
```

Then all you have to do is run the node script and watch the network get spun up:

```bash
$ node start-simnet.js
```

`make simnet` also works from the main project directory.

## What It Does

The script will narrate most of its steps as it walks through everything. As a quick summary though,
the script will do the following in order:

1. Start a container for an lnd node, "Alice", that will use a btcd full node as a backend
1. Retrieve an address from Alice to use as the coinbase
1. Spin up a btcd full node with neutrino enabled (default in btcd) and Alice's address set as `MINING_ADDRESS`
1. Check if there is already a chain existing in persisted docker volumes
1. If no chain found, mine 400 blocks (enables segwit, matures coinbase txs, and funds Alice)
1. Confirm mined blocks and that Alice has a spendable balance
1. Start up two more containers: Bob and Carol. These will be backed by light clients, neutrino nodes pointed
   to the btcd full node started earlier.
1. Fund bob and carol's wallets (Alice will pay each of them approximately 25% of her balance if they are unfunded)
1. Mine 1 block with btcd container to confirm the funding transactions
1. Add peers- Alice will connect to bob and bob will connect to carol (skips if already connected)
1. Open channels- Alice will open a channel with bob and bob will open one with carol, both pushing
   a quarter of the balance to the peer
1. Mine 10 blocks to lock in channel funding transactions

Once this is done you will have:

- Bitcoin Simnet blockchain with height of at least 411 blocks
- Alice node funded with an on-chain balance and 1 funded channel opened with Bob
- Bob node funded with an on-chain balance and 2 funded channels, one with Alice and one with Carol
- Carol node funded with an on-chain balance and 1 funded channel opened with Bob

### Interacting with your network

Once the network is bootstrapped the script will display information about the network and all the
composite containers. Each node will also have a `Command Prefix` associated with it. The script
creates and uses ephemeral containers for running rpc commands against the nodes. To run a cli
command against any of the containers, simply copy the command and add the arguments at the end.

For example, to get information about your blockchain from your btcd full node:

```bash
$ docker-compose run -e NETWORK=simnet btcctl getblockchaininfo
```

And to get the channel balance of alice's node:

```bash
$ docker-compose run -e LND_DIR=/lnd-data/alice -e RPCSERVER="alice:10001" -e NETWORK=simnet lncli channelbalance
```

It's also possible to exec into the container of a node you wish to interact with directly. We use
named containers to make this as simple as:

```bash
$ docker exec -it alice bash # can replace "alice" with "bob" or "carol" too
```

## Network topology

```
+ ----- +            + --- +            + ----- +
| Alice | <--chan--> | Bob | <--chan--> | Carol |  <---   Alice, Bob, and Carol are the lightning
+ ----- +            + --- +            + ----- +         network daemons which create channels
    |                   |                   |             and interact with each other using the
    |                   |                   |             Bitcoin network as source of truth.
    |             + --- + --- +       + --- + --- +
    |             |  Neutrino |       |  Neutrino | <--- Bob and Carol use Neutrino SPV as the
    |             |    SPV    |       |    SPV    |      backend for their wallet. This gets filters
    |             + --- + --- +       + --- + --- +      from a compatible full node that can be used
    |                   |                   |            to verify transactions.
    |                   |                   |
    + - - - - - - - - - + - - - - - - - - - +
    |
    + --------------- +
    | BTCD Full NODE  |  <---  In the current scenario for simplicity we create only one
    + --------------- +        "btcd" node which represents the Bitcoin network, in a
                               real situation Alice, Bob, and Carol will likely be
                               connected to different Bitcoin nodes.
```

## Persisted State

The startup script uses named docker containers to make it easier to predictably interact with your nodes.
The containers also share states via docker volumes. To see the volumes used, you can run:

```bash
$> docker volume list
DRIVER              VOLUME NAME
local               simnet_bitcoin
local               simnet_lnd
local               simnet_shared
```

These shared volumes are necessary for the RPC interface to be able to locate the necessary macaroons and tls certificates
If you run the script a second time, it will check for existing volumes, including wallet balances, mined blocks, etc.

## Troubleshooting

The best thing to try and do to troubleshoot any issues is make sure all associated containers
have been torn down as well as all shared volumes. The way that the node containers know about each other
is through a shared volume `/lnd-data`. This gets persisted though even if an associated container
has been fully removed.

An example of where this can cause problems is if you have a tls certificate that needs to be regenerated.
In order for the cert to be regenerated though, the old one needs to be deleted. The output from the script
can give you a hints regarding this. For example, since the node containers take the set namespaces `alice`,
`bob`, and `carol`, it will tell you if those containers already exist and skip the command to create them.

## TODO:

- [ ] Consider creating lnd.conf files for each lnd container rather than setting in command line
- [ ] Create separate scripts for running the cli commands for each node (so the user doesn't have to copy and paste manually)
- [x] Script to remove containers
- [ ] Optimize build for cleaning up intermediate containers
- [x] Utility for extracting credentials (tls.cert and macaroons)
