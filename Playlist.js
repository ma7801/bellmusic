const fs = require('fs').promises;
const path = require('path');

class Playlist {
  constructor() {
    this.tracks = {}; // Object to store track IDs and their 'hasPlayed' status
  }

  async saveToFile(filePath = 'data') {
    try {
      const fullPath = path.join(__dirname, `${filePath}.json`);
      await fs.writeFile(fullPath, JSON.stringify(this.tracks, null, 2));
      console.log(`Data saved to ${filePath}.json`);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  async loadFromFile(filePath = 'data') {
    try {
      const fullPath = path.join(__dirname, `${filePath}.json`);
      const data = await fs.readFile(fullPath, 'utf8');
      this.tracks = JSON.parse(data);
      console.log(`Data loaded from ${filePath}.json`);
    } catch (error) {
      // Handle file not found error gracefully
      if (error.code === 'ENOENT') {
        console.log(`File ${filePath}.json not found. Initializing with empty data.`);
        this.tracks = {};
      } else {
        console.error('Error loading data:', error);
      }
    }
  }

  mergeTracks(newTracks) {
    for (const trackId in newTracks) {
      if (!this.tracks[trackId]) {
        this.tracks[trackId] = { hasPlayed: newTracks[trackId].hasPlayed };
      }
    }
  }
}

module.exports = Playlist;
