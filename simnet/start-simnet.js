#!/usr/bin/env node
const { promisify } = require('util')
const assert = require('assert')

const exec = promisify(require('child_process').exec)

const NETWORK = 'simnet'
// env vars to use for all docker calls
const env = {
  NETWORK,
  COMPOSE_INTERACTIVE_NO_CLI: true,
}

/**
 * A class used to create NodeConfigs for creating and interacting simnet
 * lightning nodes via docker-compose
 * @pararms {String} name - name of node (e.g. 'alice', 'bob', 'carol')
 * @pararms {Number} port - RPC port that will be exposed and used to communicate via lncli container
 */
class NodeConfig {
  constructor({ name, port, neutrino }) {
    this.name = name
    this.port = port
    this.lnddir = `/lnd-data/${name}`
    this.lncli = `docker-compose run -e LNDDIR=${this.lnddir} -e RPCSERVER="${name}:${port}" lncli`
    this.env = {
      ...env, 
      TLSEXTRADOMAIN: this.name, // adds docker host to be added to tls cert
     }

     if (neutrino) {
       assert(typeof neutrino === 'boolean', 'Must pass a boolean for neutrino option')
       this.neutrino = neutrino
     }
  }

  async startNode() {

    let startCmd = 
    `docker-compose run -d \
    -e LNDDIR='${this.lnddir}' \
    -e RPCLISTEN=${this.port} \
    -e NOSEEDBACKUP='true'\
    -e TLSEXTRADOMAIN='${this.name}'`
    
    if (this.neutrino) {
      startCmd = `${startCmd} -e NEUTRINO=btcd:18555 -e BACKEND=neutrino`
    }
    
    startCmd = `${startCmd} -p ${this.port}:${this.port} --name ${this.name} lnd_btc` 
    startCmd = startCmd.replace(/\s\s+/g, ' ')

    console.log(`Starting ${this.name} node:`, startCmd)

    try {
      await exec(startCmd, { env: this.env })
    } catch (e) {
       if (e.message.match(/Cannot create container for service lnd_btc: Conflict/g))
        console.warn(`Container for ${this.name} already exists. Skipping`)
       else 
         throw e
    }

    console.log(`Attempting connection with ${this.name}...`)
    let counter = 1, connection = false
    // only want to return when the node is reachable
    while (!connection && counter < 10) {
      try {
        const info = await this.getInfo()
        if (info && info.version) connection = true
        counter++
      } catch (e) {}
      counter++
    }
    if (!connection) throw new Error('Could not establish connection with node')

    await this.setIdentity()
    console.log(`${this.name.toUpperCase()}: ${this.identityPubkey}`)
    return
  }

  exec(cmd) {
    if (typeof cmd !== 'string')
      throw new Error('must pass a string for the list of commands to run w/ lncli')

    return exec(`${this.lncli} ${cmd}`, { env: this.env })
  }

  async setIdentity() {
    const resp = (await this.exec('getinfo'))
    if (resp.stderr) throw new Error(stderr)
    try {
      this.identityPubkey = JSON.parse(resp.stdout).identity_pubkey
    } catch (e) {
      console.log('Coudnt parse stdout:', resp.stdout)
      throw e
    }
  }

  async getInfo() {
    const resp = (await this.exec('getinfo'))

    if (resp.stderr.length) console.error('Problem connecting to node:', resp.stderr)
    return JSON.parse(resp.stdout)
  }
}

(async function() {
  console.log('Building images...')
  await exec('docker-compose build')

  const alice = new NodeConfig({ name: 'alice', port: 10001 })
  await alice.startNode()

  // Get an address from alice's node to use as the mining address for our full node
  // Needs to be a loop because sometimes even if the container is started
  // the node process may not have fully booted yet
  let MINING_ADDRESS, counter = 1, tries = 15
  while (!MINING_ADDRESS && counter < tries) {
    try {
      console.log(`Getting address from alice node.`)
      let { stdout, stderr} = await alice.exec('newaddress np2wkh')
      
      if (stdout)
        MINING_ADDRESS = JSON.parse(stdout).address
      else if (stderr) {
        console.error(stderr)
        break
      }
    } catch (e) {}
    counter++
  }

  // if loop was unable to get an address after 15 tries, throw
  if (!MINING_ADDRESS) throw new Error('Unable to retrieve an address from Alice node. Please try again.')

  console.log('Alice\'s address:', MINING_ADDRESS)

  // Run btcd node with alice's address as the mining address constant
  try {
    console.log('Starting btcd full node...')
    await exec(`docker-compose up -d btcd`, { env: {...env, MINING_ADDRESS }})
    
    // check node status before mining any blocks

    let blockchainInfo = (await exec(`docker-compose run btcctl getblockchaininfo`)).stdout
    blockchainInfo = JSON.parse(blockchainInfo)

    let balance = (await alice.exec('walletbalance')).stdout
    balance = JSON.parse(balance)

    // check if we already have a mined blockchain and funded wallet on persisted volume
    if (
      blockchainInfo.blocks && 
      blockchainInfo.chain === 'simnet' && 
      balance.confirmed_balance >= (1505000000000) // 400 simnet blocks worth of rewards
    ) {
      console.log('Found a simnet chain on persisted volumes')
      console.log('Height:', blockchainInfo.blocks)
      console.log('Network:', blockchainInfo.chain)
      console.log('Alice\'s balance:', balance.confirmed_balance)
    } else {
      console.log('No existing simnet chain found. Creating new one.')
      console.log('Mining 400 blocks...')
      await exec(`docker-compose run btcctl generate 400`, { env }) 
      let balance = (await alice.exec('walletbalance')).stdout
      balance = JSON.parse(balance)
      console.log(`Alice's balance: ${balance.confirmed_balance}`)
    }

    // Next let's startup nodes for bob and carol using a neutrino backend
    const bob = new NodeConfig({ name: 'bob', port: 10002, neutrino: true })
    await bob.startNode()

    const carol = new NodeConfig({ name: 'carol', port: 10003, neutrino: true })
    await carol.startNode()
  } catch (e) {
    console.error('problem starting node:', e)
  }
})()