# OpenClaw Compatibility Notes (OpenArm)

Date verified: 2026-02-16

This document captures the OpenClaw contracts OpenArm was implemented against.

## Protocol and transport

- Gateway protocol uses JSON frames (`req`, `res`, `event`) over WebSocket.
- Protocol version is `3`.
- Clients should handle `connect.challenge` and include device-signed connect payload.
- Clients persist gateway-issued `auth.deviceToken` and reuse it on reconnect when no explicit token is set.
- Connect payload includes:
  - `minProtocol`, `maxProtocol`
  - `client` metadata (`id`, `mode`, `platform`, `version`, `instanceId`)
  - `role`, `scopes`, `caps`, `commands`
  - `auth` (`token`/`password`)
  - `device` (`id`, `publicKey`, `signature`, `signedAt`, `nonce`)

## Node invocation path

- Gateway sends node invocations as event `node.invoke.request`.
- Node responds using method `node.invoke.result`.
- Node-originated async events use method `node.event`.
- `node.invoke` requests include:
  - `nodeId`
  - `command`
  - `params`
  - `timeoutMs`
  - `idempotencyKey`

## Node command surface

OpenArm implements OpenClaw-compatible commands:
- `system.run`
- `system.which`
- `system.execApprovals.get`
- `system.execApprovals.set`

OpenArm optional extensions:
- `openarm.file.read`
- `openarm.file.write`
- `openarm.file.list`
- `openarm.file.stat`

These extensions require OpenClaw gateway allowlisting (`gateway.nodes.allowCommands`).

## Operator/UI methods

OpenArm operator link uses:
- `chat.send`
- `chat.history`
- `node.list`
- `node.invoke`
- `device.pair.list`
- `device.pair.approve`
- `device.pair.reject`

and listens to:
- `chat` events
- `device.pair.requested`
- `device.pair.resolved`

## 4-digit Pair PIN flow

OpenArm now uses a one-time 4-digit Pair PIN for onboarding:
- Hub generates a short PIN with expiry.
- Arm redeems PIN via local-network Hub discovery (with manual Hub host fallback).
- On successful redemption, Arm receives Gateway details (`url`, `token`/`password`, optional `tlsFingerprint`) and saves them locally.

Security controls in the OpenArm flow:
- short expiry window
- one-time redemption
- local-network source checks
- invalid-attempt cap before PIN invalidation

## Source alignment in OpenArm

- Gateway client implementation:
  - `companion/src/lib/gateway-rpc-client.js`
- Device identity/signing:
  - `companion/src/lib/device-identity.js`
- Node invoke handlers and command execution:
  - `companion/src/lib/node-executor.js`
- Electron app orchestration and IPC:
  - `companion/src/main.js`
