#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands cat grep kubectl nohup sleep

start_forward() {
  local name=$1
  local namespace=$2
  local service=$3
  local ports=$4
  local pid_file=$STATE_DIR/$name.pid
  local log_file=$STATE_DIR/$name.log

  if [[ -f $pid_file ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    printf '%s port-forward already runs with PID %s.\n' "$name" "$(cat "$pid_file")"
    return
  fi

  nohup kubectl --context "$PROFILE" -n "$namespace" \
    port-forward "svc/$service" "$ports" >"$log_file" 2>&1 &
  local forward_pid=$!
  printf '%s\n' "$forward_pid" >"$pid_file"

  local deadline=$((SECONDS + 10))
  until grep -Fq 'Forwarding from' "$log_file"; do
    kill -0 "$forward_pid" 2>/dev/null || fail "$name port-forward failed; see $log_file"
    if ((SECONDS >= deadline)); then
      kill "$forward_pid" 2>/dev/null || true
      fail "$name port-forward did not become ready; see $log_file"
    fi
    sleep 1
  done
}


start_forward everest "$EVEREST_NS" everest 8080:8080
start_forward grafana "$MONITORING_NS" observability-grafana 3000:80

printf 'OpenEverest: http://localhost:8080\n'
printf 'Grafana: http://localhost:3000\n'
