# Stage 1: Build the React+Vite app
FROM node:20-alpine as builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Accept build-time env vars (Railway injects these as Docker build args)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the app
COPY . .
RUN npm run build

# Stage 2: Serve the app with a simple server
FROM node:20-alpine

WORKDIR /app

# Install serve package to serve the static files
RUN npm install -g serve

# Copy built app from builder stage
COPY --from=builder /app/app-dist ./app-dist

# Expose port (Railway uses dynamic port from $PORT)
EXPOSE 3000

# Start the app (serve only needs port number)
CMD ["/bin/sh", "-c", "serve -s app-dist -l ${PORT:-3000}"]
