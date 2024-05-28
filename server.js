const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises;
require('dotenv').config();
const schedule = require('node-schedule');

const app = express();
const port = 8080;

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const mainPage = 'pages/bellmusic';
const piDevice = 'Librespot';

const scopes = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state'
  // Add other scopes as needed
];

const mThruF = [new schedule.Range(1,5)];
const _1and5Rule = new schedule.RecurrenceRule();
const _2and6Rule = new schedule.RecurrenceRule();
const _3and7Rule = new schedule.RecurrenceRule();
const _4and8Rule = new schedule.RecurrenceRule();
_1and5Rule.dayOfWeek = mThruF;
_2and6Rule.dayOfWeek = mThruF;
_3and7Rule.dayOfWeek = mThruF;
_4and8Rule.dayOfWeek = mThruF;

app.set('view engine', 'ejs');

var token = null;
var data = {
  display_name: "[not logged in]",
  is_playing: false,
  device_name: "unknown",
  current_bell_schedule: "not set"
  
  };


app.get('/bellmusic', (req, res) => {
  res.render(mainPage, data);
});

// Redirect to Spotify's authorization URL
app.get('/login', (req, res) => {
  const authUrl = `${authEndpoint}?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`;
  res.redirect(authUrl);
});

// Handle the callback from Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  if (!code) {
    res.status(400).send('No code returned');
    return;
  }

  try {
    const response = await axios.post(tokenEndpoint, querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirect_uri,
      client_id: client_id,
      client_secret: client_secret
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Store token in global token variable
    token = response.data.access_token.trim();
    
    /*
    // Store the access token (overwrite old one if there is one)
    fs.writeFile('.token', response.data.access_token, function (err) {
      if (err) console.log("Error writing access token to file.");
      else console.log("Successfully saved access token.");
    });
    */
    
    res.redirect(`/profile`);
  } catch (error) {
    console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch access token');
  }
});

// Fetch user profile
app.get('/profile', async (req, res) => {
    
  //const token = await readTokenFromFile();
  if(!token) {
    console.log("Token not defined.");
    //res.redirect("/login");
    return;
  }
  // Get the profile from Spotify
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    data.display_name = response.data.display_name;
    res.render(mainPage, data);
    //res.json(response.data); // User profile information
  } catch (error) {
    console.error('Error fetching profile:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch profile');
  }
  
});
  
//Read token from file
// NOTE: Commented this out for now and just using a global var for token
/*async function readTokenFromFile() {
  // Read access token from file
  
  try {
    const data = await fs.readFile('.token', 'utf8');
    return data.trim();
  } catch (err) {
    console.error("Error reading from token file:", err);
    return null;
  }
  
}*/

//Get playback state
app.get('/playback_state', async (req, res) => {
  //const token = await readTokenFromFile();
  if(!token) {
    console.log("Token doesn't exist.");
    //res.redirect("/login");
    return;
  }
  console.log("Token: " + token);
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    //console.log("Response:" + JSON.stringify(response.data));
    data.is_playing = response.data.is_playing;
    data.device_name = response.data.device.name;
    res.render(mainPage, data);

  } catch (error) {
    console.error('Error getting playback state', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to get playback state');
  }
  

});


//Get available devices
app.get('/devices', async (req, res) => {
  //const token = await readTokenFromFile();
  if(!token) {
    console.log("Token doesn't exist.");
    //res.redirect("/login");
    return;
  }
  console.log("Token: " + token);
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log("Response:" + JSON.stringify(response.data));
    res.render(mainPage, data);

  } catch (error) {
    console.error('Error getting playback state', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to get playback state');
  }
  

});


// Transfer playback to librespot


// Start playback
app.get('/play', async (req, res) => {
  if(!token) {
    console.log("Token doesn't exist.");
    //res.redirect("/login");
    return;
  }
  
  try {
    const response = await axios.put(
      'https://api.spotify.com/v1/me/player/play', 
      {
        'position_ms': 0
      },
      {
        headers: {
        'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log("Response:" + JSON.stringify(response.data));
    res.render(mainPage, data);

  } catch (error) {
    console.error('Error starting/resuming playback', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to start/resume playback');
  }
});

// Stop playback

// Set regular bell schedule
app.get('/load_regular_schedule', async (req, res) => {
  
  _1and5Rule.hour = 8;
  _1and5Rule.minute = 28;
  _2and6Rule.hour = 10;
  _2and6Rule.minute = 1;
  _3and7Rule.hour = 11;
  _3and7Rule.minute = 34;
  _4and8Rule.hour = 13;
  _4and8Rule.minute = 39;
  
  data.current_bell_schedule = "Regular";
});
  



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
