var _explorers = {
  TOKENSV2: {
    symbol: 'TOKENSV2',
    url: 'http://localhost:3001',
    apiPrefix: '/insight-api-komodo',
    socketPrefix: '/insight-api-komodo',
    tokens: true,
    notarized: false,
    default: true,
  },
};

var explorers = [];

for (var key in _explorers) {
  explorers.push(typeof _explorers[key] === 'object' && _explorers[key].hasOwnProperty('ext') ? { ext: true, name: key, url: _explorers[key].url } : key);
}