FROM node:12-alpine
LABEL maintainer="Boltbox team <buck@tierion.com>"

# add image dependencies
RUN apk add --no-cache bash git

# Copy this directory into the image
WORKDIR /accounting

RUN mkdir csv
RUN chmod -R 777 csv
COPY package*.json ./
COPY yarn.lock ./

# Run npm install to add dependencies
RUN yarn
COPY . .


# Set default env vars
ARG ACCOUNTING_PORT
ENV ACCOUNTING_PORT ${ACCOUNTING_PORT:-9000}

EXPOSE $ACCOUNTING_PORT

# Set entrypoint to start the server at `/index.js`
RUN chmod +x ./index.js && chmod +x ./start-accounting.sh

ENTRYPOINT ["./start-accounting.sh"]

# set volume for configs (this should be mapped to a host directory)
VOLUME ["/configs"]
