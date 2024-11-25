FROM node:16-alpine
WORKDIR /usr/src/app

# Copy package files and node_modules directly
COPY package*.json ./
COPY node_modules ./node_modules

# Copy the rest of the application
COPY . .

EXPOSE 3000
CMD ["node", "src/app.js"]