#!/usr/bin/env node
const { promisify } = require('util')
const assert = require('assert')
const exec = promisify(require('child_process').exec)

const { NodeConfig, colorLog, colorize } = require('../utils')


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

(async function() {
  console.log('Building images...')
  await exec('docker-compose build')

  const alice = new NodeConfig({ name: 'alice', rpc: 10001, p2p: 19735, network: env.NETWORK })
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
    const bob = new NodeConfig({ name: 'bob', rpc: 10002, neutrino: true, p2p: 19736, network: env.NETWORK })
    await bob.startNode()

    const carol = new NodeConfig({ name: 'carol', rpc: 10003, neutrino: true, p2p: 19737, network: env.NETWORK })
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


    console.log('\nYour network is ready to go! Gathering network information...\n')
    
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
    console.log('\n')

    colorLog('***** Network summary ***** \n', 'cyan')
    console.log('Blockchain')
    console.log('Height:', blockchainInfo.blocks)
    console.log('Network:', blockchainInfo.chain)

    console.log('\n')
    const nodes = [alice, bob, carol]

    alice.balance = aliceBalance.confirmed_balance
    alice.lnBalance = aliceLnBalance.balance
    bob.balance = bobBalance.confirmed_balance
    bob.lnBalance = bobLnBalance.balance
    carol.balance = carolBalance.confirmed_balance
    carol.lnBalance = carolLnBalance.balance

    for (let node of nodes) {
      colorLog(`**${node.name.toUpperCase()}**`, 'cyan')
      console.log('Wallet Balance:', node.balance)
      console.log('Channel Balance:', node.lnBalance)
      console.log(`Identity: ${node.identityPubkey}@${node.name}:${node.p2pPort}`)
      console.log('RPC Port:', node.rpcPort)
      console.log(`Command Prefix:`, colorize(node.lncli, 'bgYellow'))
      
      console.log('\n')
    }
    
    colorLog('********************************', 'magenta')

    console.log(
      'To interact with any of your nodes, simply copy the Command Prefix for the node you\'d like to run a command against and \
paste it into your terminal followed by the lncli command you\'d like to run.', 
      `Make sure to run from the current directory (${process.cwd()})`
    )
    console.log(`For example, to get info about the ${carol.name} node, simply run:\n`)
    colorLog(`${carol.lncli} getinfo`, 'bgYellow')

    colorLog('********************************', 'magenta')

  } catch (e) {
    if (e.stderr) console.error('Encountered error starting network:', e.stderr)
    else console.error('Encountered error:', e)
  }
})()