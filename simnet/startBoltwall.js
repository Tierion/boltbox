const { promisify } = require('util')
const assert = require('assert')

const NodeConfig = require('../utils/NodeConfig')

const exec = promisify(require('child_process').exec)

/**
 * Start boltwall for each node passed to the function
 * @param {NodeConfig[]} nodes - array of NodeConfig objects
 * for interacting with running nodes.
 * @returns void
 */

async function startBoltwall(verbose = false, ...nodes) {
  let count = 0

  let env = {
    COMPOSE_INTERACTIVE_NO_CLI: true
  }

  for (let node of nodes) {
    assert(
      node instanceof NodeConfig || (node.name && node.rpcPort),
      'Must pass a NodeConfig object to start a monitor against'
    )

    const port = 8000 + count

    let credentials = require('./credentials.json')
    credentials = credentials[node.name]
    let startCmd = `docker-compose run -d \
    -e BOLTWALL_PORT='${8000 + count}' \
    -e LND_MACAROON=${credentials.adminMacaroon} \
    -e LND_TLS_CERT=${credentials.cert} \
    -e LND_SOCKET=${node.name}:${node.rpcPort} \
    -p ${port}:${port} \
    --name ${node.name}-boltwall \
    boltwall`
    try {
      await exec(startCmd, { env })
    } catch (e) {
      if (e.message.match(/Cannot create container for service boltwall: Conflict/g)) {
        if (verbose) console.warn(`Container for ${node.name}-boltwall already exists. Stopping...`)
        await exec(`docker container stop ${node.name}-boltwall && docker container rm ${node.name}-boltwall`)
        if (verbose) console.log('Container removed. Retrying...')
        await exec(startCmd, { env })
      }
    }
    count++
  }
}

module.exports = startBoltwall
