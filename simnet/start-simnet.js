#!/usr/bin/env node

(async function() {
  const { promisify } = require('util')

  const exec = promisify(require('child_process').exec)

  const NETWORK = 'simnet'

  // Alice
  const ALICE_DIR = "/lnd-data/alice"
  const ALICE_PORT = 10001
  
  // shortcut for interacting with alice node via lncli docker container
  const lncli_alice = `docker-compose run -e LNDDIR=${ALICE_DIR} -e RPCSERVER="alice:${ALICE_PORT}" lncli`

  const env = {
    NETWORK,
    COMPOSE_INTERACTIVE_NO_CLI: true,
  }

  try {
    console.log('Starting alice node...')
    let { stdout, stderr} = await exec(`docker-compose run -d -e LNDDIR=${ALICE_DIR} -e RPCLISTEN=${ALICE_PORT} -p ${ALICE_PORT}:${ALICE_PORT} --name alice lnd_btc --tlsextradomain="alice"`, { env } )
  } catch (e) {
    if (e.message.match(/Cannot create container for service lnd_btc: Conflict/g))
      console.warn('Container for alice already exists. Skipping')
    else  console.error('There was a problem starting alice node:', e.message)
  }

  // Get an address from alice's node to use as the mining address for our full node
  // Needs to be a loop because sometimes even if the container is started
  // the node process may not have fully booted yet
  let MINING_ADDRESS, counter = 1, tries = 15
  while (!MINING_ADDRESS && counter < tries) {
    try {
      console.log(`Attempting to get address from alice node. (Tries: ${counter}/${tries})`)
      let { stdout, stderr} = await exec(`${lncli_alice} newaddress np2wkh`, { env })
      
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

    let balance = (await exec(`${lncli_alice} walletbalance`, { env })).stdout
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
      let balance = (await exec(`${lncli_alice} walletbalance`, { env })).stdout
      balance = JSON.parse(balance)
      console.log(`Alice's balance: ${balance.confirmed_balance}`)
    }
  } catch (e) {
    console.error('problem starting node:', e)
  }
})()