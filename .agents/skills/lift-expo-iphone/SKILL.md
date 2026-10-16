---
name: lift-expo-iphone
description: Start (or restart) the Expo dev server so the owner can test LIFT in Expo Go on their iPhone, over Tailscale or the LAN.
---

# Expo dev server for the owner's iPhone

1. Is one already running? `ss -ltnp | grep :8081`. If so, kill **that PID**
   (never `pkill -f "expo start"`, which also kills your own shell).
2. The phone reaches the rig over Tailscale, so advertise the Tailscale address:
   ```bash
   TS_IP=$(tailscale ip -4 | head -1)
   cd ~/lift/lift-app && REACT_NATIVE_PACKAGER_HOSTNAME="$TS_IP" EXPO_NO_TELEMETRY=1 \
     nohup setsid npx expo start --lan --port 8081 > /tmp/expo.log 2>&1 &
   ```
   Use a background/long-running mode if your harness has one. Sandboxes cap
   these at about 2 h.
3. Check it: `curl -s localhost:8081/status` → `packager-status:running`, and
   `curl -s -H 'expo-platform: ios' localhost:8081 | grep -o 'http://[0-9.]*:8081' | head -1`
   must show the Tailscale address, not 192.168.x.
4. Tell the owner: open `exp://<that address>:8081` in Expo Go, with Tailscale on.
   **Don't write the real IP into the repo** (it's public); in docs, use `<tailscale-ip>`.

Expo Go only. No native iOS build on the Linux rig.
