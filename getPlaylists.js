const axios = require('axios');

async function getPlaylists(token) {
    
    var playlists = [];

    // Get the profile from Spotify
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: {
            'Authorization': `Bearer ${token}`,
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

module.exports = getPlaylists;