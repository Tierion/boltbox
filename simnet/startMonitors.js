#!/usr/bin/env node
const { promisify } = require('util')
const path = require('path')
const assert = require('assert')

const NodeConfig = require('../utils/NodeConfig')

const exec = promisify(require('child_process').exec)

/**
 * Start monitors for each node passed to the function
 * @param {NodeConfig[]} nodes - array of NodeConfig objects
 * for interacting with running nodes.
 * @returns void
 */

async function startMonitors(...nodes) {
  for (let node of nodes) {
    assert(
      node instanceof NodeConfig || (node.name && node.rpcPort),
      'Must pass a NodeConfig object to start a monitor against'
    )
    let env = {
      COMPOSE_INTERACTIVE_NO_CLI: true,
      LND_HOSTNAME: node.name,
      MONITORLISTEN: 8989,
      PROMETHEUSLISTEN: 9092,
      LND_DIR: `/root/.lnd/${node.name}`,
      LND_HOST: `${node.name}:${node.rpcPort}`,
      NETWORK: node.network || 'simnet'
    }
    let baseYml = path.resolve('../docker/monitor/docker-compose.yml')
    let simnetYml = path.resolve('docker-compose.lndmon.yml')
    let startCmd = `docker-compose -f ${baseYml} -f ${simnetYml} up -d`
    await exec(startCmd, { env })
  }
}

exports.startMonitors = startMonitors
