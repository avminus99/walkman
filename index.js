const express = require('express')
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const port = 5000

var spotify_client_id = '6146757f2a9e4edaa561822bb54546f2'
var spotify_client_secret = '1c170c46187044b981aada1003abf071'
var redirect_uri = 'http://127.0.0.1:5000/auth/callback'

var app = express();
app.use(cors());
const path = require('path');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
}

var generateRandomString = (length) => {
  return crypto.randomBytes(60).toString('hex').slice(0, length);
}

var stateKey = 'spotify_auth_state';

app.get('/auth/login', (req, res) => {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  var scope = 'streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative';

  var params = new URLSearchParams({
    response_type: 'code',
    client_id: spotify_client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state,
    show_dialog: 'true'
  });

  res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
});

app.get('/auth/callback', (req, res) => {
  var code = req.query.code || null;

  axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
    code: code,
    redirect_uri: redirect_uri,
    grant_type: 'authorization_code'
  }), {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(spotify_client_id + ':' + spotify_client_secret).toString('base64')
    }
  }).then(response => {
    var access_token = response.data.access_token;
    res.redirect('http://localhost:3000/?access_token=' + access_token);
  }).catch(error => {
    res.send(error);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening at http://0.0.0.0:${PORT}`)
});