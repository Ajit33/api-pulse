FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p logs

# Add curl
RUN apk add --no-cache curl

EXPOSE 3002

CMD ["node", "src/server.js"]