<div align="center">
    <h2>
      <picture>
          <source media="(prefers-color-scheme: dark)" srcset="public/logo/word_mark_white.png">
          <img alt="Pangolin Logo" src="public/logo/word_mark_black.png" width="250">
        </picture>
    </h2>
</div>

<h4 align="center">Secure gateway to your private networks</h4>
<div align="center">

_Pangolin tunnels your services to the internet so you can access anything from anywhere._

</div>

<div align="center">
  <h5>
      <a href="https://digpangolin.com">
        Website
      </a>
      <span> | </span>
      <a href="https://docs.digpangolin.com/self-host/quick-install-managed">
        Quick Install Guide
      </a>
      <span> | </span>
      <a href="mailto:contact@fossorial.io">
        Contact Us
      </a>
  </h5>

[![Docker](https://img.shields.io/docker/pulls/fosrl/pangolin?style=flat-square)](https://hub.docker.com/r/fosrl/pangolin)
![Stars](https://img.shields.io/github/stars/fosrl/pangolin?style=flat-square)
[![Discord](https://img.shields.io/discord/1325658630518865980?logo=discord&style=flat-square)](https://discord.gg/HCJR8Xhme4)
[![Youtube](https://img.shields.io/badge/YouTube-red?logo=youtube&logoColor=white&style=flat-square)](https://www.youtube.com/@fossorial-app)

</div>

<p align="center">
    <strong>
        Start testing Pangolin at <a href="https://pangolin.fossorial.io/auth/signup">pangolin.fossorial.io</a>
    </strong>
</p>

Pangolin is a self-hosted tunneled reverse proxy server with identity and access control, designed to securely expose private resources on distributed networks. Acting as a central hub, it connects isolated networks — even those behind restrictive firewalls — through encrypted tunnels, enabling easy access to remote services without opening ports.

<img src="public/screenshots/hero.png" alt="Preview"/>

![gif](public/clip.gif)

## Key Features

### Reverse Proxy Through WireGuard Tunnel

- Expose private resources on your network **without opening ports** (firewall punching).
- Secure and easy to configure private connectivity via a custom **user space WireGuard client**, [Newt](https://github.com/fosrl/newt).
- Built-in support for any WireGuard client.
- Automated **SSL certificates** (https) via [LetsEncrypt](https://letsencrypt.org/).
- Support for HTTP/HTTPS and **raw TCP/UDP services**.
- Load balancing.
- Extend functionality with existing [Traefik](https://github.com/traefik/traefik) plugins, such as [CrowdSec](https://plugins.traefik.io/plugins/6335346ca4caa9ddeffda116/crowdsec-bouncer-traefik-plugin) and [Geoblock](https://github.com/PascalMinder/geoblock).
    - **Automatically install and configure Crowdsec via Pangolin's installer script.**
- Attach as many sites to the central server as you wish.

### Identity & Access Management

- Centralized authentication system using platform SSO. **Users will only have to manage one login.**
- **Define access control rules for IPs, IP ranges, and URL paths per resource.**
- TOTP with backup codes for two-factor authentication.
- Create organizations, each with multiple sites, users, and roles.
- **Role-based access control** to manage resource access permissions.
- Additional authentication options include:
    - Email whitelisting with **one-time passcodes.**
    - **Temporary, self-destructing share links.**
    - Resource specific pin codes.
    - Resource specific passwords.
    - Passkeys
- External identity provider (IdP) support with OAuth2/OIDC, such as Authentik, Keycloak, Okta, and others.
    - Auto-provision users and roles from your IdP.

<img src="public/auth-diagram1.png" alt="Auth and diagram"/>

## Use Cases

### Manage Access to Internal Apps

- Grant users access to your apps from anywhere using just a web browser. No client software required.

### Developers and DevOps

- Expose and test internal tools and dashboards like **Grafana**. Bring localhost or private IPs online for easy access.

### Secure API Gateway

- One application load balancer across multiple clouds and on-premises.

### IoT and Edge Devices

- Easily expose **IoT devices**, **edge servers**, or **Raspberry Pi** to the internet for field equipment monitoring.

<img src="public/screenshots/sites.png" alt="Sites"/>

## Deployment Options

### Fully Self Hosted

Host the full application on your own server or on the cloud with a VPS. Take a look at the [documentation](https://docs.digpangolin.com/self-host/quick-install) to get started.

> Many of our users have had a great experience with [RackNerd](https://my.racknerd.com/aff.php?aff=13788). Depending on promotions, you can get a [**VPS with 1 vCPU, 1GB RAM, and ~20GB SSD for just around $12/year**](https://my.racknerd.com/aff.php?aff=13788&pid=912). That's a great deal!

### Pangolin Cloud

Easy to use with simple [pay as you go pricing](https://digpangolin.com/pricing). [Check it out here](https://pangolin.fossorial.io/auth/signup). 

- Everything you get with self hosted Pangolin, but fully managed for you.

### Managed & High Availability

Managed control plane, your infrastructure

- We manage database and control plane.
- You self-host lightweight exit-node.
- Traffic flows through your infra.
- We coordinate failover between your nodes or to Cloud when things go bad.

Try it out using [Pangolin Cloud](https://pangolin.fossorial.io)

### Full Enterprise On-Premises

[Contact us](mailto:numbat@fossorial.io) for a full distributed and enterprise deployments on your infrastructure controlled by your team.

## Project Development / Roadmap

We want to hear your feature requests! Add them to the [discussion board](https://github.com/orgs/fosrl/discussions/categories/feature-requests).

## Licensing

Pangolin is dual licensed under the AGPL-3 and the Fossorial Commercial license. For inquiries about commercial licensing, please contact us at [numbat@fossorial.io](mailto:numbat@fossorial.io).

## Contributions

Looking for something to contribute? Take a look at issues marked with [help wanted](https://github.com/fosrl/pangolin/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22help%20wanted%22). Also take a look through the freature requests in Discussions - any are available and some are marked as a good first issue.

Please see [CONTRIBUTING](./CONTRIBUTING.md) in the repository for guidelines and best practices.

Please post bug reports and other functional issues in the [Issues](https://github.com/fosrl/pangolin/issues) section of the repository.
