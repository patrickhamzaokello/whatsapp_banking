#!/bin/bash

echo "🔨 Rebuilding Docker image and container..."

# Stop any existing containers
docker-compose down

# Remove dangling images
echo "🧹 Cleaning up dangling images..."
docker image prune -f

# Remove old versions of the specific image
echo "🧹 Removing old versions of pkasemer/gtbank-whatsapp-api..."
docker images pkasemer/gtbank-whatsapp-api -q | xargs -r docker rmi -f

# Build the image with no-cache to ensure fresh build
docker-compose build --no-cache

docker volume create logs

# Run the container in non-detached mode
docker-compose up 
