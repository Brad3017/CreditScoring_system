# Place in: CreditScoringSystem/frontend/credit-scoring-frontend/Dockerfile   (next to package.json)

# ---- Stage 1: build the React app ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite bakes this value into the JavaScript at build time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Stage 2: serve the built files with nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
