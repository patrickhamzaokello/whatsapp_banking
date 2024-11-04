#!/bin/bash

echo "🔨 Rebuilding Docker image and container..."

# Stop any existing containers
docker-compose down

<<<<<<< HEAD
=======
# Remove dangling images
echo "🧹 Cleaning up dangling images..."
docker image prune -f

# Remove old versions of the specific image
echo "🧹 Removing old versions of pkasemer/gtbank-whatsapp-api..."
docker images pkasemer/gtbank-whatsapp-api -q | xargs -r docker rmi -f

>>>>>>> 09cea1d15d0e4d6166cf6c23d348f173f98d8820
# Build the image with no-cache to ensure fresh build
docker-compose build --no-cache

# Run the container in non-detached mode
<<<<<<< HEAD
docker-compose up
=======
docker-compose up -d
>>>>>>> 09cea1d15d0e4d6166cf6c23d348f173f98d8820
