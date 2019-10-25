module.exports = {
  minAmount: 400,
  getInvoiceDescription: req => `Invoice to grant access to ${req.ip} for 60 seconds if you can guess my middlename.`,
  getCaveat: req => `middlename=${req.body.middlename}&&expiryTime=${new Date(Date.now() + 30000)}`,
  caveatVerifier: () => caveat => {
    let [middlename, expiryTime] = caveat.split('&&')
    if (!middlename || !expiryTime) return false
    middlename = middlename.substr('middlename='.length).trim()
    expiryTime = expiryTime.substr('expiryTime='.length).trim()
    return middlename.toLowerCase() === 'danger' && Date.now() < new Date(expiryTime)
  }
}
