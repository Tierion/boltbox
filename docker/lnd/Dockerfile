FROM golang:1.13-alpine as builder

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
RUN cd /go/src/github.com/lightningnetwork/lnd && git checkout rpc-additions
RUN cd /go/src/github.com/lightningnetwork/lnd && make
RUN cd /go/src/github.com/lightningnetwork/lnd && \
make install tags="dev autopilotrpc chainrpc invoicesrpc routerrpc signrpc signerrpc walletrpc watchtowerrpc monitoring"

# Start a new, final image to reduce size.
FROM builder as prod
LABEL maintainer="Boltbox team <buck@tierion.com>"

RUN cp /go/bin/lnd /bin/lnd
RUN cp /go/bin/lncli /bin/lncli

# Create and set permissions for lnd data directory
# we're using a custom directory rather than /root/.lnd since when we run parallel nodes on the same host,
# e.g. for simnet testing, we can add in sub directories, like `/lnd-data/alice`. Putting it in a wholly 
# new directory can help avoid any conflicts and identify any missed settings
RUN mkdir -p /lnd-data && chmod -R 777 /lnd-data

COPY start-lnd.sh .
COPY start-lncli.sh .
RUN chmod +x ./start-lnd.sh && chmod +x ./start-lncli.sh
