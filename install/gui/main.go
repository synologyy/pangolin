package main

import (
	"fmt"
	"strconv"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
)

// Config mirrors the CLI installer configuration
type Config struct {
	PangolinVersion            string
	GerbilVersion              string
	BadgerVersion              string
	BaseDomain                 string
	DashboardDomain            string
	LetsEncryptEmail           string
	AdminUserEmail             string
	AdminUserPassword          string
	DisableSignupWithoutInvite bool
	DisableUserCreateOrg       bool
	EnableEmail                bool
	EmailSMTPHost              string
	EmailSMTPPort              int
	EmailSMTPUser              string
	EmailSMTPPass              string
	EmailNoReply               string
	InstallGerbil              bool
	TraefikBouncerKey          string
	DoCrowdsecInstall          bool
	Secret                     string
}

func main() {
	a := app.New()
	w := a.NewWindow("Pangolin Installer")

	baseDomain := widget.NewEntry()
	dashboardDomain := widget.NewEntry()
	letsEmail := widget.NewEntry()
	adminEmail := widget.NewEntry()
	adminPassword := widget.NewPasswordEntry()
	confirmPassword := widget.NewPasswordEntry()
	disableSignup := widget.NewCheck("", nil)
	disableUserCreate := widget.NewCheck("", nil)
	enableEmail := widget.NewCheck("", nil)
	smtpHost := widget.NewEntry()
	smtpPort := widget.NewEntry()
	smtpUser := widget.NewEntry()
	smtpPass := widget.NewPasswordEntry()
	smtpNoReply := widget.NewEntry()
	gerbilCheck := widget.NewCheck("", nil)
	crowdsecCheck := widget.NewCheck("", nil)

	form := &widget.Form{
		Items: []*widget.FormItem{
			widget.NewFormItem("Base Domain", baseDomain),
			widget.NewFormItem("Dashboard Domain", dashboardDomain),
			widget.NewFormItem("LetsEncrypt Email", letsEmail),
			widget.NewFormItem("Admin Email", adminEmail),
			widget.NewFormItem("Admin Password", adminPassword),
			widget.NewFormItem("Confirm Password", confirmPassword),
			widget.NewFormItem("Disable Signup Without Invite", disableSignup),
			widget.NewFormItem("Disable User Create Org", disableUserCreate),
			widget.NewFormItem("Enable Email", enableEmail),
			widget.NewFormItem("SMTP Host", smtpHost),
			widget.NewFormItem("SMTP Port", smtpPort),
			widget.NewFormItem("SMTP User", smtpUser),
			widget.NewFormItem("SMTP Password", smtpPass),
			widget.NewFormItem("No-Reply Email", smtpNoReply),
			widget.NewFormItem("Install Gerbil", gerbilCheck),
			widget.NewFormItem("Install CrowdSec", crowdsecCheck),
		},
		OnSubmit: func() {
			if adminPassword.Text != confirmPassword.Text {
				dialog.ShowError(fmt.Errorf("passwords do not match"), w)
				return
			}
			port, _ := strconv.Atoi(smtpPort.Text)
			cfg := Config{
				BaseDomain:                 baseDomain.Text,
				DashboardDomain:            dashboardDomain.Text,
				LetsEncryptEmail:           letsEmail.Text,
				AdminUserEmail:             adminEmail.Text,
				AdminUserPassword:          adminPassword.Text,
				DisableSignupWithoutInvite: disableSignup.Checked,
				DisableUserCreateOrg:       disableUserCreate.Checked,
				EnableEmail:                enableEmail.Checked,
				EmailSMTPHost:              smtpHost.Text,
				EmailSMTPPort:              port,
				EmailSMTPUser:              smtpUser.Text,
				EmailSMTPPass:              smtpPass.Text,
				EmailNoReply:               smtpNoReply.Text,
				InstallGerbil:              gerbilCheck.Checked,
				DoCrowdsecInstall:          crowdsecCheck.Checked,
			}

			loadVersions(&cfg)
			cfg.Secret = generateRandomSecretKey()
			if err := createConfigFiles(cfg); err != nil {
				dialog.ShowError(err, w)
				return
			}
			if err := moveFile("config/docker-compose.yml", "docker-compose.yml"); err != nil {
				dialog.ShowError(err, w)
				return
			}
			if err := pullContainers(); err != nil {
				dialog.ShowError(err, w)
				return
			}
			if err := startContainers(); err != nil {
				dialog.ShowError(err, w)
				return
			}
			dialog.ShowInformation("Success", "Installation complete", w)
		},
	}

	w.SetContent(container.NewVScroll(form))
	w.Resize(fyne.NewSize(500, 600))
	w.ShowAndRun()
}
