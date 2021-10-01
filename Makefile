export DOCKER_IMAGE ?=matterlabs/faucet:2.0

image:
	@yarn tsc
	docker build . -t "${DOCKER_IMAGE}"

push-image: image
	docker push "${DOCKER_IMAGE}"
