# 🏃 GitLab Runner Installation & Operations Manual

This guide describes how to deploy, register, and configure a dedicated **GitLab Runner** (using the Docker Executor) on private virtual machines in AWS/Azure/GCP.

---

## 🏗️ 1. Installation on Linux VMs (Ubuntu/Debian)

Run the following commands on your private runner VM (e.g. the Azure VM provisioned in our terraform config) to install the Runner binary:

```bash
# 1. Download the official GitLab Runner repository script
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash

# 2. Install the runner package
sudo apt-get install gitlab-runner -y

# 3. Ensure Docker is installed (required for Docker Executor)
sudo apt-get install docker.io -y
sudo usermod -aG docker gitlab-runner
sudo systemctl restart docker
```

---

## 🔑 2. Registering the Runner with GitLab

To link the runner daemon to your GitLab repository, run the registration command:

### Non-Interactive Command Example:
```bash
sudo gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.com/" \
  --registration-token "GLRT-YOUR_REGISTRATION_TOKEN_HERE" \
  --executor "docker" \
  --docker-image "alpine:latest" \
  --description "Enterprise Multi-Cloud Private Runner" \
  --tag-list "docker,private,azure" \
  --run-untagged="false" \
  --locked="false" \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"
```

### Key Parameters:
*   `--executor "docker"`: Spawns clean isolated containers for each pipeline job, preventing build-history pollution.
*   `--tag-list "docker,private,azure"`: Tells GitLab to route jobs specifying these tags to this runner.
*   `--docker-volumes`: Binds the host machine's docker socket so that containerized jobs can build/push images (Docker-in-Docker or skopeo).

---

## ⚙️ 3. Managing the Daemon

Manage the runner process using standard systemd controls:
```bash
# Check status
sudo systemctl status gitlab-runner

# Restart service after changing config.toml
sudo systemctl restart gitlab-runner
```
