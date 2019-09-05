const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
let app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  next();
});

app.use(bodyParser.json({ limit: '5mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({
  limit: '5mb',
  extended: true,
})); // support encoded bodies

// router
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/messages/verify/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/tx/send/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/blocks/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/charts/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/status/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/block/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/block-index/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/blocks-date/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/tx/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/address/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/charts/*/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/charts/coin/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/search/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/search/assets/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.use('/public', express.static(path.join(__dirname, 'public')));

let server;
const config = {
  ip: 'localhost',
  https: false,
  port: 8888,
};

if (config.https) {
  const options = {
    key: fs.readFileSync('certs/priv.pem'),
    cert: fs.readFileSync('certs/cert.pem'),
  };
  server = require('https')
            .createServer(options, app)
            .listen(config.port, config.isDev ? 'localhost' : config.ip);
} else {
  server = require('http')
            .createServer(app)
            .listen(config.port, config.isDev ? 'localhost' : config.ip);
}

console.log(`Insight Common UI server is running`);