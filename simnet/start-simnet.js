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

async function getBlockchainInfo(){
  let blockchainInfo = (await exec(`docker-compose run btcctl getblockchaininfo`)).stdout
  return JSON.parse(blockchainInfo)
}

/**
 * A class used to create NodeConfigs for creating and interacting simnet
 * lightning nodes via docker-compose
 * @params {String} name - name of node (e.g. 'alice', 'bob', 'carol')
 * @params {Number} rpc - RPC port that will be exposed and used to communicate via lncli container
 * @params {Boolean} neutrino - whether or not to run as neutrino light client
 * @params {Number} p2p - p2p listening port
 */
class NodeConfig {
  constructor({ name, rpc, neutrino, p2p }) {
    assert(typeof rpc === 'number', 'NodeConfig requires a custom rpc port to create a node')
    assert(typeof p2p === 'number', 'NodeConfig requires a custom p2p listening port to create a node')
    assert(typeof name === 'string', 'NodeConfig requires a string to set the name of the node to')

    this.name = name
    this.rpcPort = rpc
    this.p2pPort = p2p
    this.lnddir = `/lnd-data/${name}`
    this.lncli = `docker-compose run -e LNDDIR=${this.lnddir} -e RPCSERVER="${name}:${rpc}" -e NETWORK=simnet lncli`
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
    -e RPCLISTEN=${this.rpcPort} \
    -e NOSEEDBACKUP='true'\
    -e TLSEXTRADOMAIN='${this.name}'
    -e LISTEN='${this.p2pPort}'`
    
    if (this.neutrino) {
      startCmd = `${startCmd} -e NEUTRINO=btcd:18555 -e BACKEND=neutrino`
    }
    
    startCmd = `${startCmd} \
    -p ${this.rpcPort}:${this.rpcPort} \
    -p ${this.p2pPort}:${this.p2pPort} \
    --name ${this.name} lnd_btc`

    startCmd = startCmd.replace(/\s\s+/g, ' ')

    // console.log(`Starting ${this.name} node:`, startCmd)

    try {
      await exec(startCmd, { env: this.env })
    } catch (e) {
       if (e.message.match(/Cannot create container for service lnd_btc: Conflict/g))
        console.warn(`Container for ${this.name} already exists. Skipping startup.`)
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

  async exec(cmd) {
    if (typeof cmd !== 'string')
      throw new Error('must pass a string for the list of commands to run w/ lncli')

    try {
      let { stdout, stderr} = await exec(`${this.lncli} ${cmd}`, { env: this.env })
      if (stdout && stdout.length)
        return JSON.parse(stdout)
      else if (stderr && stderr.length) {
        console.error('Problem connecting to node:', stderr)
      } else {
        throw new Error('No response from container.')
      }
    } catch (e) {
      // NOTE: This will just run an infinite loop in case there was just an intermediate
      // failure w/ a connection. May need to SIGINT if the problem is not intermittent.
      console.error(`Problem executing command for ${this.name}: ${cmd}\n`, e.message)
      console.log('Trying again...')
      return this.exec(cmd)
    }
  }

  async setIdentity(pubkey) {
    this.identityPubkey = pubkey
  }

  getInfo() {
    return this.exec('getinfo')
  }

  async getAddress() {
    const address = await this.exec('newaddress np2wkh')
    if (!address || !address.address) {
      console.error('Problem with address response:', address)
      throw new Error('Problem with getting addresses')
    }
    return address.address
  }

  async getBalance() {
    return await this.exec('walletbalance')
  }

  async channelBalance() {
    return await this.exec('channelbalance')
  }

  async listPeers() {
    return (await this.exec('listpeers')).peers
  }

  async listChannels() {
    return (await this.exec('listchannels')).channels
  }

  async openChannel(nodeOrIdentity, local, push=0) {
    let nodeKey = nodeOrIdentity.identityPubkey || nodeOrIdentity
    assert(typeof nodeKey === 'string' && nodeKey.length, 'Expected either a NodeConfig or an identity pubkey string')
    assert(typeof local === 'number', 'Expected an amount of satoshis to open the channel with ')
    assert(typeof push === 'number', 'Push amount for channel open must be an integer (number of satoshis)')

    const resp = await this.exec(`openchannel ${nodeKey} ${local} ${push}`)

    return resp
  }
}

(async function() {
  console.log('Building images...')
  await exec('docker-compose build')

  const alice = new NodeConfig({ name: 'alice', rpc: 10001, p2p: 19735 })
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
    let blockchainInfo = await getBlockchainInfo()

    let balance = await alice.getBalance()

    // check if we already have a mined blockchain and funded wallet on persisted volume
    if (
      blockchainInfo.blocks && 
      blockchainInfo.chain === 'simnet' && 
      balance.confirmed_balance
    ) {
      console.log('Found a simnet chain on persisted volumes')
      console.log('Height:', blockchainInfo.blocks)
      console.log('Network:', blockchainInfo.chain)
      console.log('Alice\'s balance:', balance.confirmed_balance)
    } else {
      console.log('No existing simnet chain found. Creating new one.')
      console.log('Mining 400 blocks...')
      await mineBlocks(400)
      let balance = await alice.getBalance()
      console.log(`Alice's balance: ${balance.confirmed_balance}`)
    }

    // Startup nodes for bob and carol using a neutrino backend
    const bob = new NodeConfig({ name: 'bob', rpc: 10002, neutrino: true, p2p: 19736 })
    await bob.startNode()

    const carol = new NodeConfig({ name: 'carol', rpc: 10003, neutrino: true, p2p: 19737 })
    await carol.startNode()

    // Fund bob and carol from alice's wallet
    console.log('Funding bob and carol...')

