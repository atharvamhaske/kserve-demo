#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands sudo uname

[[ $(uname -s) == Linux ]] || fail 'bootstrap requires Linux'
[[ $(uname -m) == x86_64 ]] || fail 'bootstrap supports x86_64 only'

# shellcheck disable=SC1091
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || fail 'bootstrap requires Ubuntu 24.04 LTS'
require_commands apt-get

for variable_name in KUBECTL_VERSION MINIKUBE_VERSION HELM_VERSION GO_VERSION; do
  [[ -n ${!variable_name:-} ]] || fail "missing $variable_name in $CONFIG_FILE"
done

require_commands docker nvidia-smi
nvidia-smi >/dev/null 2>&1 || fail 'NVIDIA driver check failed; fix nvidia-smi before bootstrap'
docker info >/dev/null 2>&1 || fail 'Docker is unavailable to this user; install Docker and complete any required group re-login'

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates coreutils curl git jq openssl tar

require_commands cat curl jq readlink sha256sum stat tar tee

temporary_dir=$(mktemp -d)
go_staging_dir=
curl_options=(--fail --location --proto '=https' --proto-redir '=https' --retry 3)

cleanup() {
  rm -rf "$temporary_dir"
  [[ -z $go_staging_dir ]] || sudo rm -rf -- "$go_staging_dir"
}
trap cleanup EXIT

fetch_verified() {
  local url=$1
  local checksum_url=$2
  local destination=$3
  local checksum expected

  curl "${curl_options[@]}" --output "$destination" "$url"
  checksum=$(curl "${curl_options[@]}" "$checksum_url")
  read -r expected _ <<<"$checksum"
  [[ -n $expected ]] || fail "missing checksum for $url"
  printf '%s  %s\n' "$expected" "$destination" | sha256sum --check
}

require_absent_destination() {
  local destination=$1
  [[ ! -e $destination && ! -L $destination ]] ||
    fail "$destination already exists but is not an accepted pinned command"
}

validate_managed_command() {
  local command_name=$1
  local destination=/usr/local/bin/$command_name
  [[ $(command -v "$command_name" 2>/dev/null || true) == "$destination" ]] ||
    fail "$command_name is not managed at $destination"
  [[ -f $destination && ! -L $destination && -x $destination ]] ||
    fail "$destination is not a regular executable"
  [[ $(stat -c %u "$destination") == 0 && $(stat -c %a "$destination") == 755 ]] ||
    fail "$destination must be root-owned with mode 0755"
}

validate_go_tree() {
  local root=$1
  local marker=$root/.openeverest-workshop-version
  local binary
  [[ -d $root && ! -L $root ]] || fail "$root is not a managed Go directory"
  [[ $(stat -c %u "$root") == 0 && $(stat -c %a "$root") == 755 ]] ||
    fail "$root must be root-owned with mode 0755"
  [[ -f $marker && ! -L $marker ]] || fail "$root has no workshop version marker"
  [[ $(stat -c %u "$marker") == 0 && $(stat -c %a "$marker") == 644 ]] ||
    fail "$marker must be root-owned with mode 0644"
  [[ $(cat "$marker") == "$GO_VERSION" ]] || fail "$root contains another Go version"
  for binary in go gofmt; do
    [[ -f $root/bin/$binary && ! -L $root/bin/$binary && -x $root/bin/$binary ]] ||
      fail "$root/bin/$binary is not a regular executable"
    [[ $(stat -c %u "$root/bin/$binary") == 0 && $(stat -c %a "$root/bin/$binary") == 755 ]] ||
      fail "$root/bin/$binary must be root-owned with mode 0755"
  done
}

link_go_tools() {
  local command_name destination target
  for command_name in go gofmt; do
    destination=/usr/local/bin/$command_name
    target=/usr/local/go/bin/$command_name
    if [[ -L $destination ]]; then
      [[ $(readlink "$destination") == "$target" ]] ||
        fail "$destination points to an unmanaged target"
      continue
    fi
    [[ ! -e $destination ]] || fail "$destination already exists and is not a symbolic link"
    sudo ln -s "$target" "$destination"
  done
}

validate_go_link_destinations() {
  local command_name destination target
  for command_name in go gofmt; do
    destination=/usr/local/bin/$command_name
    target=/usr/local/go/bin/$command_name
    if [[ -L $destination ]]; then
      [[ $(readlink "$destination") == "$target" ]] ||
        fail "$destination points to an unmanaged target"
      continue
    fi
    [[ ! -e $destination ]] || fail "$destination already exists and is not a symbolic link"
  done
}

verify_managed_go_path() {
  local current
  hash -r
  [[ $(command -v go 2>/dev/null || true) == /usr/local/bin/go ]] ||
    fail 'PATH does not select /usr/local/bin/go'
  [[ $(command -v gofmt 2>/dev/null || true) == /usr/local/bin/gofmt ]] ||
    fail 'PATH does not select /usr/local/bin/gofmt'
  current=$(go env GOVERSION 2>/dev/null) || fail 'PATH-selected Go version probe failed'
  [[ $current == "go$GO_VERSION" ]] ||
    fail "PATH selects $current; use the pinned go$GO_VERSION"
}

