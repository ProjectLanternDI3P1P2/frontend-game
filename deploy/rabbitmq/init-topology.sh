#!/bin/sh
set -eu
# A post_start hook can run before the Erlang node exists. Bound the wait.
attempt=0
until rabbitmq-diagnostics -q --timeout 5 check_running >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "RabbitMQ did not become ready for topology import" >&2
    exit 1
  fi
  sleep 2
done

# Preserve broker-created users; the topology file contains no credentials.
rabbitmqctl import_definitions /etc/lantern-rabbitmq/definitions.json

# The import can complete asynchronously; do not release dependent APIs early.
attempt=0
while :; do
  queue_names=$(rabbitmqctl -q --timeout 5 list_queues name)
  all_ready=true
  for queue in player.events.v1 player.events.v1.dead rewards.events.v1 rewards.events.v1.dead rewards.chest-loot-publications.v1 progression.events.v1 progression.events.v1.dead; do
    if ! printf '%s\n' "$queue_names" | grep -Fxq "$queue"; then
      all_ready=false
    fi
  done
  if [ "$all_ready" = true ]; then
    break
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "RabbitMQ topology import did not finish" >&2
    exit 1
  fi
  sleep 2
done
touch /tmp/lantern-topology-ready
