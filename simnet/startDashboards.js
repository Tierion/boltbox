const { promisify } = require('util')
const path = require('path')
const assert = require('assert')
const exec = promisify(require('child_process').exec)

const NodeConfig = require('../utils/NodeConfig')
/**
 * Start monitors for each node passed to the function
 * @param {NodeConfig[]} nodes - array of NodeConfig objects
 * for interacting with running nodes.
 * @returns void
 */

async function startDashboards(rtlPass, ...nodes) {
  assert(typeof rtlPass === 'string', 'Expected an RTL Password')
  assert(nodes.length >= 1, 'Expected at least one node to connect the RTL dashboard to')

  for (let node of nodes) {
    assert(
      node instanceof NodeConfig || (node.name && node.rpcPort),
      'Must pass a NodeConfig object to start a monitor against'
    )

    let env = {
      COMPOSE_INTERACTIVE_NO_CLI: true,
      RTL_PORT: 5000,
      NODE_AUTH_TYPE: 'CUSTOM',
      RTL_PASS: rtlPass,
      LND_SERVER_URL: node.lndServerUrl || `https://${node.name}:${node.restPort}/v1`,
      MACAROON_PATH: `${node.lnddir}/data/chain/bitcoin/${node.network}`
    }

    let startCmd = `docker-compose up -d rtl`
    await exec(startCmd, { env })
  }
}

exports.startDashboards = startDashboards
