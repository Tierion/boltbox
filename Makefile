# First target in the Makefile is the default.
all: help

SHELL := /bin/bash

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Get home directory of current users
HOMEDIR := $(shell eval printf "~$$USER")
CORE_DATADIR := ${HOMEDIR}/.chainpoint/core

UID := $(shell id -u $$USER)
GID := $(shell id -g $$USER)

LISTCONTAINERS := $(shell eval docker ps -a -q)
LISTVOLUMES := $(shell eval docker volume ls -q)
.PHONY : help
help : Makefile
	@sed -n 's/^##//p' $<

## burn                 : Stop and remove all docker containers 
.PHONY : burn
burn:
	@docker stop ${LISTCONTAINERS} && sudo docker ps -a | grep Exit | cut -d ' ' -f 1 | xargs sudo docker rm && docker container prune && docker volume rm ${LISTVOLUMES}
	@echo ""
	@echo "****************************************************************************"
	@echo "Services stopped, and data pruned."
	@echo "****************************************************************************"

## simnet               : Spin up a simnet network
.PHONY : simnet
simnet:
	@cd ./simnet && node start-simnet.js