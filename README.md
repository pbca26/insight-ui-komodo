# Komodo Multi Explorer Insight UI

## Prerequsites
NodeJS >= 8

## How to install and run:
- install nodejs
- run npm install
- modify ip and port if required https://github.com/pbca26/insight-ui-komodo/blob/master/main.js#L64
- (optional) mkdir certs
- (optional) copy priv.pem (privkey) and cert.pem to certs folder
- (optional) set https to true https://github.com/pbca26/insight-ui-komodo/blob/master/main.js#L66
- npm start

# Single chain Insight Explorer UI
- replace public/js/explorers.js with contents from public/js/explorers.singlechain.js
- toggle required flags, change ports/urls