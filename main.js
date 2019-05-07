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
app.get('/messages/verify', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/tx/send', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/blocks', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/charts/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/block/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/block-index/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/block-date/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/tx/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/address/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.use('/public', express.static(path.join(__dirname, 'public')));

server = require('http')
.createServer(app)
.listen(8888, 'localhost');

console.log(`Server is running`);