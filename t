docker buildx build --build-arg DATABASE=sqlite --platform linux/arm64,linux/amd64 -t fosrl/pangolin:latest --push .
docker buildx build --build-arg DATABASE=sqlite --platform linux/arm64,linux/amd64 -t fosrl/pangolin:1.9.0 --push .
docker buildx build --build-arg DATABASE=pg --platform linux/arm64,linux/amd64 -t fosrl/pangolin:postgresql-latest --push .
docker buildx build --build-arg DATABASE=pg --platform linux/arm64,linux/amd64 -t fosrl/pangolin:postgresql-1.9.0 --push .
