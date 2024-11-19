FROM node:16-alpine
WORKDIR /usr/src/app
COPY node_modules ./node_modules
COPY package*.json ./
RUN npm install
RUN apk add --no-cache curl
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
