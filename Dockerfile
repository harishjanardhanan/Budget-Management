# Multi-stage build for production

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
# Set API URL for production build - use relative path so it works with any domain/IP
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Backend
FROM node:22-alpine
WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm install --only=production

# Copy backend code
COPY server/ ./

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./public

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]
