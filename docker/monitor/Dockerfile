# based on lightninglabs unpublished image
# https://github.com/lightninglabs/lndmon/blob/master/Dockerfile

FROM golang:1.13-alpine as lndmon-builder

# Install build dependencies such as git and glide.
RUN apk add --no-cache git gcc musl-dev

RUN apk add --no-cache --update alpine-sdk \
    git \
    make \
    bash \
    gcc

ENV GO111MODULE on

# git pull latest version of lndmon repo to build
RUN git clone https://github.com/lightninglabs/lndmon.git /go/src/github.com/lightninglabs/lndmon
RUN cd /go/src/github.com/lightninglabs/lndmon/cmd/lndmon && go build

FROM alpine as graf-dash
COPY ./set_default_graf_dash.sh /bin/

RUN apk --update add curl jq && chmod +x /bin/set_default_graf_dash.sh

# Start a new image for final build
FROM alpine:3.10 as final

LABEL maintainer="Boltbox team <buck@tierion.com>"

COPY --from=lndmon-builder /go/src/github.com/lightninglabs/lndmon/cmd/lndmon/lndmon /bin/

# get grafana data from lndmon builder
COPY --from=lndmon-builder /go/src/github.com/lightninglabs/lndmon/grafana/provisioning /grafana/

# Add bash, for quality of life and SSL-related reasons.
RUN apk --no-cache add \
    bash \
    busybox \
    iputils \
    && chmod +x /bin/lndmon

COPY start-lndmon.sh .
RUN chmod +x ./start-lndmon.sh

VOLUME ["/grafana"]