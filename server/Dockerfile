

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p logs

EXPOSE 3002

CMD ["node", "src/server.js"]