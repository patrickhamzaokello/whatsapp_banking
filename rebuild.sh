#!/bin/bash

echo "🔨 Rebuilding Docker image and container..."

# Stop any existing containers
docker-compose down

# Build the image with no-cache to ensure fresh build
docker-compose build --no-cache

# Run the container in non-detached mode
docker-compose up
