#!/usr/bin/env node
const { promisify } = require('util')

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
  constructor({ name, port }) {
    this.name = name
    this.port = port
    this.lnddir = `/lnd-data/${name}`
    this.lncli = `docker-compose run -e LNDDIR=${this.lnddir} -e RPCSERVER="${name}:${port}" lncli`
    this.env = {
      ...env, 
      TLSEXTRADOMAIN: this.name
     }
  }

  async startNode() {
    await exec(`docker-compose run -d -e LNDDIR=${this.lnddir} -e RPCLISTEN=${this.port} -p ${this.port}:${this.port} --name ${this.name} lnd_btc --tlsextradomain="${this.name}"`, { env: this.env } )
    
    console.log(`Testing connection to ${this.name}...`)
    let counter = 1, connection = false
    // only want to return when the node is reachable
    while (!connection || counter < 10) {
      try {
        const info = await this.getInfo()
        if (info && info.version) connection = true
        counter++
      } catch (e) {}
      counter++
    }

    return
  }

  exec(cmd) {
    if (typeof cmd !== 'string')
      throw new Error('must pass a string for the list of commands to run w/ lncli')

    return exec(`${this.lncli} ${cmd}`, { env: this.env })
  }

  async setIdentity() {
    const info = (await this.exec('getinfo')).stdout
    this.identityPubkey = JSON.parse(info).identity_pubkey
  }

  async getInfo() {
    const resp = (await this.exec('getinfo'))
    
    return JSON.parse(resp.stdout)
  }
}

(async function() {
  const { promisify } = require('util')

  const exec = promisify(require('child_process').exec)

  const alice = new NodeConfig({ name: 'alice', port: 10001 })

  try {
    console.log('Starting alice node...')
    await alice.startNode()
  } catch (e) {
    if (e.message.match(/Cannot create container for service lnd_btc: Conflict/g))
      console.warn('Container for alice already exists. Skipping')
    else  console.error('There was a problem starting alice node:', e)
  }

  await alice.setIdentity()

  // Get an address from alice's node to use as the mining address for our full node
  // Needs to be a loop because sometimes even if the container is started
  // the node process may not have fully booted yet
  let MINING_ADDRESS, counter = 1, tries = 15
  while (!MINING_ADDRESS && counter < tries) {
    try {
      console.log(`Attempting to get address from alice node. (Tries: ${counter}/${tries})`)
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
      balance.confirmed_balance >= (100000000 * 50 * 400)
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
  } catch (e) {
    console.error('problem starting node:', e)
  }
})()