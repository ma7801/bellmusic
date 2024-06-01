const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises;
require('dotenv').config();
const schedule = require('node-schedule');
const { exec, spawn } = require('child_process');

const app = express();
const port = 8080;

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri =  "http://localhost:8080/callback"; //process.env.REDIRECT_URI;
const username = process.env.USERNAME;
const pw = process.env.PASSWORD;

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const mainPage = 'pages/bellmusic';
const piDeviceName = 'Librespot';
const spotifyClientCommand = "librespot";
const spotifyClientArgs = [`-n "${username}"`, `-p "${pw}"` ];
var spotifyClientProcess = null;
var piDeviceId = null;

const scopes = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state'
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


// Create http server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


// Handle server kill/exit (kill librespot process)
function cleanup() {
  if (spotifyClientProcess) {
    spotifyClientProcess.kill();
  }

  schedule.gracefulShutdown();
}

process.on('SIGINT', () => { cleanup();  process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', () => { cleanup(); }); 
//process.on('uncaughtException', () => { cleanup(); process.exit(1); });


// Authorize Spotify (i.e. get authorization token)
function authorize(res) {
  const authUrl = `${authEndpoint}?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`;
  res.redirect(authUrl);  // --> /callback
}


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
    
    res.redirect(`/main`);
  } catch (error) {
    console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch access token');
  }
});

// App main page
app.get('/main', async (req, res) => {
  
  // If no authorization token yet  
  if(!token) {
    console.log("Token not defined.");
    authorize(res);
    return;
  }


  var testjob = schedule.scheduleJob("*/1 * * * *", function() {
    console.log("Testing");
  });

  /*
  // If device not set up
  if (!spotifyClientProcess) {
    
    //console.log("pw: " + pw);
    // Start the device (librespot) on the pi
    spotifyClientProcess = exec(`librespot -n "${username}"`, `-p "${pw}"`, (error, stdout, stderr) => {
      console.log("librespot: " + stdout.toString());
      console.log("librespot: " + error.toString());
      console.log("librespot: " + stderr.toString());
      console.log("OK");
    });
    // spotifyClientProcess = spawn(spotifyClientCommand, spotifyClientArgs);
    /*
    spotifyClientProcess.stdout.on('data', (data) => {
      console.log(`${spotifyClientCommand}: `, data.toString());
    });
    
    spotifyClientProcess.stderr.on('data', (data) => {
      console.error(`${spotifyClientCommand}: `, data.toString());
    });

    
    spotifyClientProcess.on('error', (error) => {
      //***TO CODE: handle error from librespot
    });
    
  }
  */
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


// Start up Spotify client and connect to Spotify account so that device is active
function startDevice() {
  
}
/*
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
*/

//Get device list, and store the Pi device ID
async function getPiDeviceId() {
  //const token = await readTokenFromFile();
  if(!token) {
    console.log("Token doesn't exist.");
    authorize();
    return;
  }
  
  // Get list of devices from Spotify
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log("Response:" + JSON.stringify(response.data));
    
    // Find the Pi/librespot device id and store in global piDeviceId
    response.data.devices.forEach(device => {
      if (device.name === piDeviceName) {
        console.log("Found pi device id: " + device.id);
        piDeviceId = device.id;
      }
    });
    
    // Will only run if device not found
    //console.log("Device not found.");
    //return null;


  } catch (error) {
    console.error('Error getting playback state', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to get playback state');
  }
  
}


// Start playback
app.get('/play', async (req, res) => {
  if(!token) {
    console.log("Token doesn't exist.");
    authorize(res);
    return;
  }
  
  // If we don't have the ID of the device, get it
  if(!piDeviceId) {
    await getPiDeviceId();
    console.log("Device ID: " + piDeviceId);
  }
  
  // Transfer playback to Pi and play!
  try {
    const response = await axios.put(
      'https://api.spotify.com/v1/me/player', 
      {
        'device_ids': [piDeviceId],
        'play': true
      },
      {
        headers: {
        'Authorization': `Bearer ${token}`
        }
      }
    );
  
    res.render(mainPage, data);

  } catch (error) {
    console.error('Error starting/resuming playback', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to start/resume playback');
  }
});


// Pause playback
app.get('/pause', async (req, res) => {
  if(!token) {
    console.log("Token doesn't exist.");
    //res.redirect("/login");
    return;
  }
  
  // If we don't have the ID of the device, get it
  if(!piDeviceId) {
    getPiDeviceId();
  }
  
  // Send pause request to Spotify
  try {
    const response = await axios.put(
      'https://api.spotify.com/v1/me/player/pause', 
      {
        'device_id': piDeviceId,
      },
      {
        headers: {
        'Authorization': `Bearer ${token}`
        }
      }
    );
    
    res.render(mainPage, data);
    
  } catch (error) {
    console.error('Error pausing playback', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to pausing playback');
  }
});


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
  

app.get('/load_assembly_schedule', async (req, res) => {
  
  _1and5Rule.hour = 8;
  _1and5Rule.minute = 28;
  _2and6Rule.hour = 9;
  _2and6Rule.minute = 50;
  _3and7Rule.hour = 11;
  _3and7Rule.minute = 12;
  _4and8Rule.hour = 13;
  _4and8Rule.minute = 48;
  
  data.current_bell_schedule = "Assembly";
});


