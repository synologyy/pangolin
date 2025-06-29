package main

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"math/rand"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
	"text/template"
	"time"
)

//go:embed config/*
var configFiles embed.FS

// loadVersions sets default component versions. Values are replaced in CI.
func loadVersions(cfg *Config) {
	cfg.PangolinVersion = "replaceme"
	cfg.GerbilVersion = "replaceme"
	cfg.BadgerVersion = "replaceme"
}

func createConfigFiles(config Config) error {
	os.MkdirAll("config", 0755)
	os.MkdirAll("config/letsencrypt", 0755)
	os.MkdirAll("config/db", 0755)
	os.MkdirAll("config/logs", 0755)

	err := fs.WalkDir(configFiles, "config", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == "config" {
			return nil
		}
		if !config.DoCrowdsecInstall && strings.Contains(path, "crowdsec") {
			return nil
		}
		if config.DoCrowdsecInstall && !strings.Contains(path, "crowdsec") {
			return nil
		}
		if strings.Contains(path, ".DS_Store") {
			return nil
		}
		if d.IsDir() {
			if err := os.MkdirAll(path, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %v", path, err)
			}
			return nil
		}
		content, err := configFiles.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read %s: %v", path, err)
		}
		tmpl, err := template.New(d.Name()).Parse(string(content))
		if err != nil {
			return fmt.Errorf("failed to parse template %s: %v", path, err)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return fmt.Errorf("failed to create parent directory for %s: %v", path, err)
		}
		outFile, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("failed to create %s: %v", path, err)
		}
		defer outFile.Close()

		if err := tmpl.Execute(outFile, config); err != nil {
			return fmt.Errorf("failed to execute template %s: %v", path, err)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("error walking config files: %v", err)
	}
	return nil
}

func isDockerInstalled() bool {
	cmd := exec.Command("docker", "--version")
	return cmd.Run() == nil
}

func isUserInDockerGroup() bool {
	if runtime.GOOS == "darwin" {
		return true
	}
	if os.Geteuid() == 0 {
		return true
	}
	if dockerGroup, err := user.LookupGroup("docker"); err == nil {
		if currentUser, err := user.Current(); err == nil {
			if ids, err := currentUser.GroupIds(); err == nil {
				for _, id := range ids {
					if id == dockerGroup.Gid {
						return true
					}
				}
			}
		}
	}
	return false
}

func executeDockerComposeCommandWithArgs(args ...string) error {
	var cmd *exec.Cmd
	var useNewStyle bool

	if !isDockerInstalled() {
		return fmt.Errorf("docker is not installed")
	}

	checkCmd := exec.Command("docker", "compose", "version")
	if err := checkCmd.Run(); err == nil {
		useNewStyle = true
	} else {
		checkCmd = exec.Command("docker-compose", "version")
		if err := checkCmd.Run(); err == nil {
			useNewStyle = false
		} else {
			return fmt.Errorf("neither 'docker compose' nor 'docker-compose' command is available")
		}
	}

	if useNewStyle {
		cmd = exec.Command("docker", append([]string{"compose"}, args...)...)
	} else {
		cmd = exec.Command("docker-compose", args...)
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func pullContainers() error {
	fmt.Println("Pulling the container images...")
	if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "pull", "--policy", "always"); err != nil {
		return fmt.Errorf("failed to pull the containers: %v", err)
	}
	return nil
}

func startContainers() error {
	fmt.Println("Starting containers...")
	if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "up", "-d", "--force-recreate"); err != nil {
		return fmt.Errorf("failed to start containers: %v", err)
	}
	return nil
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

func moveFile(src, dst string) error {
	if err := copyFile(src, dst); err != nil {
		return err
	}
	return os.Remove(src)
}

func generateRandomSecretKey() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const length = 32
	seededRand := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b)
}
