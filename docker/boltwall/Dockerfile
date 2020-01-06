FROM node:12-alpine
LABEL maintainer="Boltbox team <buck@tierion.com>"

# add image dependencies
RUN apk add --no-cache bash git

# Copy this directory into the image
WORKDIR /boltwall

COPY package*.json ./
COPY yarn.lock ./

# Run npm install to add dependencies
RUN yarn
COPY . .


# Set default env vars
ARG BOLTWALL_PORT
ENV BOLTWALL_PORT ${BOLTWALL_PORT:-5000}

EXPOSE $BOLTWALL_PORT

# Set entrypoint to start the server at `/index.js`
RUN chmod +x ./index.js && chmod +x ./start-boltwall.sh

ENTRYPOINT ["./start-boltwall.sh"]

# set volume for configs (this should be mapped to a host directory)
VOLUME ["/configs"]
