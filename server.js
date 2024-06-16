const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs').promises;
require('dotenv').config();
const schedule = require('node-schedule');
const { exec, spawn } = require('child_process');

// My external files
const spotify = require('./spotify');

const app = express();
const port = 3125;

var config = {
  _DEV: true,
  _WIN: true,
  token: null,
  isPlaying: false,
  deviceId: null,
  winDeviceName: 'Web Player (Chrome)',
  piDeviceName: 'Librespot'
};

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri =  config._DEV ? process.env.REDIRECT_URI_DEV : process.env.REDIRECT_URI_PROD;
const username = process.env.USERNAME;
const pw = process.env.PASSWORD;

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const mainPage = 'pages/bellmusic';
const spotifyClientCommand = "librespot";
const spotifyClientArgs = [`-n "${username}"`, `-p "${pw}"` ];
const keepDeviceAliveInterval = 5;   // minutes
var isKeepDeviceAliveIntervalSet = false;

var playlistsLoaded = false;
var curPlaylist;

var spotifyClientProcess = null;

var refreshToken = null;   // Refresh token sent with orig. authorization
var refreshTokenInterval = 25;  // minutes
var isTokenIntervalSet = false;  // Flag to indicate if setInterval for token refresh set

const scopes = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private'
];

// Note: Range(0,6) allows dev testing on weekends :)
const weekdays = config._DEV ? [new schedule.Range(0,6)] : [new schedule.Range(1,5)];

const playTimes = {
  "regular" : [
    { hour: 8, minute: 28 },
    { hour: 10, minute: 1 },
    { hour: 11, minute: 34 },
    { hour: 13, minute: 39 },
    { hour: 15, minute: 10 }
  ],
  "assembly" : [
    { hour: 8, minute: 28 },
    { hour: 9, minute: 50 },
    { hour: 11, minute: 12 },
    { hour: 13, minute: 48 },
    { hour: 15, minute: 10 }  
  ],
  "debug" : [
    { hour: 19, minute: 20 },
    { hour: 19, minute: 22 }
  ]
};

const pauseTimes = {
  "regular": [
    { hour: 8, minute: 35 },
    { hour: 10, minute: 8 },
    { hour: 11, minute: 41 },
    { hour: 13, minute: 46 },
    { hour: 15, minute: 15 }
  ],
  "assembly" : [
    { hour: 8, minute: 35 },
    { hour: 9, minute: 57 },
    { hour: 11, minute: 19 },
    { hour: 13, minute: 55 },
    { hour: 15, minute: 15 }  
  ],
  "debug" : [
    { hour: 19, minute: 21 },
    { hour: 19, minute: 23 }
  ]
};

scheduledJobs = [];


// Data used to display on main HTML page
var viewData = {
  display_name: "[not logged in]",
  device_name: "unknown",
  current_bell_schedule: "not set",
  current_playlist: "not set",
  playlists: []
};

// Set view engine for HTML template(s)
app.set('view engine', 'ejs');

// Create http server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


app.get('/loadAssembly', async (req, res) => {
  loadSchedule("assembly");
  res.redirect("/main");
});

app.get('/loadRegular', async (req, res) => {
  loadSchedule("regular");
  res.redirect("/main");
});

// Create jobs for play and pause for "regular" or "assembly" schedule type
function loadSchedule(type) {
  
  // Clear any currently scheduled jobs, if there are any
  if (scheduledJobs.length > 0) {
    cancelAllJobs();
  }
  console.log("type:" + type);
  console.log("playTimes: " + JSON.stringify(playTimes));
  console.log("playTimes.type: " + JSON.stringify(playTimes[type]));

  playTimes[type].forEach(time => {
    const playRule = new schedule.RecurrenceRule();
    playRule.hour = time.hour;
    playRule.minute = time.minute;
    playRule.dayOfWeek = weekdays;

    console.log(`Scheduled play time at ${time.hour}:${time.minute} every weekday`);
    const job = schedule.scheduleJob(playRule, spotify.play);
    
    // Save job if it needs to be cancelled later
    scheduledJobs.push(job);
  });
  
  pauseTimes[type].forEach(time => {
    const pauseRule = new schedule.RecurrenceRule();
    pauseRule.hour = time.hour;
    pauseRule.minute = time.minute;
    pauseRule.dayOfWeek = weekdays;

    const job = schedule.scheduleJob(pauseRule, spotify.pause);
    
    // Save job if it needs to be cancelled later
    scheduledJobs.push(job);
  });

  // Data for view
  viewData.current_bell_schedule = type;

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
exports.authorize = authorize;


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
    config.token = response.data.access_token.trim();
    console.log("Received access token: " + config.token);
    
        // Store refresh token (used to refresh token later)
    refreshToken = response.data.refresh_token.trim(); 
    console.log("Received refresh token: " + refreshToken);
    
    res.redirect(`/main`);
  } catch (error) {
    console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch access token');
  }
});



// Refresh auth token
async function refreshAuthToken() {
  try {
    const authBuffer = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    const response = await axios.post(tokenEndpoint, null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      headers: {
        'Authorization': `Basic ${authBuffer}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Store the new token in config
    config.token = response.data.access_token.trim();   
    console.log("New token after refresh: " + config.token);
    
  } catch (error) {
    console.error('Error refreshing Spotify token:', error.response ? error.response.data : error.message);
  }
}

// App main page
app.get('/main', async (req, res) => {
  
  console.log("Loading main page");
  
  // If no authorization token yet  
  if(!config.token) {
    console.log("Token not defined.");
    authorize(res);
    return;
  }

  // Load the schedule, if none loaded
  //loadSchedule("debug");
  if (scheduledJobs.length === 0) loadSchedule("regular");
  
  // Set/start the recurring timer to refresh the access token (if not set yet)
  if (!isTokenIntervalSet) {
    setInterval(refreshAuthToken, refreshTokenInterval * 60 * 1000);
    isTokenIntervalSet = true;
  }

  // Set/start the keep device alive timer 
  if (!isKeepDeviceAliveIntervalSet) {
    setInterval(() => { spotify.keepAlive(config) }, keepDeviceAliveInterval * 60 * 1000);
    isKeepDeviceAliveIntervalSet = true;
  }

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
  
  // Get user's playlists, if they aren't already loaded
  if (!playlistsLoaded) {
    viewData.playlists = await spotify.getPlaylists(config);
    console.log("Playlists: " + JSON.stringify(viewData.playlists));
    playlistsLoaded = true;
  }
  // Get the profile from Spotify
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });

    viewData.display_name = response.data.display_name;
    res.render(mainPage, viewData);
    //res.json(response.data); // User profile information
  } catch (error) {
    console.error('Error fetching profile:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch profile');
  }
  


});


// Route for play button/link
app.get('/play', async (req, res) => {
  spotify.play(config);
  res.redirect('/main');
});

app.get('/setPlaylist', (req, res) => {
  /* TO CODE */
  console.log("setPlaylist: " + req.query.playlist);
  res.redirect('/main');
});


// Route for pause button/link
app.get('/pause', async (req, res) => {
  spotify.pause(config);
  res.redirect('/main');
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


