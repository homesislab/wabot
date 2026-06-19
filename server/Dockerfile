FROM node:20-slim

WORKDIR /app

# Install system dependencies (needed for Prisma, Baileys, and audio processing)
# Run as root for apt-get
RUN apt-get update && apt-get install -y openssl procps ffmpeg wget && rm -rf /var/lib/apt/lists/*

# Create app directory permission
RUN chown node:node /app

# Switch to non-root user
USER node

COPY --chown=node:node package.json package-lock.json ./

RUN npm install

COPY --chown=node:node . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3002

CMD ["npm", "start"]