    // send from alice to bob
    var [aliceBalance, bobBalance, carolBalance] = await Promise.all([alice.getBalance(), bob.getBalance(), carol.getBalance()])

    if (bobBalance.confirmed_balance > 0 && carolBalance.confirmed_balance > 0) {
      console.log('Bob and Carol are already funded')
      chanBalance = bobBalance / 2
    } else {
      const bobAddr = await bob.getAddress()
      const carolAddr = await carol.getAddress()
      const amount = Math.floor(aliceBalance.confirmed_balance / 4)

      console.log(`Sending ${amount} satoshis to bob and carol.`)
      
      await alice.exec(`sendcoins ${bobAddr} ${amount}`)
      // send from alice to carol
      await alice.exec(`sendcoins ${carolAddr} ${amount}`)

      await mineBlocks()

      var [aliceBalance, bobBalance, carolBalance] = await Promise.all([alice.getBalance(), bob.getBalance(), carol.getBalance()])

      console.log('Balances')
      console.log('Alice: ', aliceBalance.confirmed_balance)
      console.log('Bob:   ', bobBalance.confirmed_balance)
      console.log('Carol: ', carolBalance.confirmed_balance)
    }

    // Add peers and open channels: alice to bob, bob to carol, and carol to alice
    console.log('Adding peers and opening channels between alice, bob, and carol') 
    var [alicePeers, bobPeers, carolPeers] = await Promise.all([alice.listPeers(), bob.listPeers(), carol.listPeers()])

    if (alicePeers.length && bobPeers.length && carolPeers.length) {
      console.log('Already connected to peers. Skipping peer connection...')
    } else {
      console.log('Connecting alice and bob as peers...')
      await alice.exec(`connect ${bob.identityPubkey}@${bob.name}:${bob.p2pPort}`)
      
      console.log('Connecting bob and carol as peers...')
      await bob.exec(`connect ${carol.identityPubkey}@${carol.name}:${carol.p2pPort}`)
      
      var [alicePeers, bobPeers, carolPeers] = await Promise.all([alice.listPeers(), bob.listPeers(), carol.listPeers()])

      assert.equal(alicePeers.length, 1, 'Expected alice to have 1 peer')
      assert.equal(bobPeers.length, 2, 'Expected bob to have 2 peer')
      assert.equal(carolPeers.length, 1, 'Expected carol to have 1 peer')
    }

    var [aliceChannels, bobChannels, carolChannels] = await Promise.all([alice.listChannels(), bob.listChannels(), carol.listChannels()])

    if (aliceChannels.length && bobChannels.length && carolChannels.length) {
      console.log('Nodes already have channels open. Skipping channel opens...')
    } else {
      console.log('Opening a 1000000 satoshi channel from alice to bob. Pushing 250000 satoshis')
      await alice.openChannel(bob, 1000000, 250000)

      console.log('Opening a 1000000 satoshi channel from bob to carol. Pushing 250000 satoshis')
      await bob.openChannel(carol, 1000000, 250000)
      
      console.log('Sent funding txs. Mining 10 blocks to confirm channels')

      await mineBlocks(10)

      var [aliceChannels, bobChannels, carolChannels] = await Promise.all([alice.listChannels(), bob.listChannels(), carol.listChannels()])
      assert(aliceChannels.length, 'alice\'s channels didn\'t open')
      assert(bobChannels.length, 'bob\'s channels didn\'t open')
      assert(carolChannels.length, 'carol\'s channels didn\'t open')
      console.log('Channels all opened successfully')
    }

    console.log('Your network is ready to go! Gathering network information...\n')
    
    blockchainInfo = await getBlockchainInfo()
    
    var [
      aliceBalance, 
      bobBalance, 
      carolBalance, 
      aliceLnBalance, 
      bobLnBalance, 
      carolLnBalance
    ] = await Promise.all([
      alice.getBalance(), 
      bob.getBalance(), 
      carol.getBalance(), 
      alice.channelBalance(), 
      bob.channelBalance(), 
      carol.channelBalance()]
    )
    console.log('************************** \n')

    console.log('***** Network summary: ***** \n')
    console.log('Blockchain:')
    console.log('Height:', blockchainInfo.blocks)
    console.log('Network:', blockchainInfo.chain)

    console.log('\n')

    console.log('**ALICE**')
    console.log('Wallet Balance:', aliceBalance.confirmed_balance)
    console.log('Channel Balance:', aliceLnBalance.balance)
    console.log('Pubkey: ', alice.identityPubkey)
    console.log('RPC Port:', alice.rpcPort)
    console.log('Command Prefix:', alice.lncli)
    
    console.log('\n')

    console.log('**BOB**')
    console.log('Wallet Balance:', bobBalance.confirmed_balance)
    console.log('Channel Balance:', bobLnBalance.balance)
    console.log('Pubkey: ', bob.identityPubkey)
    console.log('RPC Port:', bob.rpcPort)
    console.log('Command Prefix:', bob.lncli)

    console.log('\n')

    console.log('**CAROL**')
    console.log('Wallet Balance:', carolBalance.confirmed_balance)
    console.log('Channel Balance:', carolLnBalance.balance)
    console.log('Pubkey: ', carol.identityPubkey)
    console.log('RPC Port:', carol.rpcPort)
    console.log('Command Prefix:', carol.lncli)
    
    console.log('************************** \n')
    
    console.log(
      'To interact with any of your nodes, simply copy the Command Prefix for the node you\'d like to run a command against and \
paste it into your terminal followed by the lncli command you\'d like to run.', 
      `Make sure to run from the current directory (${process.cwd()})`
    )

  } catch (e) {
    if (e.stderr) console.error('Encountered error starting network:', e.stderr)
    else console.error('Encountered error:', e)
  }
})()