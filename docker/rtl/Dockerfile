# Build rtl
# https://raw.githubusercontent.com/ShahanaFarooqui/RTL/v0.5.1/Dockerfile
FROM node:10-alpine as builder
LABEL maintainer="Boltbox team <buck@tierion.com>"

ARG RTL_VERSION=0.5.4

RUN apk add --no-cache git

RUN echo $RTL_VERSION
# clone rtl repo into RTL directory
RUN git clone https://github.com/ShahanaFarooqui/RTL.git RTL

WORKDIR /RTL

# checkout the working version of rtl we want to use
RUN git fetch && git checkout v$RTL_VERSION

# Install dependencies
RUN npm install

# Start a new, final image to reduce size.
FROM node:10-alpine as final
LABEL maintainer="Boltbox team <buck@tierion.com>"

RUN apk add --no-cache tini

# Get the built files from previous build step
COPY --from=builder /RTL /RTL

WORKDIR /RTL

EXPOSE 3000 5000

ENTRYPOINT ["/sbin/tini", "-g", "--"]

CMD ["node", "rtl"]