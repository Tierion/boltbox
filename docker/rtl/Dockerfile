# Build rtl
# https://raw.githubusercontent.com/ShahanaFarooqui/RTL/v0.5.1/Dockerfile
DOCKERFILE="Dockerfile"
# https://raw.githubusercontent.com/ShahanaFarooqui/RTL/v0.5.1/Dockerfile.arm32v7
[[ "$(uname -m)" == "armv7l" ]] && DOCKERFILE="Dockerfile.arm32v7"
# https://raw.githubusercontent.com/ShahanaFarooqui/RTL/v0.5.1/Dockerfile.arm64v8
[[ "$(uname -m)" == "aarch64" ]] && DOCKERFILE="Dockerfile.arm64v8"
echo "Building shahanafarooqui/rtl:0.5.1"
git clone https://github.com/ShahanaFarooqui/RTL rtl
cd rtl
git checkout v0.5.1
cd "$(dirname $DOCKERFILE)"
docker build -f "$DOCKERFILE" -t "shahanafarooqui/rtl:0.5.1" .
cd - && cd ..