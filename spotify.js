const axios = require("axios");
const sleep = require("./sleep");

/* Defines helper functions:
  getPlaylists(config) - returns users playlists as an array of objects: {'name': 'playlist_name', 'id': 'playlist_id'}
  play(config) - start playback
  pause(config) - stop playback
  skip(config, numTracks = 1) - skip to next track in queue, or ahead in queue by numTracks

*/

async function getPlaylists(config) {
    
    var playlists = [];

    // Get the profile from Spotify
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: {
              'Authorization': `Bearer ${config.token}`,
              'limit': 50
            }
        });

        //console.log("Entire response:" + JSON.stringify(response.data));
        response.data.items.forEach(playlist => {
          playlists.push({
            'name': playlist.name,
            'id': playlist.id
          });   
        });

        return playlists;

        } catch (error) {
        console.error('Error fetching playlists:', error.response ? error.response.data : error.message);
        return null;
        }

}


async function play(config) {
  // Note: keepAliveOnly used mainly by keep alive interval timer; calls this function but sets "play" to false in API call, which 
  //  keeps the device active without actually playing
  // Don't attempt a keep-alive call if the device is already playing - that will pause it!
  if (config.keepAliveOnly && config.isPlaying) {
    console.log("play(): keepAliveOnly = isPlaying = true; returning...")
    return;
  }

  console.log("Executing play()");
  console.log("keepAliveOnly = " + config.keepAliveOnly);
  console.log("isPlaying = " + config.isPlaying);

  if (!config.token) {
    console.log("play(): Token doesn't exist.");
    return;
  }

  // If we don't have the ID of the device, get it
  if (!config.deviceId) {
    config.deviceId = await getDeviceId(config);
    console.log("Device ID: " + config.deviceId);
  }

  // Transfer playback to Pi and play!
  try {
    console.log("Now device id: " + config.deviceId);

    const response = await axios.put(
      'https://api.spotify.com/v1/me/player',
      {
        'device_ids': [config.deviceId],
        'play': config.keepAliveOnly ? false : true
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      }
    );

    // Set the isPlaying flag, as long as this wasn't a "keep-alive" call
    if (!config.keepAliveOnly) config.isPlaying = true;

  } catch (error) {
    console.error('Error starting/resuming playback', error.response ? error.response.data : error.message);
    //res.status(500).send('Failed to start/resume playback');
  }

}



async function pause(config) {

  console.log("Executing pause()");

  if (!config.token) {
    console.log("pause(): Token doesn't exist.");
    return;
  }

  // If we don't have the ID of the device, get it
  if (!config.deviceId) {
    await getDeviceId(config);
    console.log("Device ID: " + config.deviceId);
  }

  // Send pause request to Spotify
  try {
    const response = await axios.put(
      'https://api.spotify.com/v1/me/player/pause',
      {
        'device_id': config.deviceId,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      }
    );

    // Turn off isPlaying flag
    config.isPlaying = false;
  } catch (error) {
    console.error('Error pausing playback', error.response ? error.response.data : error.message);
  }

}


// Sets active device without playing - just to keep the device active
async function keepAlive(config) {

  console.log("Executing keepAlive()");

  // Don't attempt a keep-alive call if the device is already playing - that will pause it!
  if (config.isPlaying) {
    console.log("keepAlive(): isPlaying = true; returning...")
    return;
  }

  if (!config.token) {
    console.log("keepAlive(): Token doesn't exist.");
    return;
  }

  // If we don't have the ID of the device, get it
  if (!config.deviceId) {
    config.deviceId = await getDeviceId(config);
  }

  // Set device as active (but don't play)
  try {
    const response = await axios.put(
      'https://api.spotify.com/v1/me/player',
      {
        'device_ids': [config.deviceId],
        'play': false 
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      }
    );

  } catch (error) {
    console.error('Error sending "keep alive" message: ', error.response ? error.response.data : error.message);
  }

}


// Helper function used by functions w/in this file; gets deviceId from Spotify
async function getDeviceId(config) {

  if (!config.token) {
    console.log("Token doesn't exist.");
    authorize(res);
    return;
  }

  // Get list of devices from Spotify
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });

    console.log("Response:" + JSON.stringify(response.data));

    // Find the Pi/librespot device id and store in global deviceId
    for (const device of response.data.devices) {
      // If running on Windows
      if (config._WIN && device.name === config.winDeviceName) {
        console.log("Found device id: " + device.id);
        return device.id;
      }

      if (device.name === config.piDeviceName) {
        console.log("Found device id: " + device.id);
        return device.id;
      }
    }

    // Will only run if device not found
    console.log("Device not found.");
    config.deviceId = undefined;  // Reset the deviceId - it might be an old one
    return null;

  } catch (error) {
    console.error('Error getting playback state', error.response ? error.response.data : error.message);
  }

}


async function skip(config, numTracks = 1) {

  for (var i=0; i < numTracks; i++) {
    try {
      const response = await axios.post('https://api.spotify.com/v1/me/player/next', {}, {
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      });

      // Wait 100ms
      await sleep(100);
    } catch (error) {
      console.error('Error skipping tracks: ', error.response ? error.response.data : error.message);
    }
  }
}

module.exports = {
  getPlaylists,
  play,
  pause,
  skip, 
  keepAlive
}
//Get device list, and store the Pi device ID

