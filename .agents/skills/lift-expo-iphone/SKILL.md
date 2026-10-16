---
name: lift-expo-iphone
description: Start, restart or check the Expo dev server so the owner can test LIFT in Expo Go on their iPhone, over the home LAN or Tailscale.
---

# Expo dev server for the owner's iPhone

The server runs as a systemd **user service** (`lift-expo`). It starts at boot
(linger is on), restarts if it crashes, and listens on all interfaces. Do NOT
set `REACT_NATIVE_PACKAGER_HOSTNAME`: that forces one address, so a phone on the
other network gets a bundle URL it can't reach. Unset, Expo advertises whichever
address the phone connected on.

```bash
systemctl --user status lift-expo        # check
systemctl --user restart lift-expo       # restart (e.g. after a dependency change)
journalctl --user -u lift-expo -n 50     # logs
curl -s localhost:8081/status            # → packager-status:running
```

First-time install on a new rig:
`cp scripts/systemd/lift-expo.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now lift-expo`
(fix the `npx` path in the unit if it differs; run `loginctl enable-linger $USER` once).

Tell the owner to open in Expo Go:
- **Home Wi-Fi:** `exp://<lan-ip>:8081` (the rig's LAN address, `ip -4 addr`).
- **Away:** `exp://<tailscale-ip>:8081` (`tailscale ip -4`), with Tailscale on.

Don't write real IPs into the repo (it's public); use placeholders in docs.
Expo Go only. No native iOS build on the Linux rig.
