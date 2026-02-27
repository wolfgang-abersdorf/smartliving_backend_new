FROM node:18-alpine

# Install openssl to make Prisma work on Alpine 18+
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
