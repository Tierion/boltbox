const { authenticatedLndGrpc } = require('ln-service')
const lnAccounting = require('ln-accounting')
const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')
const isBase64 = require('is-base64')
const request = require('request')
var fetch = require('isomorphic-fetch');
var Dropbox = require('dropbox').Dropbox;
const CSV = require('csv-string')

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

async function runIt() {
    try {

        let { lnd } = authenticatedLndGrpc({
            cert,
            macaroon,
            socket: LND_SOCKET
        })
        const options = { lnd }

        var dbx = new Dropbox({ accessToken: process.argv[3], fetch: fetch });

        options.request = request
        options.currency = 'BTC'
        options.fiat = 'USD'

        var a = new Date();
        a.setDate(1);
        a.setMonth(a.getMonth()-1);
        var b = new Date();
        b.setDate(0);
        b.setMonth(b.getMonth());

        options.after = a.toISOString()
        options.before = b.toISOString()
        options.rate_provider = 'coincap'

        const report = await lnAccounting.getAccountingReport(options)
        let fees = process.argv[2] + '-chain_fees-' + (a.getMonth() + 1) + '_' + a.getFullYear() + '.csv'
        let invoices = process.argv[2] + '-invoices-' + (a.getMonth() + 1) + '_' + a.getFullYear() + '.csv'
        let payments = process.argv[2] + '-payments-' + (a.getMonth() + 1) + '_' + a.getFullYear() + '.csv'

        let feeArr = []
        let invoicesArr = []
        let paymentsArr = []
        let type
        CSV.forEach(report.chain_fees_csv, ',', function(row, index) {
            if (row.length == 0 || !row[0]) {
                return
            }
            if (index == 0) {
                feeArr.push(row)
                return
            }
            row[0] = (row[0]/parseFloat(100000000)).toFixed(8)
            row[4] = process.argv[2]
            row[5] = "mainnet"
            row[7] = "OP_RETURN"
            if (row[8] && row[8].length > 0) {
                row[8] = row[8].split(":")[0]
            }
            feeArr.push(row)
        });
        CSV.forEach(report.invoices_csv, ',', function(row, index) {
            if (row.length == 0 || !row[0]) {
                return
            }
            if (index == 0) {
                invoicesArr.push(row)
                return
            }
            row[0] = (row[0]/parseFloat(100000000)).toFixed(8)
            row[4] = "gateway"
            row[5] = "mainnet"
            row[7] = process.argv[2]
            type = "Cores"
            invoicesArr.push(row)
        });
        CSV.forEach(report.payments_csv, ',', function(row, index) {
            if (row.length == 0 || !row[0]) {
                return
            }
            if (index == 0) {
                paymentsArr.push(row)
                return
            }
            row[0] = (row[0]/parseFloat(100000000)).toFixed(8)
            row[4] = process.argv[2]
            row[5] = "mainnet"
            type = "Gateways"
            paymentsArr.push(row)
        });
        let month = a.toLocaleString('default', { month: 'long' })
        dbx.filesUpload({
                path: `/Chainpoint Transactions/${a.getFullYear()}/${month}/${type}/${fees}`,
                contents: new Buffer(CSV.stringify(feeArr))
            })
            .then(response => {
                console.log(response);
            })
            .catch(err => {
                console.log(err);
            });
        dbx.filesUpload({
                path: `/Chainpoint Transactions/${a.getFullYear()}/${month}/${type}/${invoices}`,
                contents: new Buffer(CSV.stringify(invoicesArr))
            })
            .then(response => {
                console.log(response);
            })
            .catch(err => {
                console.log(err);
            });
        dbx.filesUpload({
                path: `/Chainpoint Transactions/${a.getFullYear()}/${month}/${type}/${payments}`,
                contents: new Buffer(CSV.stringify(paymentsArr))
            })
            .then(response => {
                console.log(response);
            })
            .catch(err => {
                console.log(err);
            });
        console.log("reports written to " + month)
    } catch (e) {
        console.error('There was a problem getting accounting information:', e)
    }
}

runIt()