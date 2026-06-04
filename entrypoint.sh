#!/bin/sh

mkdir -p /data/championships

nginx &

node /app/proxy/server.js &

wait
