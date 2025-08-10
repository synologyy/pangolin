package main

import (
	"bufio"
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
	"strconv"
	"strings"
	"syscall"
	"text/template"
	"time"

	"golang.org/x/term"
)

// DO NOT EDIT THIS FUNCTION; IT MATCHED BY REGEX IN CICD
func loadVersions(config *Config) {
	config.PangolinVersion = "replaceme"
	config.GerbilVersion = "replaceme"
	config.BadgerVersion = "replaceme"
}

//go:embed config/*
var configFiles embed.FS

type Config struct {
	InstallationContainerType SupportedContainer
	PangolinVersion           string
	GerbilVersion             string
	BadgerVersion             string
	BaseDomain                string
	DashboardDomain           string
	LetsEncryptEmail          string
	EnableEmail               bool
	EmailSMTPHost             string
	EmailSMTPPort             int
	EmailSMTPUser             string
	EmailSMTPPass             string
	EmailNoReply              string
	InstallGerbil             bool
	TraefikBouncerKey         string
	DoCrowdsecInstall         bool
	Secret                    string
}

type SupportedContainer string

const (
	Docker SupportedContainer = "docker"
	Podman SupportedContainer = "podman"
)

func main() {

	// print a banner about prerequisites - opening port 80, 443, 51820, and 21820 on the VPS and firewall and pointing your domain to the VPS IP with a records. Docs are at http://localhost:3000/Getting%20Started/dns-networking

	fmt.Println("Welcome to the Pangolin installer!")
	fmt.Println("This installer will help you set up Pangolin on your server.")
	fmt.Println("")
	fmt.Println("Please make sure you have the following prerequisites:")
	fmt.Println("- Open TCP ports 80 and 443 and UDP ports 51820 and 21820 on your VPS and firewall.")
	fmt.Println("- Point your domain to the VPS IP with A records.")
	fmt.Println("")
	fmt.Println("http://docs.fossorial.io/Getting%20Started/dns-networking")
	fmt.Println("")
	fmt.Println("Lets get started!")
	fmt.Println("")

	reader := bufio.NewReader(os.Stdin)
	inputContainer := readString(reader, "Would you like to run Pangolin as Docker or Podman containers?", "docker")

	chosenContainer := Docker
	if strings.EqualFold(inputContainer, "docker") {
		chosenContainer = Docker
	} else if strings.EqualFold(inputContainer, "podman") {
		chosenContainer = Podman
	} else {
		fmt.Printf("Unrecognized container type: %s. Valid options are 'docker' or 'podman'.\n", inputContainer)
		os.Exit(1)
	}

	if chosenContainer == Podman {
		if !isPodmanInstalled() {
			fmt.Println("Podman or podman-compose is not installed. Please install both manually. Automated installation will be available in a later release.")
			os.Exit(1)
		}

		if err := exec.Command("bash", "-c", "cat /etc/sysctl.conf | grep 'net.ipv4.ip_unprivileged_port_start='").Run(); err != nil {
			fmt.Println("Would you like to configure ports >= 80 as unprivileged ports? This enables podman containers to listen on low-range ports.")
			fmt.Println("Pangolin will experience startup issues if this is not configured, because it needs to listen on port 80/443 by default.")
			approved := readBool(reader, "The installer is about to execute \"echo 'net.ipv4.ip_unprivileged_port_start=80' >> /etc/sysctl.conf && sysctl -p\". Approve?", true)
			if approved {
				if os.Geteuid() != 0 {
					fmt.Println("You need to run the installer as root for such a configuration.")
					os.Exit(1)
				}

				// Podman containers are not able to listen on privileged ports. The official recommendation is to
				// container low-range ports as unprivileged ports.
				// Linux only.

				if err := run("bash", "-c", "echo 'net.ipv4.ip_unprivileged_port_start=80' >> /etc/sysctl.conf && sysctl -p"); err != nil {
					fmt.Sprintf("failed to configure unprivileged ports: %v.\n", err)
					os.Exit(1)
				}
			} else {
				fmt.Println("You need to configure port forwarding or adjust the listening ports before running pangolin.")
			}
		} else {
			fmt.Println("Unprivileged ports have been configured.")
		}

	} else if chosenContainer == Docker {
		// check if docker is not installed and the user is root
		if !isDockerInstalled() {
			if os.Geteuid() != 0 {
				fmt.Println("Docker is not installed. Please install Docker manually or run this installer as root.")
				os.Exit(1)
			}
		}

		// check if the user is in the docker group (linux only)
		if !isUserInDockerGroup() {
			fmt.Println("You are not in the docker group.")
			fmt.Println("The installer will not be able to run docker commands without running it as root.")
			os.Exit(1)
		}
	} else {
		// This shouldn't happen unless there's a third container runtime.
		os.Exit(1)
	}

	var config Config
	config.InstallationContainerType = chosenContainer

	// check if there is already a config file
	if _, err := os.Stat("config/config.yml"); err != nil {
		config = collectUserInput(reader)

		loadVersions(&config)
		config.DoCrowdsecInstall = false
		config.Secret = generateRandomSecretKey()

		if err := createConfigFiles(config); err != nil {
			fmt.Printf("Error creating config files: %v\n", err)
			os.Exit(1)
		}

		moveFile("config/docker-compose.yml", "docker-compose.yml")

		if !isDockerInstalled() && runtime.GOOS == "linux" && chosenContainer == Docker {
			if readBool(reader, "Docker is not installed. Would you like to install it?", true) {
				installDocker()
				// try to start docker service but ignore errors
				if err := startDockerService(); err != nil {
					fmt.Println("Error starting Docker service:", err)
				} else {
					fmt.Println("Docker service started successfully!")
				}
				// wait 10 seconds for docker to start checking if docker is running every 2 seconds
				fmt.Println("Waiting for Docker to start...")
				for i := 0; i < 5; i++ {
					if isDockerRunning() {
						fmt.Println("Docker is running!")
						break
					}
					fmt.Println("Docker is not running yet, waiting...")
					time.Sleep(2 * time.Second)
				}
				if !isDockerRunning() {
					fmt.Println("Docker is still not running after 10 seconds. Please check the installation.")
					os.Exit(1)
				}
				fmt.Println("Docker installed successfully!")
			}
		}

		fmt.Println("\n=== Starting installation ===")

		if (isDockerInstalled() && chosenContainer == Docker) ||
			(isPodmanInstalled() && chosenContainer == Podman) {
			if readBool(reader, "Would you like to install and start the containers?", true) {
				if err := pullContainers(chosenContainer); err != nil {
					fmt.Println("Error: ", err)
					return
				}

				if err := startContainers(chosenContainer); err != nil {
					fmt.Println("Error: ", err)
					return
				}
			}
		}
	} else {
		fmt.Println("Looks like you already installed, so I am going to do the setup...")
	}

	if !checkIsCrowdsecInstalledInCompose() {
		fmt.Println("\n=== CrowdSec Install ===")
		// check if crowdsec is installed
		if readBool(reader, "Would you like to install CrowdSec?", false) {
			fmt.Println("This installer constitutes a minimal viable CrowdSec deployment. CrowdSec will add extra complexity to your Pangolin installation and may not work to the best of its abilities out of the box. Users are expected to implement configuration adjustments on their own to achieve the best security posture. Consult the CrowdSec documentation for detailed configuration instructions.")

			// BUG: crowdsec installation will be skipped if the user chooses to install on the first installation.
			if readBool(reader, "Are you willing to manage CrowdSec?", false) {
				if config.DashboardDomain == "" {
					traefikConfig, err := ReadTraefikConfig("config/traefik/traefik_config.yml", "config/traefik/dynamic_config.yml")
					if err != nil {
						fmt.Printf("Error reading config: %v\n", err)
						return
					}
					config.DashboardDomain = traefikConfig.DashboardDomain
					config.LetsEncryptEmail = traefikConfig.LetsEncryptEmail
					config.BadgerVersion = traefikConfig.BadgerVersion

					// print the values and check if they are right
					fmt.Println("Detected values:")
					fmt.Printf("Dashboard Domain: %s\n", config.DashboardDomain)
					fmt.Printf("Let's Encrypt Email: %s\n", config.LetsEncryptEmail)
					fmt.Printf("Badger Version: %s\n", config.BadgerVersion)

					if !readBool(reader, "Are these values correct?", true) {
						config = collectUserInput(reader)
					}
				}

				config.DoCrowdsecInstall = true
				installCrowdsec(config)
			}
		}
	}

	fmt.Println("Installation complete!")
	fmt.Printf("\nTo complete the initial setup, please visit:\nhttps://%s/auth/initial-setup\n", config.DashboardDomain)
}

