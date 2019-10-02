/** 
 * @file Logging utilities for decorating stdout
 * Very simple helpers. If this gets more complex, we can consider 
 * having external dependencies.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
}
const reset = '\x1b[0m'



function colorLog(string, color) {
  console.log(colorize(string, color))
}

function colorize(string, color) {
  if (typeof string !== 'string') throw new Error('Must pass a string to colorize')
  if (typeof color !== 'string') throw new Error('Must pass a color to change string to')

  if (!colors[color]) throw new Error(`Don't recognize color ${color}`)

  return `${colors[color]}${string}${reset}`
}

exports.colorLog = colorLog
exports.colorize = colorize