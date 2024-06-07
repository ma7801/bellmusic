#!/bin/bash

# Source the user's profile to ensure the environment is correct
source /home/spotty/.profile

date >> startup.sh.log
echo "Starting bellmusic startup script..." >> startup.sh.log

# Open terminal and run librespot
echo "Opening terminal window and running librespot..." >> startup.sh.log
lxterminal -e 'bash -c "librespot -u \"ma7801\" -p \"A5AprzD1gWQ2yoXqDTsP\" --B \"pulseaudio\""' &

# Open terminal and run bellmusic server
echo "Opening terminal window and running bellmusic server..." >> startup.sh.log
lxterminal -e 'bash -c "node /home/spotty/bellmusic/server.js"' &

echo "Sleeping..." >> startup.sh.log
sleep 10

# Open Chromium
echo "Opening browser to main bellmusic page..." >> startup.sh.log
chromium-browser http://localhost:3125/main &