func readString(reader *bufio.Reader, prompt string, defaultValue string) string {
	if defaultValue != "" {
		fmt.Printf("%s (default: %s): ", prompt, defaultValue)
	} else {
		fmt.Print(prompt + ": ")
	}
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)
	if input == "" {
		return defaultValue
	}
	return input
}

func readPassword(prompt string, reader *bufio.Reader) string {
	if term.IsTerminal(int(syscall.Stdin)) {
		fmt.Print(prompt + ": ")
		// Read password without echo if we're in a terminal
		password, err := term.ReadPassword(int(syscall.Stdin))
		fmt.Println() // Add a newline since ReadPassword doesn't add one
		if err != nil {
			return ""
		}
		input := strings.TrimSpace(string(password))
		if input == "" {
			return readPassword(prompt, reader)
		}
		return input
	} else {
		// Fallback to reading from stdin if not in a terminal
		return readString(reader, prompt, "")
	}
}

func readBool(reader *bufio.Reader, prompt string, defaultValue bool) bool {
	defaultStr := "no"
	if defaultValue {
		defaultStr = "yes"
	}
	input := readString(reader, prompt+" (yes/no)", defaultStr)
	return strings.ToLower(input) == "yes"
}

func readInt(reader *bufio.Reader, prompt string, defaultValue int) int {
	input := readString(reader, prompt, fmt.Sprintf("%d", defaultValue))
	if input == "" {
		return defaultValue
	}
	value := defaultValue
	fmt.Sscanf(input, "%d", &value)
	return value
}

