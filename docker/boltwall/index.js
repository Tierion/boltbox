#!/usr/bin/env node

// entrypoint for boltwall proxy server to run in docker image
/**
 * @file An example server entry point that implements Boltwall for protected content
 * Developers can use this as a boilerplate for using Boltwall in their own application
 */

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const { boltwall, TIME_CAVEAT_CONFIGS } = require('boltwall')

const configs = require('./configs')

const app = express()

// Required middleware - These must be used in any boltwall project
app.use(cors())
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

/**
 * Boltwall accepts a config object as an argument.
 * With this configuration object, the server/api admin
 * can setup custom caveats for restricting access to protected content
 * For example, in this config, we have a time based caveat, where each
 * satoshi of payment allows access for 1 second. caveatVerifier uses
 * the available time based caveat verifier, however this can also be customized.
 * getInvoiceDescription allows the admin to generate custom descriptions in the
 * lightning invoice
 */

// if there is a env var indicating to use time caveat, then enable
if (process.env.BOLTWALL_TIME_CAVEAT) app.use(boltwall(TIME_CAVEAT_CONFIGS))
// if a custom configuration is found then use that
else if (configs) app.use(boltwall(configs))
// otherwise, use without configs
else app.use(boltwall())

/******
Any middleware our route passed after this point will be protected and require
payment
******/

// TODO: pass request to process.env.BOLTWALL_PROTECTED_URL

app.get('/protected', (req, res) =>
  res.json({
    message: 'Protected route! This message will only be returned if an invoice has been paid'
  })
)

const port = process.env.BOLTWALL_PORT || 5000
app.listen(port, () => console.log(`listening on port ${port}!`))
