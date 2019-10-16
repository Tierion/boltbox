const { promisify } = require('util')
const fs = require('fs')
const assert = require('assert')
const exec = promisify(require('child_process').exec)

const NodeConfig = require('../utils/NodeConfig')
/**
 * Start monitors for each node passed to the function
 * @param {NodeConfig[]} nodes - array of NodeConfig objects
 * for interacting with running nodes.
 * @returns void
 */

async function startRTL(rtlPass, ...nodes) {
  assert(typeof rtlPass === 'string', 'Expected an RTL Password')
  assert(nodes.length >= 1, 'Expected at least one node to connect the RTL dashboard to')

  // need to compose the multi node config json
  let env = {
    COMPOSE_INTERACTIVE_NO_CLI: true,
    RTL_PORT: 5000,
    NODE_AUTH_TYPE: 'CUSTOM',
    RTL_PASS: rtlPass
  }

  const multiNodeConf = require('../docker/rtl/sample-RTL-Multi-Node-Conf.json')
  multiNodeConf.multiPass = rtlPass
  multiNodeConf.port = env.RTL_PORT

  let nodeTemplate = Object.assign({}, multiNodeConf.nodes[0])
  let rtlNodes = []

  // loop through the nodes and assemble the config for the multi node config
  // the `nodes` property is an array of configs for each node RTL will connect to
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    assert(
      node instanceof NodeConfig || (node.name && node.rpcPort),
      'Must pass a NodeConfig object to start a monitor against'
    )

    // this is based on the sample config from the docker directory
    let nodeConfig = {
      index: i,
      lnNode: node.name.toUpperCase(),
      lnImplementation: 'LND',
      Authentication: {
        macaroonPath: `${node.lnddir}/data/chain/bitcoin/${node.network}`,
        lndConfigPath: ''
      },
      Settings: {
        ...nodeTemplate.Settings,
        channelBackupPath: undefined,
        bitcoindConfigPath: undefined,
        lndServerUrl: node.lndServerUrl || `https://${node.name}:${node.restPort}/v1`
      }
    }
    rtlNodes.push(nodeConfig)
  }

  multiNodeConf.nodes = rtlNodes

  let confName = 'RTL-Multi-Node-Conf.json'

  // write the config to a json file
  fs.writeFileSync(`./${confName}`, JSON.stringify(multiNodeConf, null, 2))

  // start the container
  await exec(`docker-compose up -d rtl`, { env })

  let containerName = 'simnet_rtl'

  // copy the config to the container
  await exec(`docker cp ./${confName} ${containerName}:/RTL/${confName}`)

  // stop the container
  await exec(`docker stop ${containerName}`)

  // restart the container so that it will catch the new configs
  await exec(`docker start ${containerName}`)

  // clean up the local config file
  fs.unlinkSync(`./${confName}`)
}

exports.startRTL = startRTL
