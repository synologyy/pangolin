all: update-versions go-build-release put-back

go-build-release:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/installer_linux_amd64
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o bin/installer_linux_arm64
clean:
	rm -f bin/installer_linux_amd64
	rm -f bin/installer_linux_arm64

update-versions:
	@echo "Fetching latest versions..."
	cp main.go main.go.bak && \
	PANGOLIN_VERSION=$$(curl -s https://api.github.com/repos/fosrl/pangolin/tags | jq -r '.[0].name') && \
	GERBIL_VERSION=$$(curl -s https://api.github.com/repos/fosrl/gerbil/tags | jq -r '.[0].name') && \
	BADGER_VERSION=$$(curl -s https://api.github.com/repos/fosrl/badger/tags | jq -r '.[0].name') && \
	echo "Latest versions - Pangolin: $$PANGOLIN_VERSION, Gerbil: $$GERBIL_VERSION, Badger: $$BADGER_VERSION" && \
	sed -i "s/config.PangolinVersion = \".*\"/config.PangolinVersion = \"$$PANGOLIN_VERSION\"/" main.go && \
	sed -i "s/config.GerbilVersion = \".*\"/config.GerbilVersion = \"$$GERBIL_VERSION\"/" main.go && \
	sed -i "s/config.BadgerVersion = \".*\"/config.BadgerVersion = \"$$BADGER_VERSION\"/" main.go && \
	echo "Updated main.go with latest versions"

put-back:
	mv main.go.bak main.go


	gui-build-release:
	GOOS=linux GOARCH=amd64 go build -o bin/gui_installer_linux_amd64 ./gui
	GOOS=windows GOARCH=amd64 go build -o bin/gui_installer_windows_amd64.exe ./gui
	GOOS=darwin GOARCH=amd64 go build -o bin/gui_installer_darwin_amd64 ./gui
	GOOS=darwin GOARCH=arm64 go build -o bin/gui_installer_darwin_arm64 ./gui
