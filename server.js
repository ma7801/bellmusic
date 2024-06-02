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
const redirect_uri =  process.env.REDIRECT_URI;
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

const weekdays = [new schedule.Range(1,5)];

const playTimes = {
  "regular" : [
    { hour: 8, minute: 28 },
    { hour: 10, minute: 1 },
    { hour: 11, minute: 34 },
    { hour: 13, minute: 39 }
  ],
  "assembly" : [
    { hour: 8, minute: 28 },
    { hour: 9, minute: 50 },
    { hour: 11, minute: 12 },
    { hour: 13, minute: 48 }  
  ],
  "debug" : [
    { hour: 16, minute: 56 },
    { hour: 16, minute: 58 }
  ]
};

const pauseTimes = {
  "regular": [
    { hour: 8, minute: 35 },
    { hour: 10, minute: 8 },
    { hour: 11, minute: 41 },
    { hour: 13, minute: 46 }
  ],
  "assembly" : [
    { hour: 8, minute: 35 },
    { hour: 9, minute: 57 },
    { hour: 11, minute: 19 },
    { hour: 13, minute: 55 }  
  ],
  "debug" : [
    { hour: 16, minute: 57 },
    { hour: 16, minute: 59 }
  ]
};

scheduledJobs = [];

var token = null;  // Auth token used with Spotify API

// Data used to display on main HTML page
var data = {
  display_name: "[not logged in]",
  is_playing: false,
  device_name: "unknown",
  current_bell_schedule: "not set"
};

// Set view engine for HTML template(s)
app.set('view engine', 'ejs');

// Create http server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


// Create jobs for play and pause for "regular" or "assembly" schedule type
function loadSchedule(type) {
  
  // Clear any currently scheduled jobs, if there are any
  if (scheduledJobs.length > 0) {
    cancelAllJobs();
  }
  console.log("type:" + type);
  console.log(JSON.stringify("playTimes: " + playTimes));
  console.log(JSON.stringify("playTimes.type: " + playTimes[type]));
  
  playTimes[type].forEach(time => {
    const playRule = new schedule.RecurrenceRule();
    playRule.hour = time.hour;
    playRule.minute = time.minute;
    playRule.dayOfWeek = weekdays;

    const job = schedule.scheduleJob(playRule, play);
    
    // Save job if it needs to be cancelled later
    scheduledJobs.push(job);
  });
  
  pauseTimes[type].forEach(time => {
    const pauseRule = new schedule.RecurrenceRule();
    pauseRule.hour = time.hour;
    pauseRule.minute = time.minute;
    pauseRule.dayOfWeek = weekdays;

    const job = schedule.scheduleJob(pauseRule, pause);
    
    // Save job if it needs to be cancelled later
    scheduledJobs.push(job);
  });
}

function cancelAllJobs() {
  // If nothing to cancel, return
  if (scheduledJobs.length === 0) return;
  
  // Cancel each job
  scheduledJobs.forEach(job => {
    job.cancel();
  });
  scheduledJobs.length = 0;  // Clear jobs the array
  console.log('All scheduled tasks have been canceled.');
}



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

  // Load the schedule
  loadSchedule("debug");
  
  //loadSchedule("regular");

  //var testjob = schedule.scheduleJob("*/1 * * * *", function() {
  //  console.log("Testing");
  //  startPlayback(res);
  //});

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


async function play() {
  
  console.log("Executing play()");
  
  if(!token) {
    console.log("play(): Token doesn't exist.");
    //***TO CODE: Need to hand somehow without a response object
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

  } catch (error) {
    console.error('Error starting/resuming playback', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to start/resume playback');
  }
}

async function pause() {
  
  console.log("Executing pause()");
  
  if(!token) {
    console.log("pause(): Token doesn't exist.");
    //***TO CODE: Need to hand somehow without a response object
    return;
  }
  
  // If we don't have the ID of the device, get it
  if(!piDeviceId) {
    getPiDeviceId();
    console.log("Device ID: " + piDeviceId);
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
  
}


//Get device list, and store the Pi device ID
async function getPiDeviceId() {
  //const token = await readTokenFromFile();
  if(!token) {
    console.log("Token doesn't exist.");
    authorize(res);
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
    //res.status(500).send('Failed to get playback state');
  }
  
}

/*
async function startPlayback(res) {
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

  } catch (error) {
    console.error('Error starting/resuming playback', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to start/resume playback');
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
* 
* */

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



/*
const regularPlayTimes = [
  { hour: 8, minute: 28 },
  { hour: 10, minute: 1 },
  { hour: 11, minute: 34 },
  { hour: 13, minute: 39 }
];
const regularPauseTimes = [
  { hour: 8, minute: 35 },
  { hour: 10, minute: 8 },
  { hour: 11, minute: 41 },
  { hour: 13, minute: 46 }
];
const assemblyPlayTimes = [
  { hour: 8, minute: 28 },
  { hour: 9, minute: 50 },
  { hour: 11, minute: 12 },
  { hour: 13, minute: 48 }
];
const assemblyPauseTimes = [
  { hour: 8, minute: 35 },
  { hour: 9, minute: 57 },
  { hour: 11, minute: 19 },
  { hour: 13, minute: 55 }
];
*/
