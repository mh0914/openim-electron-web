FROM docker.m.daocloud.io/library/node:20-bullseye-slim AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY patches ./patches

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

FROM docker.m.daocloud.io/library/nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
