# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS dev
COPY . .
RUN npx nuxt prepare
EXPOSE 3000
CMD ["npx", "nuxt", "dev", "--host", "0.0.0.0"]

FROM deps AS build
ARG APP_VERSION=dev
COPY . .
RUN npm run build \
 && printf '{"version": "%s"}\n' "$APP_VERSION" > .output/public/version.json

FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/.output/public /usr/share/nginx/html
EXPOSE 8080
