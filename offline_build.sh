echo "🔨 Rebuilding Docker image and container (Offline Mode)..."

# Stop any existing containers
docker-compose down

# Remove dangling images (optional in offline mode)
echo "🧹 Cleaning up dangling images..."
docker image prune -f

# Remove old versions of the specific image
echo "🧹 Removing old versions of pkasemer/gtbank-whatsapp-api..."
docker images pkasemer/gtbank-whatsapp-api -q | xargs -r docker rmi -f

# Build the image with no network
echo "🏗️ Building Docker image in offline mode..."
DOCKER_BUILDKIT=1 docker-compose build --no-cache --network=none

# Create volume if it doesn't exist
docker volume create logs

# Run the container
echo "🚀 Starting container..."
docker-compose up -d