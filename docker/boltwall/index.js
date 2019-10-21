#!/usr/bin/env node

// entrypoint for boltwall proxy server to run in docker image
/**
 * @file An example server entry point that implements Boltwall for protected content
 * Developers can use this as a boilerplate for using Boltwall in their own application
 */

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const httpProxy = require('http-proxy')
const apiProxy = httpProxy.createProxyServer()

const { boltwall, TIME_CAVEAT_CONFIGS } = require('boltwall')

const configs = require('./configs')

const { BOLTWALL_PORT, BOLTWALL_PROTECTED_URL, BOLTWALL_TIME_CAVEAT, BOLTWALL_PATH = '/' } = process.env

const app = express()

// Required middleware - These must be used in any boltwall project
app.use(cors())
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.use('*', (req, res, next) => {
  console.log(`${req.method} ${req.baseUrl}`)
  next()
})
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
if (BOLTWALL_TIME_CAVEAT) app.use(BOLTWALL_PATH, boltwall(TIME_CAVEAT_CONFIGS))
// if a custom configuration is found then use that
else if (Object.keys(configs).length) app.use(BOLTWALL_PATH, boltwall(configs))
// otherwise, use without configs
else app.use(BOLTWALL_PATH, boltwall())

/******
Any middleware our route passed after this point will be protected and require
payment
******/

let protectedRoute

if (BOLTWALL_PROTECTED_URL) {
  protectedRoute = (req, res) => {
    console.log('Request paid for and authenticated. Forwarding to protected route.')
    console.log(`${req.method} ${req.path}`)
    apiProxy.web(req, res, {
      target: BOLTWALL_PROTECTED_URL,
      secure: true,
      xfwd: true, // adds x-forward headers
      changeOrigin: true // changes the origin of the host header to the target URL. fixes a ssl related error
    })
  }
} else {
  protectedRoute = (req, res) =>
    res.json({
      message: 'Protected route! This message will only be returned if an invoice has been paid'
    })
}

app.use(`${BOLTWALL_PATH}/`, protectedRoute)
app.all('*', (req, res) => res.status(404).send('Resource not found'))
const port = BOLTWALL_PORT || 5000
app.listen(port, () => console.log(`listening on port ${port}!`))
