const express = require('express')
const { authenticatedLndGrpc } = require('ln-service')
const lnAccounting = require('ln-accounting')
const dotenv = require('dotenv')
const fs = require('fs')

const app = express()

dotenv.config()
const { ACCOUNTING_PORT, LND_SOCKET, LND_MACAROON, LND_TLS_CERT } = process.env

let macaroon, cert
if (fs.existsSync(LND_MACAROON)) macaroon = Buffer.from(fs.readFileSync(LND_MACAROON)).toString('base64')
else macaroon = LND_MACAROON

if (LND_TLS_CERT && fs.existsSync(LND_TLS_CERT)) cert = Buffer.from(fs.readFileSync(LND_TLS_CERT)).toString('base64')
else if (LND_TLS_CERT) cert = LND_TLS_CERT

app.use('*', (req, _res, next) => {
  console.log(`${req.method} ${req.baseUrl}`)
  next()
})

app.get('/accounting', async (req, res) => {
  const { query } = req
  try {
    if (!macaroon || !LND_SOCKET) return res.status(500).send('Missing lnd credentials on server')

    let { lnd } = authenticatedLndGrpc({
      cert,
      macaroon,
      socket: LND_SOCKET
    })
    const options = { lnd }

    options.currency = 'BTC'
    options.fiat = 'USD'

    if (query.provider && lnAccounting.rateProviders.includes(query.provider)) options.rate_provider = query.provider
    else options.rate_provider = 'coincap'

    if (query.category) options.category = query.category
    if (query.before && query.after && query.before < query.after) {
      return res.status(400).send('Request made with a start date after end date')
    }
    if (query.before) options.before = query.before
    if (query.after) options.after = query.after
    const report = await lnAccounting.getAccountingReport(options)
    res.status(200)
    return res.json(report)
  } catch (e) {
    console.error('There was a problem getting accounting information:', e)
    res.status(500).send(e.message || e)
  }
})

app.all('*', (_req, res) => res.status(404).send('Resource not found'))

const port = ACCOUNTING_PORT || 9000
app.listen(port, () => console.log(`listening on port ${port}!`))
