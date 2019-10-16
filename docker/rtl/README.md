# Ride the Lightning

Ride the Lightning (RTL) is a dashboard UI for interacting with a lightning node.
The image available in boltbox is just a simple deployment and build of the official github
repo with the flexibility to change the version if necessary.

## Configuration

RTL supports configurations via environment variables as well as config files. It also supports
multi-node dashboards through a configuration json. Sample configuration files are available for
reference in boltbox:

- sample-rtl.env (for the supported env vars)
- sample-rtl.conf (for supported config options for single node setup)
- sample-RTL-Multi-Node-Conf.json (sample config json for a 2 node, multi-node setup)

Editing these _will not_ have any effect on a container run with this image. They are only for reference.
The best approach would be to use these for reference and either pass in the appropriate
environment variables via a docker-compose.yml.

Running a container with multi-node support is a little trickier as you will need
to copy the json file into your running container and then restart it. You can see the simnet
script for an example (specifically `simnet/startDashboards.js`)

## Usage

To see an example implementation, please see the `rtl` service in the simnet directory's
`docker-compose.yml`.

Read more about RTL [at the project repo](https://github.com/ShahanaFarooqui/RTL).
