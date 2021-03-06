const express = require('express')
const { authenticatedLndGrpc } = require('ln-service')
const lnAccounting = require('ln-accounting')
const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')
const isBase64 = require('is-base64')
const request = require('request')
const zip = require('express-zip');

const app = express()

dotenv.config()
const { ACCOUNTING_PORT, LND_SOCKET, LND_MACAROON, LND_TLS_CERT, LND_DIR, NETWORK = 'mainnet' } = process.env

let macaroon, cert
if (LND_MACAROON && isBase64(LND_MACAROON)) macaroon = LND_MACAROON
else if (fs.existsSync(LND_MACAROON)) macaroon = Buffer.from(fs.readFileSync(LND_MACAROON)).toString('base64')
else if (LND_DIR) {
  const macPath = path.join(LND_DIR, `/data/chain/bitcoin/${NETWORK}`, 'admin.macaroon')
  if (fs.existsSync(macPath)) macaroon = Buffer.from(fs.readFileSync(macPath)).toString('base64')
}

if (LND_TLS_CERT && isBase64(LND_TLS_CERT)) cert = LND_TLS_CERT
else if (LND_TLS_CERT && fs.existsSync(LND_TLS_CERT))
  cert = Buffer.from(fs.readFileSync(LND_TLS_CERT)).toString('base64')
else if (LND_DIR) {
  const certPath = path.join(LND_DIR, 'tls.cert')
  if (fs.existsSync(certPath)) cert = Buffer.from(fs.readFileSync(certPath)).toString('base64')
}

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

    options.request = request
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
    if (!(query.before && query.after)) {
      var a = new Date();
      a.setDate(1);
      a.setMonth(a.getMonth()-1);
      var b = new Date();
      b.setDate(0);
      b.setMonth(b.getMonth());
      options.after = a.toISOString()
      options.before = b.toISOString()
    }
    const report = await lnAccounting.getAccountingReport(options)
    fs.writeFileSync('csv/chain_fees.csv', report.chain_fees_csv);
    fs.writeFileSync('csv/chain_sends.csv', report.chain_sends_csv);
    fs.writeFileSync('csv/forwards.csv', report.forwards_csv);
    fs.writeFileSync('csv/invoices.csv', report.invoices_csv);
    fs.writeFileSync('csv/payments.csv',  report.payments_csv);
    res.status(200)
    res.zip([
      { path: 'csv/chain_fees.csv', name: 'csv/chain_fees.csv' },
      { path: 'csv/chain_sends.csv', name: 'csv/chain_sends.csv' },
      { path: 'csv/forwards.csv', name: 'csv/forwards.csv' },
      { path: 'csv/invoices.csv', name: 'csv/invoices.csv' },
      { path: 'csv/payments.csv', name: 'csv/payments.csv' }
    ]);
  } catch (e) {
    console.error('There was a problem getting accounting information:', e)
    res.status(500).send(e.message || e)
  }
})

app.all('*', (_req, res) => res.status(404).send('Resource not found'))

const port = ACCOUNTING_PORT || 9000
app.listen(port, () => console.log(`listening on port ${port}!`))