func collectUserInput(reader *bufio.Reader) Config {
	config := Config{}

	// Basic configuration
	fmt.Println("\n=== Basic Configuration ===")
	config.BaseDomain = readString(reader, "Enter your base domain (no subdomain e.g. example.com)", "")
	config.DashboardDomain = readString(reader, "Enter the domain for the Pangolin dashboard", "pangolin."+config.BaseDomain)
	config.LetsEncryptEmail = readString(reader, "Enter email for Let's Encrypt certificates", "")
	config.InstallGerbil = readBool(reader, "Do you want to use Gerbil to allow tunneled connections", true)

	// Email configuration
	fmt.Println("\n=== Email Configuration ===")
	config.EnableEmail = readBool(reader, "Enable email functionality (SMTP)", false)

	if config.EnableEmail {
		config.EmailSMTPHost = readString(reader, "Enter SMTP host", "")
		config.EmailSMTPPort = readInt(reader, "Enter SMTP port (default 587)", 587)
		config.EmailSMTPUser = readString(reader, "Enter SMTP username", "")
		config.EmailSMTPPass = readString(reader, "Enter SMTP password", "") // Should this be readPassword?
		config.EmailNoReply = readString(reader, "Enter no-reply email address", "")
	}

	// Validate required fields
	if config.BaseDomain == "" {
		fmt.Println("Error: Domain name is required")
		os.Exit(1)
	}
	if config.DashboardDomain == "" {
		fmt.Println("Error: Dashboard Domain name is required")
		os.Exit(1)
	}
	if config.LetsEncryptEmail == "" {
		fmt.Println("Error: Let's Encrypt email is required")
		os.Exit(1)
	}

	return config
}

func createConfigFiles(config Config) error {
	os.MkdirAll("config", 0755)
	os.MkdirAll("config/letsencrypt", 0755)
	os.MkdirAll("config/db", 0755)
	os.MkdirAll("config/logs", 0755)

	// Walk through all embedded files
	err := fs.WalkDir(configFiles, "config", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip the root fs directory itself
		if path == "config" {
			return nil
		}

		if !config.DoCrowdsecInstall && strings.Contains(path, "crowdsec") {
			return nil
		}

		if config.DoCrowdsecInstall && !strings.Contains(path, "crowdsec") {
			return nil
		}

		// skip .DS_Store
		if strings.Contains(path, ".DS_Store") {
			return nil
		}

		if d.IsDir() {
			// Create directory
			if err := os.MkdirAll(path, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %v", path, err)
			}
			return nil
		}

		// Read the template file
		content, err := configFiles.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read %s: %v", path, err)
		}

		// Parse template
		tmpl, err := template.New(d.Name()).Parse(string(content))
		if err != nil {
			return fmt.Errorf("failed to parse template %s: %v", path, err)
		}

		// Ensure parent directory exists
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return fmt.Errorf("failed to create parent directory for %s: %v", path, err)
		}

		// Create output file
		outFile, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("failed to create %s: %v", path, err)
		}
		defer outFile.Close()

		// Execute template
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

