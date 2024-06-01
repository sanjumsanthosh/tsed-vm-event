# git pull changes
# bun run prod:restart

#!/bin/bash

echo "Pulling changes from git"
git pull

echo "Restarting the server"
npm run prod:restart

echo "Changes updated and server restarted"