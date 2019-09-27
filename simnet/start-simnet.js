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

function mineBlocks(num=1) {
  assert(typeof num === 'number')
  return exec(`docker-compose run btcctl generate 400`, { env }) 
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
        if (info && info.version) {
          this.setIdentity(info.identity_pubkey)
          connection = true
        }
        counter++
      } catch (e) {}
      counter++
    }
    if (!connection) throw new Error('Could not establish connection with node')

    console.log(`${this.name.toUpperCase()} pubkey: ${this.identityPubkey}`)
    return
  }

  exec(cmd) {
    if (typeof cmd !== 'string')
      throw new Error('must pass a string for the list of commands to run w/ lncli')

    return exec(`${this.lncli} ${cmd}`, { env: this.env })
  }

  async setIdentity(pubkey) {
    this.identityPubkey = pubkey
  }

  async getInfo() {
    const resp = (await this.exec('getinfo'))

    if (resp.stderr.length) console.error('Problem connecting to node:', resp.stderr)
    return JSON.parse(resp.stdout)
  }

  async getAddress() {
    try {
      let { stdout, stderr} = await this.exec('newaddress np2wkh')
      if (stdout && stdout.length)
        return JSON.parse(stdout).address
      else if (stderr) {
        console.error(stderr)
      }
    } catch (e) {}
  }

  async getBalance() {
    try {
      let { stdout, stderr} = await this.exec('walletbalance')
      if (stdout && stdout.length)
        return JSON.parse(stdout)
      else if (stderr) {
        console.error(stderr)
      }
    } catch (e) {}
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
  console.log(`Getting address from alice for mining reward destination.`)
  let MINING_ADDRESS, counter = 1, tries = 15
  while (!MINING_ADDRESS && counter < tries) {
    MINING_ADDRESS = await alice.getAddress()
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

    let balance = await alice.getBalance()

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
      await mineBlocks(400)
      let balance = (await alice.exec('walletbalance')).stdout
      balance = JSON.parse(balance)
      console.log(`Alice's balance: ${balance.confirmed_balance}`)
    }

    // Startup nodes for bob and carol using a neutrino backend
    const bob = new NodeConfig({ name: 'bob', port: 10002, neutrino: true })
    await bob.startNode()

    const carol = new NodeConfig({ name: 'carol', port: 10003, neutrino: true })
    await carol.startNode()

    // Fund bob and carol from alice's wallet
    console.log('Funding bob and carol...')
    const bobAddr = await bob.getAddress()
    const carolAddr = await carol.getAddress()

    // send from alice to bob
    let aliceBalance = await alice.getBalance()
    let bobBalance = await bob.getBalance()
    let carolBalance = await carol.getBalance()
    
    const amount = Math.floor(aliceBalance.confirmed_balance / 4)

    console.log(`Sending ${amount} satoshis to bob and carol.`)
    
    await alice.exec(`sendcoins ${bobAddr} ${amount}`)
    // send from alice to carol
    await alice.exec(`sendcoins ${carolAddr} ${amount}`)

    await mineBlocks()

    aliceBalance = await alice.getBalance()
    bobBalance = await bob.getBalance()
    carolBalance = await carol.getBalance()

    console.log('New Balances')
    console.log('Alice: ', aliceBalance.confirmed_balance)
    console.log('Bob: ', bobBalance.confirmed_balance)
    console.log('Carol: ', carolBalance.confirmed_balance)
  } catch (e) {
    if (e.stderr) console.error('Encountered error starting network:', e.stderr)
    else console.error('Encountered error:', e)
  }
})()