FROM golang:1.16-alpine as builder

ARG RELEASE_TAG=v0.14.1-beta-tierion

# Force Go to use the cgo based DNS resolver. This is required to ensure DNS
# queries required to connect to linked containers succeed.
ENV GODEBUG netdns=cgo

RUN apk add --no-cache --update alpine-sdk \
    ca-certificates \
    bash \
    git \
    make \
    libc-dev \
    gcc

RUN git clone https://github.com/tierion/lnd /go/src/github.com/lightningnetwork/lnd
RUN cd /go/src/github.com/lightningnetwork/lnd && git checkout $RELEASE_TAG
RUN cd /go/src/github.com/lightningnetwork/lnd && make
RUN cd /go/src/github.com/lightningnetwork/lnd && \
make install tags="dev autopilotrpc chainrpc invoicesrpc routerrpc signrpc signerrpc walletrpc watchtowerrpc monitoring"

# Start a new, final image to reduce size.
FROM builder as prod
LABEL maintainer="Boltbox team <buck@tierion.com>"

RUN cp /go/bin/lnd /bin/lnd
RUN cp /go/bin/lncli /bin/lncli

# Create and set permissions for lnd data directory
RUN mkdir -p /root/.lnd && chmod -R 777 /root && chmod -R 777 /root/.lnd

COPY start-lnd.sh .
COPY start-lncli.sh .
RUN chmod +x ./start-lnd.sh && chmod +x ./start-lncli.sh

ENTRYPOINT ["./start-lnd.sh"]