func installDocker() error {
	// Detect Linux distribution
	cmd := exec.Command("cat", "/etc/os-release")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to detect Linux distribution: %v", err)
	}
	osRelease := string(output)

	// Detect system architecture
	archCmd := exec.Command("uname", "-m")
	archOutput, err := archCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to detect system architecture: %v", err)
	}
	arch := strings.TrimSpace(string(archOutput))

	// Map architecture to Docker's architecture naming
	var dockerArch string
	switch arch {
	case "x86_64":
		dockerArch = "amd64"
	case "aarch64":
		dockerArch = "arm64"
	default:
		return fmt.Errorf("unsupported architecture: %s", arch)
	}

	var installCmd *exec.Cmd
	switch {
	case strings.Contains(osRelease, "ID=ubuntu"):
		installCmd = exec.Command("bash", "-c", fmt.Sprintf(`
			apt-get update &&
			apt-get install -y apt-transport-https ca-certificates curl software-properties-common &&
			curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg &&
			echo "deb [arch=%s signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list &&
			apt-get update &&
			apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
		`, dockerArch))
	case strings.Contains(osRelease, "ID=debian"):
		installCmd = exec.Command("bash", "-c", fmt.Sprintf(`
			apt-get update &&
			apt-get install -y apt-transport-https ca-certificates curl software-properties-common &&
			curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg &&
			echo "deb [arch=%s signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list &&
			apt-get update &&
			apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
		`, dockerArch))
	case strings.Contains(osRelease, "ID=fedora"):
		// Detect Fedora version to handle DNF 5 changes
		versionCmd := exec.Command("bash", "-c", "grep VERSION_ID /etc/os-release | cut -d'=' -f2 | tr -d '\"'")
		versionOutput, err := versionCmd.Output()
		var fedoraVersion int
		if err == nil {
			if v, parseErr := strconv.Atoi(strings.TrimSpace(string(versionOutput))); parseErr == nil {
				fedoraVersion = v
			}
		}

		// Use appropriate DNF syntax based on version
		var repoCmd string
		if fedoraVersion >= 41 {
			// DNF 5 syntax for Fedora 41+
			repoCmd = "dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo"
		} else {
			// DNF 4 syntax for Fedora < 41
			repoCmd = "dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo"
		}

		installCmd = exec.Command("bash", "-c", fmt.Sprintf(`
			dnf -y install dnf-plugins-core &&
			%s &&
			dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
		`, repoCmd))
	case strings.Contains(osRelease, "ID=opensuse") || strings.Contains(osRelease, "ID=\"opensuse-"):
		installCmd = exec.Command("bash", "-c", `
			zypper install -y docker docker-compose &&
			systemctl enable docker
		`)
	case strings.Contains(osRelease, "ID=rhel") || strings.Contains(osRelease, "ID=\"rhel"):
		installCmd = exec.Command("bash", "-c", `
			dnf remove -y runc &&
			dnf -y install yum-utils &&
			dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo &&
			dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin &&
			systemctl enable docker
		`)
	case strings.Contains(osRelease, "ID=amzn"):
		installCmd = exec.Command("bash", "-c", `
			yum update -y &&
			yum install -y docker &&
			systemctl enable docker &&
			usermod -a -G docker ec2-user
		`)
	default:
		return fmt.Errorf("unsupported Linux distribution")
	}

	installCmd.Stdout = os.Stdout
	installCmd.Stderr = os.Stderr
	return installCmd.Run()
}

func startDockerService() error {
	if runtime.GOOS == "linux" {
		cmd := exec.Command("systemctl", "enable", "--now", "docker")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		return cmd.Run()
	} else if runtime.GOOS == "darwin" {
		// On macOS, Docker is usually started via the Docker Desktop application
		fmt.Println("Please start Docker Desktop manually on macOS.")
		return nil
	}
	return fmt.Errorf("unsupported operating system for starting Docker service")
}

func isDockerInstalled() bool {
	return isContainerInstalled("docker")
}

func isPodmanInstalled() bool {
	return isContainerInstalled("podman") && isContainerInstalled("podman-compose")
}

