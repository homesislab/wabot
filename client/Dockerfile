# Build Stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Pass Environment Variables during Build
ARG VITE_ADMIN_PHONE
ARG VITE_ADMIN_EMAIL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_ADMIN_PHONE=$VITE_ADMIN_PHONE
ENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Serve Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
