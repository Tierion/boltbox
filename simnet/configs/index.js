module.exports = {
  minAmount: 400,
  getInvoiceDescription: req => `Invoice to grant access to ${req.ip} for 60 seconds if you can guess my middlename.`,
  getCaveat: req => `middleName=${req.body.middleName}&&expiryTime=${new Date(Date.now() + 60000)}`,
  caveatVerifier: () => caveat => {
    let [middleName, expiryTime] = caveat.split('&&')
    if (!middleName || !expiryTime) return false
    middleName = middleName.substr('middleName='.length).trim()
    expiryTime = expiryTime.substr('expiryTime='.length).trim()
    return middleName.toLowerCase() === 'danger' && Date.now() < new Date(expiryTime)
  }
}
