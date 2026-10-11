// OCR cannot access the network, including its Tesseract worker threads.
const deny = () => { throw new Error('OCR_NETWORK_DISABLED'); };
global.fetch = deny;
for (const name of ['http', 'https']) { const mod = require(name); mod.request = deny; mod.get = deny; }
const net = require('net'); net.connect = deny; net.createConnection = deny;
require('tls').connect = deny;
const dns = require('dns'); dns.lookup = deny; dns.resolve = deny;