func isContainerInstalled(container string) bool {
	cmd := exec.Command(container, "--version")
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

func isUserInDockerGroup() bool {
	if runtime.GOOS == "darwin" {
		// Docker group is not applicable on macOS
		// So we assume that the user can run Docker commands
		return true
	}

	if os.Geteuid() == 0 {
		return true // Root user can run Docker commands anyway
	}

	// Check if the current user is in the docker group
	if dockerGroup, err := user.LookupGroup("docker"); err == nil {
		if currentUser, err := user.Current(); err == nil {
			if currentUserGroupIds, err := currentUser.GroupIds(); err == nil {
				for _, groupId := range currentUserGroupIds {
					if groupId == dockerGroup.Gid {
						return true
					}
				}
			}
		}
	}

	// Eventually, if any of the checks fail, we assume the user cannot run Docker commands
	return false
}

// isDockerRunning checks if the Docker daemon is running by using the `docker info` command.
func isDockerRunning() bool {
	cmd := exec.Command("docker", "info")
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

// executeDockerComposeCommandWithArgs executes the appropriate docker command with arguments supplied
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

// pullContainers pulls the containers using the appropriate command.
func pullContainers(containerType SupportedContainer) error {
	fmt.Println("Pulling the container images...")
	if containerType == Podman {
		if err := run("podman-compose", "-f", "docker-compose.yml", "pull"); err != nil {
			return fmt.Errorf("failed to pull the containers: %v", err)
		}

		return nil
	}

	if containerType == Docker {
		if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "pull", "--policy", "always"); err != nil {
			return fmt.Errorf("failed to pull the containers: %v", err)
		}

		return nil
	}

	return fmt.Errorf("Unsupported container type: %s", containerType)
}

// startContainers starts the containers using the appropriate command.
func startContainers(containerType SupportedContainer) error {
	fmt.Println("Starting containers...")

	if containerType == Podman {
		if err := run("podman-compose", "-f", "docker-compose.yml", "up", "-d", "--force-recreate"); err != nil {
			return fmt.Errorf("failed start containers: %v", err)
		}

		return nil
	}

	if containerType == Docker {
		if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "up", "-d", "--force-recreate"); err != nil {
			return fmt.Errorf("failed to start containers: %v", err)
		}

		return nil
	}

	return fmt.Errorf("Unsupported container type: %s", containerType)
}

// stopContainers stops the containers using the appropriate command.
func stopContainers(containerType SupportedContainer) error {
	fmt.Println("Stopping containers...")
	if containerType == Podman {
		if err := run("podman-compose", "-f", "docker-compose.yml", "down"); err != nil {
			return fmt.Errorf("failed to stop containers: %v", err)
		}

		return nil
	}

	if containerType == Docker {
		if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "down"); err != nil {
			return fmt.Errorf("failed to stop containers: %v", err)
		}

		return nil
	}

	return fmt.Errorf("Unsupported container type: %s", containerType)
}

// restartContainer restarts a specific container using the appropriate command.
func restartContainer(container string, containerType SupportedContainer) error {
	fmt.Println("Restarting containers...")
	if containerType == Podman {
		if err := run("podman-compose", "-f", "docker-compose.yml", "restart"); err != nil {
			return fmt.Errorf("failed to stop the container \"%s\": %v", container, err)
		}

		return nil
	}

	if containerType == Docker {
		if err := executeDockerComposeCommandWithArgs("-f", "docker-compose.yml", "restart", container); err != nil {
			return fmt.Errorf("failed to stop the container \"%s\": %v", container, err)
		}

		return nil
	}

	return fmt.Errorf("Unsupported container type: %s", containerType)
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

func waitForContainer(containerName string, containerType SupportedContainer) error {
	maxAttempts := 30
	retryInterval := time.Second * 2

	for attempt := 0; attempt < maxAttempts; attempt++ {
		// Check if container is running
		cmd := exec.Command(string(containerType), "container", "inspect", "-f", "{{.State.Running}}", containerName)
		var out bytes.Buffer
		cmd.Stdout = &out

		if err := cmd.Run(); err != nil {
			// If the container doesn't exist or there's another error, wait and retry
			time.Sleep(retryInterval)
			continue
		}

		isRunning := strings.TrimSpace(out.String()) == "true"
		if isRunning {
			return nil
		}

		// Container exists but isn't running yet, wait and retry
		time.Sleep(retryInterval)
	}

	return fmt.Errorf("container %s did not start within %v seconds", containerName, maxAttempts*int(retryInterval.Seconds()))
}

func generateRandomSecretKey() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const length = 32

	var seededRand *rand.Rand = rand.New(
		rand.NewSource(time.Now().UnixNano()))

	b := make([]byte, length)
	for i := range b {
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b)
}

// Run external commands with stdio/stderr attached.
func run(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