install_kubectl() {
  local current
  if command -v kubectl >/dev/null 2>&1; then
    validate_managed_command kubectl
    current=$(kubectl version --client=true --output=json 2>/dev/null |
      jq -r '.clientVersion.gitVersion') || fail 'installed kubectl version probe failed'
    [[ $current == "$KUBECTL_VERSION" ]] ||
      fail "kubectl $current is installed; remove it or use the pinned $KUBECTL_VERSION"
    return
  fi

  require_absent_destination /usr/local/bin/kubectl
  fetch_verified \
    "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl" \
    "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl.sha256" \
    "$temporary_dir/kubectl"
  sudo install -o root -g root -m 0755 "$temporary_dir/kubectl" /usr/local/bin/kubectl
}

install_minikube() {
  local current
  if command -v minikube >/dev/null 2>&1; then
    validate_managed_command minikube
    current=$(minikube version --short 2>/dev/null) || fail 'installed Minikube version probe failed'
    [[ $current == "$MINIKUBE_VERSION" ]] ||
      fail "Minikube $current is installed; remove it or use the pinned $MINIKUBE_VERSION"
    return
  fi

  require_absent_destination /usr/local/bin/minikube
  fetch_verified \
    "https://github.com/kubernetes/minikube/releases/download/$MINIKUBE_VERSION/minikube-linux-amd64" \
    "https://github.com/kubernetes/minikube/releases/download/$MINIKUBE_VERSION/minikube-linux-amd64.sha256" \
    "$temporary_dir/minikube"
  sudo install -o root -g root -m 0755 "$temporary_dir/minikube" /usr/local/bin/minikube
}

install_helm() {
  local current archive
  if command -v helm >/dev/null 2>&1; then
    validate_managed_command helm
    current=$(helm version --short 2>/dev/null) || fail 'installed Helm version probe failed'
    current=${current%%+*}
    [[ $current == "$HELM_VERSION" ]] ||
      fail "Helm $current is installed; remove it or use the pinned $HELM_VERSION"
    return
  fi

  require_absent_destination /usr/local/bin/helm
  archive="helm-$HELM_VERSION-linux-amd64.tar.gz"
  fetch_verified \
    "https://get.helm.sh/$archive" \
    "https://get.helm.sh/$archive.sha256sum" \
    "$temporary_dir/$archive"
  tar -xzf "$temporary_dir/$archive" -C "$temporary_dir"
  sudo install -o root -g root -m 0755 "$temporary_dir/linux-amd64/helm" /usr/local/bin/helm
}

install_go() {
  local current archive expected

  [[ ! -L /usr/local/go ]] || fail '/usr/local/go is an unmanaged symbolic link'
  if [[ -e /usr/local/go ]]; then
    validate_go_tree /usr/local/go
    current=$(/usr/local/go/bin/go env GOVERSION) ||
      fail 'installed /usr/local/go version probe failed'
    [[ $current == "go$GO_VERSION" ]] ||
      fail "/usr/local/go contains $current; use the pinned go$GO_VERSION"
    link_go_tools
    verify_managed_go_path
    return
  fi

  command -v go >/dev/null 2>&1 &&
    fail 'Go is installed outside the managed /usr/local/go path'
  command -v gofmt >/dev/null 2>&1 &&
    fail 'gofmt is installed outside the managed /usr/local/go path'

  validate_go_link_destinations

  archive="go$GO_VERSION.linux-amd64.tar.gz"
  curl "${curl_options[@]}" --output "$temporary_dir/$archive" "https://go.dev/dl/$archive"
  expected=$(curl "${curl_options[@]}" 'https://go.dev/dl/?mode=json&include=all' |
    jq -r --arg archive "$archive" '.[] | .files[] | select(.filename == $archive) | .sha256')
  [[ -n $expected && $expected != null ]] || fail "missing checksum for $archive"
  printf '%s  %s\n' "$expected" "$temporary_dir/$archive" | sha256sum --check

  go_staging_dir=$(sudo mktemp -d "/usr/local/.go-$GO_VERSION.XXXXXX")
  sudo tar --no-same-owner -C "$go_staging_dir" \
    --strip-components=1 \
    -xzf "$temporary_dir/$archive"
  sudo chmod 0755 "$go_staging_dir"
  printf '%s\n' "$GO_VERSION" |
    sudo tee "$go_staging_dir/.openeverest-workshop-version" >/dev/null
  sudo chmod 0644 "$go_staging_dir/.openeverest-workshop-version"
  validate_go_tree "$go_staging_dir"
  [[ $("$go_staging_dir/bin/go" env GOVERSION) == "go$GO_VERSION" ]] ||
    fail "downloaded Go version does not match go$GO_VERSION"
  sudo mv "$go_staging_dir" /usr/local/go
  go_staging_dir=
  link_go_tools
  verify_managed_go_path
}

install_kubectl
install_minikube
install_helm
install_go
hash -r

printf 'Pinned workshop tools installed. Running the host preflight.\n'
"$WORKSHOP_DIR/scripts/00-preflight.sh"
