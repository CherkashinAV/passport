FROM node:16

WORKDIR /src/app

COPY .nvmrc package.json package-lock.json Makefile ./

RUN npm ci

COPY . .

RUN make build
RUN npm prune --production

EXPOSE 8080
CMD ["node", "/out/app/app.js"]