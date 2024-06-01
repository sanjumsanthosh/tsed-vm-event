# git pull changes
# bun run prod:restart

#!/bin/bash

echo "Pulling changes from git"
git pull

echo "Bun install"
bun i

echo "Restarting the server"
bun run prod:restart

echo "Changes updated and server restarted"