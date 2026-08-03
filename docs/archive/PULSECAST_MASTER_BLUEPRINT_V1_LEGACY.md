Here is the unified master blueprint for the system.

# PULSECAST STUDIO

## Master Product, Engineering and Development Blueprint

**Project type:** Desktop live-production, recording and multistreaming platform
**Primary platform:** Windows
**Core positioning:** A creator-first alternative to OBS that combines broadcasting, multistreaming, professional audio, animated graphics, gifts, captions, replay and content creation in one recoverable system.

---

# 1. PRODUCT VISION

PulseCast Studio is a complete live-production environment for creators who currently rely on OBS, audio-routing utilities, browser overlays, alert services, multistreaming platforms, captioning software and separate clip editors.

The application should let a creator:

1. Connect cameras, microphones, displays, games and browser content.
2. Arrange those sources visually.
3. Route audio without virtual-cable confusion.
4. Stream to Twitch, Facebook, YouTube and custom destinations.
5. Receive chat, subscriptions, Bits, Stars, Super Chats and other support events.
6. Trigger animated graphics and production actions from those events.
7. Record isolated audio and video sources.
8. Save instant replays.
9. turn livestream moments into social clips.
10. Recover safely from crashes, bad plugins and configuration errors.

PulseCast should not be presented as “OBS with a different interface.”

It should be positioned as:

> **A unified creator-production system built for streaming, recording and turning live broadcasts into reusable content.**

---

# 2. PRODUCT PRINCIPLES

## 2.1 Creator-first workflow

Features should be described through creator outcomes rather than broadcast-engineering terminology.

Instead of:

* Output module
* Auxiliary bus
* Scene collection
* Browser source properties
* Advanced audio properties

Use:

* Where should this stream go?
* What should the audience hear?
* What should you hear?
* What should be recorded?
* When should this graphic appear?
* Which platforms should see this alert?

Advanced terminology can still exist inside expert mode.

## 2.2 One project contains the whole production

OBS separates some project information across profiles and scene collections. PulseCast should use one self-contained **Show** project.

A Show contains:

* Scenes and rundown
* Source configuration
* Audio routing
* Stream destinations
* Graphics
* Gift rules
* Chat configuration
* Hotkeys
* Recording settings
* Replay settings
* Captions
* Automations
* Plugin requirements
* Recovery snapshots

## 2.3 Visual controls before configuration dialogs

Creators should manipulate elements directly whenever possible.

Examples:

* Drag a camera to reposition it.
* Drag a microphone onto the Program bus.
* Drag an alert onto the Facebook output.
* Resize a caption area on the canvas.
* Draw the region to capture.
* Drag a transition between rundown items.

## 2.4 Safe by default

PulseCast should prevent common production failures:

* Starting without microphone audio
* Recording to a nearly full drive
* Streaming with the wrong resolution
* Duplicated audio
* Monitoring feedback loops
* Missing browser assets
* Expired platform credentials
* Unsupported encoder settings
* Plugin crashes
* Accidental exposure of private windows
* Muted or disconnected capture devices

## 2.5 Modular but unified

PulseCast should combine your systems without making them inseparable.

* **Pulse Core:** motion, overlays, transitions and masks
* **OURconsole:** audio routing, DSP, monitoring and recording
* **Atlas Studio:** captions, transcription, clip editing and timeline content
* **Zoro:** diagnosis and guided setup
* **Dex:** verification, auditing and recovery
* **PCF/PIF concepts:** structured performance and interaction metadata

Each module should expose a stable internal API.

---

# 3. TARGET USERS

## 3.1 Primary users

* Gaming streamers
* Music artists
* Podcasters
* Interview hosts
* Reaction creators
* Educators
* Churches and community organizations
* Small event broadcasters
* Faceless content creators
* Artists who need animated branded presentations

## 3.2 Secondary users

* Esports teams
* Independent media companies
* Radio and podcast networks
* Music studios
* Small venues
* Social media managers
* Agencies managing several creators

## 3.3 User modes

### Simple Mode

For users who want to start quickly.

Includes:

* Guided setup
* Simplified audio
* Template layouts
* Recommended encoding
* One-click platform connections
* Limited advanced controls

### Creator Mode

The default production environment.

Includes:

* Full canvas editor
* Multistreaming
* Gifts and alerts
* Replay
* Captions
* Per-platform layouts
* Audio processing
* Content clipping

### Engineer Mode

For advanced users.

Includes:

* Detailed routing matrices
* Encoder controls
* Sync offsets
* Color spaces
* Network diagnostics
* Plugin hosting
* Custom protocol outputs
* Scripting and automation APIs

---

# 4. CORE PRODUCT MODEL

## 4.1 Show

The Show is the top-level project.

```text
Show
├── Production Rundown
├── Scenes
├── Sources
├── Audio Console
├── Output Canvases
├── Destinations
├── Graphics
├── Support Events
├── Chat
├── Captions
├── Replay
├── Recording
├── Automations
├── Assets
├── Plugins
└── Recovery History
```

## 4.2 Rundown

A rundown is an ordered production sequence.

Example:

```text
01  Pre-show countdown
02  Animated introduction
03  Host camera
04  Gameplay
05  Reaction layout
06  Guest interview
07  Supporter thank-you
08  Closing
09  Post-show screen
```

Each rundown item may specify:

* Scene
* Duration
* Transition
* Audio snapshot
* Graphic state
* Destination visibility
* Notes
* Auto-advance behavior
* Trigger conditions
* Hotkey
* MIDI command
* Stream Deck action

## 4.3 Scene

A Scene is a visual and audio state used inside the rundown.

Scenes can inherit from another scene.

Example:

```text
Base Gameplay Scene
├── Twitch Gameplay
├── Facebook Gameplay
└── YouTube Gameplay
```

Changing the base camera may update every child while platform-specific positioning remains intact.

## 4.4 Source

Supported initial source types:

* Display
* Window
* Application
* Game
* Camera
* Capture card
* Image
* Video
* Audio file
* Microphone
* Browser
* Text
* Shape
* Color
* Clock
* Chat
* Alert
* Caption
* Media playlist
* Phone camera
* Network stream
* Pulse graphic
* Atlas composition

Later source types:

* NDI
* SRT
* WebRTC guest
* IP camera
* Remote desktop
* 3D source
* Virtual production scene
* PCF performance source

---

# 5. USER INTERFACE

## 5.1 Main workspace

```text
┌─────────────────────────────────────────────────────────────┐
│ Show | Edit | View | Production | Tools | Help             │
├──────────────┬─────────────────────────────┬────────────────┤
│ Rundown      │                             │ Inspector      │
│              │        Live Canvas          │                │
│ 01 Intro     │                             │ Position       │
│ 02 Host      │                             │ Crop           │
│ 03 Game      │                             │ Effects        │
│ 04 Break     │                             │ Animation      │
│              │                             │ Visibility     │
├──────────────┴─────────────────────────────┴────────────────┤
│ Audio Console                                                │
├──────────────────────────────────────────────────────────────┤
│ Stream Health | Record | Replay | Destinations | GO LIVE    │
└──────────────────────────────────────────────────────────────┘
```

## 5.2 Workspaces

Users can switch among:

* Production
* Audio
* Graphics
* Multistream
* Gifts and Alerts
* Replay and Clips
* Captions
* Assets
* Diagnostics
* Settings

## 5.3 Dockable panels

Advanced users may rearrange panels, but the default interface should remain clean.

Panels include:

* Rundown
* Sources
* Audio mixer
* Inspector
* Chat
* Activity feed
* Stream health
* Destinations
* Support events
* Replay
* Clip queue
* Automation log
* Performance meter

---

# 6. VIDEO ENGINE

## 6.1 Initial capabilities

* 1920×1080 production
* 30 and 60 FPS
* Display capture
* Window capture
* Game capture
* Camera capture
* Image and video playback
* Browser rendering
* GPU-based composition
* Crop, scale and rotate
* Alpha blending
* Source grouping
* Scene transitions
* Color correction
* Chroma key
* Luma key
* Masks
* Basic blur
* Drop shadows
* Rounded corners

## 6.2 GPU architecture

Windows-first recommendation:

* Direct3D 11 for initial compatibility
* Direct3D 12 evaluation after the core is stable
* Shared GPU textures between capture, compositor and encoder
* Minimal CPU readback
* Hardware texture conversion
* Dedicated frame scheduler
* GPU-memory budget monitoring

## 6.3 Frame pipeline

```text
Capture
   ↓
Timestamp normalization
   ↓
Color conversion
   ↓
Source effects
   ↓
Scene composition
   ↓
Canvas overrides
   ↓
Destination render
   ↓
Encoder
   ↓
Stream or recording
```

## 6.4 Multi-canvas system

A Show may have multiple canvases.

```text
Main Horizontal     1920×1080
Vertical Social     1080×1920
Square Social       1080×1080
Clean Feed          1920×1080
Recording Master    2560×1440
```

Each source stores:

* Shared properties
* Canvas-specific position
* Canvas-specific scale
* Canvas-specific visibility
* Canvas-specific crop
* Canvas-specific typography
* Destination restrictions

## 6.5 Rendering strategy

Do not render every destination completely independently unless required.

Use:

1. Shared source capture
2. Shared source processing
3. Shared base composition
4. Per-canvas override pass
5. Per-destination encoding

This reduces duplicated GPU work.

---

# 7. AUDIO ENGINE — OURCONSOLE

## 7.1 Core design

Audio should be organized around clearly named destinations.

```text
PROGRAM
What the live audience hears

MONITOR
What the creator hears

RECORD
What is written to the master recording

CLIP
What is stored in the replay buffer

CLEAN FEED
What guests or external productions receive
```

## 7.2 Channel strip

Every audio source receives:

* Source selector
* Input meter
* Gain
* High-pass filter
* Noise suppression
* Noise gate
* Equalizer
* Compressor
* De-esser
* Limiter
* Pan
* Delay
* Mute
* Solo
* Monitor control
* Bus assignments
* Recording-track assignments

## 7.3 Routing matrix

```text
                  Program  Monitor  Record  Clip  Guest
Microphone           ✓        ✓       ✓      ✓      ✓
Game                  ✓        ✓       ✓      ✓      ✕
Music                 ✓        ✓       ✓      ✓      ✕
Discord               ✓        ✓       ✓      ✓      ✓
Alerts                ✓        ✓       ✓      ✓      ✕
Private talkback      ✕        ✓       ✕      ✕      ✓
```

## 7.4 Scene behavior

Channels can be:

* Global
* Scene-controlled
* Rundown-controlled
* Destination-specific
* Temporarily overridden

Avoid duplicating the same microphone source inside every scene.

## 7.5 Audio snapshots

A snapshot saves a complete mix state.

Examples:

* Gameplay
* Interview
* Music performance
* Break
* Private guest setup
* Emergency fallback

## 7.6 Multitrack recording

Recommended track defaults:

```text
Track 1  Full Program Mix
Track 2  Microphone
Track 3  Game/Desktop
Track 4  Guests/Discord
Track 5  Music
Track 6  Alerts
Track 7  Clean Mix
Track 8  Backup Mix
```

## 7.7 Safety systems

* Feedback-loop detection
* Duplicate-source detection
* Clipping warnings
* Silence detection
* Device disconnect recovery
* Sample-rate mismatch warning
* Drift monitoring
* Automatic latency measurement
* Emergency limiter
* Audio continuity during scene changes

---

# 8. STREAMING AND MULTISTREAMING

## 8.1 Destination model

A destination stores:

* Platform
* Account
* Authentication method
* Stream endpoint
* Stream key or token reference
* Resolution
* Frame rate
* Bitrate
* Audio bitrate
* Encoder
* Canvas
* Delay
* Metadata
* Visibility rules
* Retry policy

## 8.2 Initial destinations

* Twitch
* Facebook Live
* YouTube Live
* Custom RTMP
* Custom RTMPS
* Local network output

Later:

* SRT
* RIST
* WHIP/WebRTC
* HLS contribution
* NDI
* Custom enterprise endpoints

YouTube officially supports RTMP, RTMPS, HLS and DASH ingestion, with protocol choice affecting encryption, latency and codec capabilities. PulseCast’s first release should prioritize RTMPS where supported, then add higher-end protocols after the standard path is stable. ([Google for Developers][1])

## 8.3 Direct multistreaming

```text
PulseCast ──► Twitch
          ├─► Facebook
          └─► YouTube
```

Advantages:

* No PulseCast server required
* No relay subscription
* Greater creator control
* Lower service infrastructure costs

Disadvantages:

* More upload bandwidth
* Multiple simultaneous connections
* Potentially more encoding work
* Greater local network risk

## 8.4 Relay multistreaming

```text
PulseCast
    │ One contribution stream
    ▼
Pulse Relay
    ├── Twitch
    ├── Facebook
    ├── YouTube
    └── Custom destination
```

Advantages:

* One creator upload
* Centralized reconnection
* Easier weak-network support
* Server-side transcoding options
* Cloud recording possibilities

Disadvantages:

* Infrastructure cost
* Privacy responsibility
* Account security requirements
* Greater operational complexity

## 8.5 Recommended launch strategy

### PulseCast Local

Included in the desktop application:

* Direct streaming
* Direct multistreaming
* Custom RTMP/RTMPS
* No required PulseCast account

### Pulse Relay

Optional paid service:

* Single-upload distribution
* Cloud failover
* Cloud recording
* Remote production
* Scheduled broadcasts
* Backup destination switching
* Web dashboard

## 8.6 Per-platform output

Each destination can receive a different canvas.

Example:

```text
Twitch
Canvas: Horizontal
Resolution: 1920×1080
Graphics: Twitch alerts and Twitch chat

Facebook
Canvas: Vertical
Resolution: 1080×1920
Graphics: Large captions and Facebook Stars

YouTube
Canvas: Horizontal
Resolution: 1920×1080
Graphics: YouTube chat and Super Chat alerts
```

## 8.7 Destination readiness test

Before going live, PulseCast checks:

* Credential validity
* Account connection
* Stream endpoint
* Required permissions
* Encoder availability
* Resolution compatibility
* Frame-rate compatibility
* Upload headroom
* Audio presence
* Keyframe interval
* Disk capacity
* Platform-specific metadata
* Scheduled broadcast state

YouTube’s Live Streaming API separates broadcasts from stream resources and allows applications to create, manage and associate them. PulseCast should preserve that distinction internally rather than treating every platform as a simple stream-key box. ([Google for Developers][2])

## 8.8 Stream start transaction

```text
1. Validate Show
2. Validate devices
3. Validate destinations
4. Start recording safety buffer
5. Start encoders
6. Connect destinations
7. Confirm destination health
8. Transition to live scene
9. Enable event ingestion
10. Mark Show as LIVE
```

If one destination fails, the user chooses:

* Continue on successful destinations
* Retry failed destination
* Stop everything
* Switch failed destination to relay
* Begin local recording only

---

# 9. GIFTS, SUPPORT AND ENGAGEMENT

## 9.1 Unified event system

Different platform events should enter one normalized event bus.

Supported event categories:

* Follow
* Subscription
* Resubscription
* Gifted subscription
* Cheer/Bits
* Stars
* Super Chat
* Super Sticker
* Membership
* Channel Point redemption
* Direct tip
* Merchandise purchase
* Patreon-style membership event
* Raid
* Host
* Viewer milestone
* Chat milestone

Twitch EventSub can deliver events such as follows, subscriptions, cheers and Channel Point redemptions through Webhooks, WebSockets or Conduits. ([Twitch Developers][3])

## 9.2 Normalized support-event schema

```json
{
  "eventId": "evt_01J...",
  "platform": "twitch",
  "eventType": "cheer",
  "channelId": "channel_123",
  "sender": {
    "platformUserId": "user_456",
    "displayName": "SupporterName",
    "anonymous": false
  },
  "quantity": 500,
  "unit": "bits",
  "currency": null,
  "grossAmount": null,
  "estimatedCreatorValue": null,
  "message": "Keep building!",
  "occurredAt": "2026-07-28T17:30:00Z",
  "verified": true,
  "rawProviderEvent": {}
}
```

## 9.3 Money-value rules

PulseCast must not falsely convert every gift into guaranteed earnings.

Values should be labeled as:

* Platform units
* Viewer-spend amount
* Estimated creator value
* Confirmed direct payment
* Pending payout
* Refunded
* Reversed
* Unknown

Example:

```text
500 Facebook Stars
Platform quantity: 500 Stars
Creator value: Platform-reported or unavailable
Status: Received event
```

## 9.4 Support Center

```text
LIVE SUPPORT

Twitch       Marcus cheered 100 Bits
Facebook     Jasmine sent 500 Stars
YouTube      Tasha sent a $10.00 Super Chat
Twitch       Rico gifted 5 subscriptions
Direct       Dre tipped $25.00
```

Views:

* Latest
* Largest
* Gift streaks
* Top supporters
* Platform totals
* Session totals
* Goal progress
* Unacknowledged events
* Moderation queue

## 9.5 Alert builder

Alert composition layers:

```text
Alert
├── Background
├── Animation
├── Supporter name
├── Event description
├── Message
├── Sound
├── Particle effect
├── TTS
└── Exit animation
```

## 9.6 Trigger engine

```text
WHEN
Platform = Twitch
Event = Cheer
Quantity ≥ 500

THEN
Show “Power Surge” animation
Play supporter sound
Increase stream goal
Save previous 30 seconds
Add supporter to wall
Send thank-you message
```

## 9.7 Destination-aware alerts

An event may appear on:

* Source platform only
* All destinations
* Selected destinations
* Recording only
* Creator monitor only
* Vertical canvas only
* Clean feed excluded

## 9.8 Support goals

Goal types:

* Platform units
* Confirmed direct money
* Combined estimated support
* Subscriber count
* Membership count
* Follower count
* Gift count
* Custom community objective

Example:

```text
NEW STREAMING PC

Confirmed direct support     $215.00
Platform-estimated support   $124.50
Pending platform support      $48.00

Confirmed goal progress      $215.00 / $1,200.00
```

Confirmed, estimated and pending amounts must remain visually separate.

---

# 10. CHAT AND COMMUNITY

## 10.1 Unified creator chat

The private creator dashboard can display multiple platforms together.

```text
[Twitch]   Mike: That transition was crazy
[Facebook] Tanya: Where can I get this?
[YouTube]  Dre: Turn the music up
```

YouTube provides live-chat API methods and a low-latency streaming connection for receiving messages. ([Google for Developers][4])

## 10.2 Public chat overlays

Public overlays should support:

* Single-platform chat
* Selected-platform chat
* Moderated unified chat
* Platform icons
* Custom colors
* Subscriber badges
* Message filtering
* Emotes
* Link blocking
* Profanity filtering
* Delayed publishing

## 10.3 Moderation

* Ban
* Timeout
* Delete message
* Block terms
* Follower-only settings
* Slow mode
* TTS approval
* First-time chatter review
* Suspicious-message filtering
* Cross-platform block list
* Mod dashboard

## 10.4 Message identity

Do not automatically assume that identical usernames across platforms represent the same person.

A future optional identity-linking system may let viewers voluntarily connect accounts.

---

# 11. PULSE CORE GRAPHICS

## 11.1 Native graphic types

* Lower thirds
* Alerts
* Goal bars
* Chat cards
* Captions
* Countdown timers
* Clocks
* Sponsor cards
* Social banners
* Scoreboards
* Music visualizers
* Now-playing displays
* Supporter walls
* Polls
* Brackets
* Data-driven charts
* Scene transitions
* Camera frames
* Reactive backgrounds

## 11.2 Graphic template model

A template includes:

```text
Template
├── Layout
├── Editable fields
├── Pulse animation graph
├── Theme tokens
├── Audio-reactive rules
├── Data bindings
├── Entrance
├── Loop
├── Exit
└── Performance budget
```

## 11.3 Canonical Pulse integration

All production animations should use the canonical Pulse workflow.

```javascript
new Pulse().x()
```

PulseCast becomes a flagship consumer and validation environment for:

* Browser Pulse
* Native rendering
* PMask
* PulseJuce
* Headless deterministic replay
* Animation lifecycle diagnostics
* Manifest release gates

## 11.4 Graphic safety

Each graphic must declare:

* Expected resolution
* Maximum GPU cost
* Maximum memory use
* Font dependencies
* Media dependencies
* Network dependencies
* Reduced-motion behavior
* Fallback appearance
* Safe-area requirements

---

# 12. CAPTIONS AND TRANSCRIPTION

## 12.1 Caption modes

* Standard captions
* Word-by-word captions
* Karaoke captions
* Speaker-separated captions
* Translated captions
* Music lyrics
* Teleprompter
* Closed-caption output
* Burned-in captions
* Social-video captions

## 12.2 Caption pipeline

```text
Audio source
   ↓
Voice activity detection
   ↓
Streaming transcription
   ↓
Punctuation and segmentation
   ↓
Speaker assignment
   ↓
Moderation filter
   ↓
Caption styling
   ↓
Destination output
```

## 12.3 Music mode

Music mode can associate:

* Artist
* Song
* Lyrics
* Word timestamps
* Sections
* Ad-libs
* Doubles
* Emphasis
* Tempo
* Beat positions
* Visual triggers

This can later use PCF containers.

---

# 13. RECORDING, REPLAY AND CLIPPING

## 13.1 Recording modes

* Program recording
* Clean recording
* Multitrack audio
* Isolated camera recording
* Isolated gameplay recording
* Vertical recording
* Proxy recording
* Stream-safe backup recording

## 13.2 Crash-resistant recording

Prefer fragmented or recoverable container strategies during capture.

The system should:

* Write periodic indexes
* Avoid keeping the complete recording state only in memory
* Recover interrupted recordings
* Validate the final file
* Preserve partial footage when possible

## 13.3 Replay buffer

Configurable replay lengths:

* 15 seconds
* 30 seconds
* 60 seconds
* 2 minutes
* 5 minutes
* Custom

Replay sources:

* Program
* Clean feed
* Selected scene
* Selected source
* Vertical canvas
* Audio-only

## 13.4 Replay actions

```text
SAVE LAST 30 SECONDS
├── Add marker
├── Name clip automatically
├── Open clip editor
├── Add captions
├── Create vertical version
├── Add Pulse intro/outro
└── Queue export
```

## 13.5 Highlight automation

A support event may automatically:

* Mark the timeline
* Save the previous 30 seconds
* Save the following 15 seconds
* Create an editable highlight
* Attach event metadata
* Add supporter name
* Create a social version

## 13.6 Clip editor

Initial editor features:

* Trim
* Split
* Reframe
* Crop
* Caption
* Add title
* Add music
* Add logo
* Apply Pulse templates
* Normalize audio
* Export presets

---

# 14. AUTOMATION ENGINE

## 14.1 Automation model

```text
WHEN
Condition

IF
Optional filters

THEN
One or more actions

ELSE
Optional fallback
```

## 14.2 Conditions

* Stream starts
* Stream stops
* Scene changes
* Rundown item starts
* Timer expires
* Chat command
* Gift event
* Viewer threshold
* Audio level
* Silence detected
* Source disconnected
* Network condition
* CPU/GPU threshold
* Hotkey
* MIDI
* Webhook
* File change
* Time of day

## 14.3 Actions

* Switch scene
* Show graphic
* Play sound
* Mute channel
* Change audio snapshot
* Start recording
* Save replay
* Send chat message
* Update goal
* Change camera
* Trigger lighting
* Execute approved script
* Call local API
* Notify creator
* Switch destination
* Restart isolated source host

## 14.4 Guardrails

Automations should include:

* Cooldown
* Maximum executions
* Duplicate suppression
* Approval requirement
* Destination restrictions
* Dry-run mode
* Audit log
* Undo support
* Failure fallback

---

# 15. CREATOR ASSISTANT

## 15.1 Assistant responsibilities

The assistant may help with:

* Initial setup
* Scene generation
* Audio diagnosis
* Layout recommendations
* Vertical conversion
* Stream-health explanation
* Gift-rule creation
* Caption styling
* Clip creation
* Project organization
* Error recovery

## 15.2 Transactional changes

The assistant should never silently mutate a live production.

Example:

```text
Requested:
“Make my mic louder without making the fan louder.”

Proposed changes:
• Added high-pass filter at 80 Hz
• Increased input gain by 2 dB
• Added downward expander
• Added compressor
• Set output ceiling to -1 dBFS

Expected result:
Louder speech with reduced room noise.

[Preview] [Apply] [Cancel]
```

## 15.3 Live-mode restrictions

During a live stream:

* Safe visual changes may preview before publishing.
* Dangerous audio changes require confirmation.
* Encoder changes may be deferred.
* Destination changes require explicit action.
* Plugins cannot install.
* Project migration cannot run.
* Automatic rollback remains available.

---

# 16. PLUGIN AND EXTENSION SYSTEM

## 16.1 Extension categories

* Capture sources
* Graphics
* Audio processors
* Platform integrations
* Automations
* Control surfaces
* Exporters
* Analytics
* Caption engines
* AI services

## 16.2 Process isolation

```text
PulseCast Core
├── Capture Host
├── Browser Host
├── Audio Plugin Host
├── Graphics Host
├── Platform Host
└── Automation Host
```

A plugin failure should not terminate the complete stream.

## 16.3 Permissions

Extensions must request capabilities:

* Network
* Filesystem
* Microphone
* Camera
* Stream control
* Chat access
* Gift-event access
* Account metadata
* Local command execution
* External devices

## 16.4 Plugin manifest

```json
{
  "id": "com.example.extension",
  "name": "Example Extension",
  "version": "1.0.0",
  "pulsecastApi": "1.x",
  "entrypoint": "extension.exe",
  "permissions": [
    "network",
    "graphics.render"
  ],
  "hosts": [
    "graphics"
  ]
}
```

## 16.5 Compatibility

Before an application update:

1. Scan installed plugins.
2. Compare compatibility declarations.
3. Warn about unsupported modules.
4. Create rollback snapshot.
5. Offer safe-mode launch.
6. Keep the previous runtime available.

OBS supports extension through plugins and Python or Lua scripting; PulseCast should preserve extensibility while improving isolation, permissions and recovery. ([OBS Studio][5])

---

# 17. PROJECT FILE FORMAT

## 17.1 File extension

Recommended:

```text
.pcast
```

## 17.2 Container format

Use a ZIP-compatible packaged container initially.

```text
MyShow.pcast
├── manifest.json
├── show.json
├── rundown.json
├── scenes/
├── sources/
├── audio/
├── graphics/
├── automations/
├── captions/
├── assets/
├── thumbnails/
├── recovery/
└── checksums.json
```

## 17.3 Manifest example

```json
{
  "format": "pulsecast-show",
  "formatVersion": "1.0.0",
  "showId": "show_01J...",
  "name": "Friday Night Stream",
  "createdAt": "2026-07-28T17:00:00Z",
  "modifiedAt": "2026-07-28T18:30:00Z",
  "applicationVersion": "0.1.0",
  "requiredModules": {
    "pulseCore": "1.9.x",
    "ourConsole": "1.x",
    "atlas": "1.x"
  }
}
```

## 17.4 Secrets

Never store raw platform credentials directly in the Show package.

Store:

* Credential reference ID
* Account display name
* Platform
* Required scopes

Actual credentials belong in:

* Windows Credential Manager
* Encrypted local vault
* Optional secure account sync

---

# 18. PLATFORM INTEGRATION LAYER

## 18.1 Adapter interface

Each platform adapter implements:

```text
Authenticate
RefreshCredentials
ValidateDestination
CreateBroadcast
UpdateBroadcast
StartBroadcast
StopBroadcast
GetStreamHealth
ReadChat
SendChat
SubscribeToEvents
NormalizeEvents
ReadAnalytics
HandleReconnect
```

## 18.2 Twitch adapter

Initial support:

* OAuth
* Channel metadata
* Stream connection
* Chat
* EventSub
* Cheers
* Subscriptions
* Gift subscriptions
* Channel Points
* Raids
* Follows where authorized

Twitch API operations and EventSub subscriptions require the correct token type and authorization scopes. PulseCast should request only the permissions needed for enabled features. ([Twitch Developers][6])

Twitch recommends EventSub and API-based approaches for modern event and chat integrations where applicable, rather than building new functionality primarily around legacy IRC parsing. ([Twitch Developers][7])

## 18.3 YouTube adapter

Initial support:

* OAuth
* Create or select broadcast
* Create or select stream
* Bind stream to broadcast
* Schedule stream
* Update title and description
* Live chat
* Super Chat event handling where supported
* Health status
* Transition broadcast states

## 18.4 Facebook adapter

Initial support should remain adapter-driven because available Meta permissions, Page access, eligibility and endpoint behavior can change.

Support goals:

* Account/Page connection
* Broadcast creation where authorized
* Stream endpoint retrieval
* Live comments
* Stars/support events where APIs permit
* Metadata management
* Health monitoring

Meta’s permission documentation identifies permissions involved in publishing video and live-video workflows, so the exact feature set must be validated during implementation and app review rather than hard-coded as a permanent assumption. ([Facebook Developers][8])

## 18.5 Custom destination

Fields:

* Name
* Server URL
* Stream key
* Authentication
* Protocol
* Encoder profile
* Resolution
* Audio settings
* Custom headers where supported

---

# 19. RELIABILITY AND RECOVERY

## 19.1 Recovery layers

### Layer 1: Undo/redo

For normal editing.

### Layer 2: Autosave

Incremental project saves.

### Layer 3: Show snapshots

Named stable versions.

### Layer 4: Live-production checkpoint

State captured immediately before going live.

### Layer 5: Last-known-good

Validated configuration proven to stream successfully.

### Layer 6: Application rollback

Previous executable and plugin environment.

## 19.2 Crash recovery

At restart:

```text
PulseCast detected an interrupted session.

Recovered:
✓ Show state
✓ 48-minute recording
✓ Replay buffer index
✓ Audio routing
✓ Destination configuration

Needs attention:
⚠ Browser alert source stopped responding
⚠ Facebook connection needs authentication

[Open Recovered Show]
[Open Safe Mode]
[Restore Last Known Good]
```

## 19.3 Failure containment

* Browser-source crash: restart browser host
* VST crash: bypass processor and preserve audio
* Platform connection loss: retry destination only
* Capture failure: retain final frame and notify creator
* Encoder failure: switch to backup encoder if configured
* Disk failure: stop recording without ending stream
* UI crash: core stream process continues when possible

## 19.4 Watchdog architecture

```text
PulseCast Launcher
    ├── UI Process
    ├── Core Production Process
    ├── Audio Process
    ├── Extension Hosts
    └── Watchdog
```

The user interface should not be the process directly responsible for maintaining the stream.

---

# 20. SECURITY AND PRIVACY

## 20.1 Required controls

* Encrypted credentials
* OAuth state validation
* Token rotation
* Permission minimization
* Signed updates
* Signed extension packages
* Extension sandboxing
* Secure local API
* Redacted diagnostic exports
* Sensitive-window protection
* Optional local-only mode

## 20.2 Privacy mode

A creator can mark windows or applications as private.

PulseCast then:

* Blocks them from display capture where technically possible
* Warns before switching to an unsafe source
* Blurs notification regions
* Hides credentials
* Disables desktop previews on public outputs
* Uses a privacy fallback scene

## 20.3 Diagnostic package

Support exports should exclude by default:

* Stream keys
* OAuth tokens
* Private chat
* Personal file paths
* Recorded audio
* Browser cookies

---

# 21. PERFORMANCE TARGETS

## 21.1 Initial target machine

A realistic baseline:

* Windows 10 or 11
* Four-core modern CPU
* 8 GB RAM minimum
* 16 GB recommended
* Direct3D 11-compatible GPU
* Hardware H.264 encoder recommended
* SSD recommended

## 21.2 Performance budgets

At 1080p60:

* Stable frame pacing
* No sustained audio underruns
* UI remains responsive
* Browser sources isolated
* GPU memory warnings before exhaustion
* Automatic preview-quality reduction before output degradation
* Stream output prioritized over editor animations

## 21.3 Load-shedding order

When the system is overloaded:

1. Reduce UI animation quality.
2. Reduce preview frame rate.
3. Pause nonessential thumbnails.
4. Reduce browser-source background updates.
5. Reduce optional graphic effects.
6. Warn creator.
7. Preserve stream and audio.
8. Never silently alter output resolution while live.

---

# 22. DATA AND ANALYTICS

## 22.1 Local session report

After each stream:

* Start and end time
* Destination uptime
* Dropped frames
* Encoder overload
* Network interruptions
* Audio peaks
* Silence incidents
* Scene usage
* Support events
* Chat activity
* Replay saves
* Clips generated
* Recording files
* Errors
* Recovery actions

## 22.2 Creator analytics

* Best-performing rundown sections
* Most active chat moments
* Gift-event timeline
* Viewer peaks
* Clip-worthy moments
* Audio-quality score
* Stream-health trends
* Destination comparison

Avoid combining platform metrics in misleading ways. Clearly label:

* Concurrent viewers
* Unique viewers
* Views
* Reach
* Watch time
* Chatters
* Supporters

---

# 23. TECHNICAL ARCHITECTURE

## 23.1 Recommended stack

### Native core

* C++20
* JUCE for audio and native application services
* CMake
* Direct3D 11
* FFmpeg libraries
* Windows Audio Session API
* ASIO support where licensed and appropriate
* Media Foundation evaluation for Windows capture paths

### Interface

* React
* TypeScript
* WebView2 or equivalent isolated UI shell
* Native IPC bridge
* Zustand, Redux Toolkit or a purpose-built state layer
* Canvas or WebGPU-assisted editor where useful

### Data

* SQLite
* JSON schemas
* ZIP-compatible Show containers
* Content-addressed asset storage
* Checksums
* Transaction journal

### Network

* RTMP/RTMPS
* WebSocket
* OAuth 2.0
* REST platform APIs
* SRT later
* WebRTC later

## 23.2 Major processes

```text
pulsecast-launcher.exe
pulsecast-ui.exe
pulsecast-core.exe
pulsecast-audio.exe
pulsecast-browser-host.exe
pulsecast-plugin-host.exe
pulsecast-watchdog.exe
```

## 23.3 Internal services

```text
ShowService
SourceService
CompositionService
AudioGraphService
DestinationService
EncodingService
RecordingService
ReplayService
PlatformService
EventService
AutomationService
CaptionService
AssetService
RecoveryService
DiagnosticsService
```

## 23.4 Event bus

Internal events should be immutable and timestamped.

```text
source.connected
source.disconnected
scene.activated
audio.clipping
destination.connected
destination.failed
support.received
chat.received
replay.saved
recording.started
recording.recovered
automation.executed
```

## 23.5 Command model

All state mutations use commands:

```text
AddSource
RemoveSource
MoveSource
RouteAudio
StartRecording
StartDestination
ApplyAudioSnapshot
TriggerGraphic
SaveReplay
```

Commands support:

* Validation
* Authorization
* Preview
* Execution
* Audit
* Undo where possible
* Rollback

---

# 24. MINIMUM VIABLE PRODUCT

## PulseCast 0.1 — Foundation

Build:

1. Windows application shell
2. Show project
3. Display capture
4. Window capture
5. Camera capture
6. Image source
7. Video source
8. Microphone source
9. Desktop-audio source
10. 1080p canvas
11. Basic scene switching
12. Basic transitions
13. Program and Monitor audio buses
14. Basic gain, mute, gate and limiter
15. Hardware H.264 encoding
16. Local recording
17. Custom RTMP/RTMPS streaming
18. Project autosave
19. Crash-recovery journal
20. Stream-health display

### MVP completion test

A new user can:

1. Install PulseCast.
2. Create a Show.
3. Add a microphone, camera and screen.
4. Hear the correct monitor mix.
5. Run a 30-second test recording.
6. Validate the recording automatically.
7. Add a stream destination.
8. Go live.
9. End the stream.
10. Recover the Show after forced application termination.

---

# 25. DEVELOPMENT PHASES

## Phase 0 — Architecture proof

Build independent proofs for:

* GPU capture
* GPU composition
* Audio routing
* Hardware encoding
* RTMP output
* Process isolation
* Crash-resistant recording
* Pulse texture integration

Do not build the full interface yet.

## Phase 1 — Broadcast foundation

Deliver:

* Core compositor
* Source lifecycle
* Basic scenes
* Audio engine
* Encoder
* Recording
* One destination
* Recovery
* Diagnostics

## Phase 2 — Creator workflow

Deliver:

* Show format
* Rundown
* Direct canvas editing
* Guided setup
* Test recording
* Audio-routing interface
* Templates
* Asset library

## Phase 3 — Platform connections

Deliver:

* Twitch adapter
* YouTube adapter
* Facebook adapter where approved
* OAuth vault
* Broadcast metadata
* Chat
* Destination health
* Direct multistreaming

## Phase 4 — Gifts and alerts

Deliver:

* Unified event bus
* Twitch EventSub
* YouTube engagement events
* Facebook support events where available
* Alert templates
* Gift goals
* Support Center
* Trigger rules

## Phase 5 — Pulse graphics

Deliver:

* Lower thirds
* Animated alerts
* Goal bars
* Chat layouts
* Transitions
* Audio-reactive effects
* Graphic template editor
* Destination-specific graphics

## Phase 6 — Replay and content tools

Deliver:

* Replay buffer
* Timeline markers
* Clip editor
* Vertical reframing
* Captions
* Export presets
* Social clip queue

## Phase 7 — Pulse Relay

Deliver:

* Authentication
* Contribution ingest
* Multi-destination distribution
* Reconnection
* Cloud recording
* Status dashboard
* Usage metering

## Phase 8 — Extensions and intelligence

Deliver:

* Extension SDK
* Sandboxed hosts
* Marketplace foundation
* Zoro assistant
* Dex audits
* Transaction previews
* Automated diagnostics

---

# 26. REPOSITORY STRUCTURE

```text
pulsecast-studio/
├── apps/
│   ├── desktop-ui/
│   ├── launcher/
│   └── diagnostics-viewer/
├── core/
│   ├── show/
│   ├── commands/
│   ├── events/
│   ├── recovery/
│   └── diagnostics/
├── media/
│   ├── capture/
│   ├── compositor/
│   ├── encoding/
│   ├── recording/
│   └── replay/
├── audio/
│   ├── engine/
│   ├── graph/
│   ├── dsp/
│   ├── devices/
│   └── recording/
├── graphics/
│   ├── pulse-adapter/
│   ├── templates/
│   ├── masks/
│   └── transitions/
├── platforms/
│   ├── twitch/
│   ├── youtube/
│   ├── facebook/
│   └── custom-rtmp/
├── engagement/
│   ├── chat/
│   ├── support-events/
│   ├── alerts/
│   └── goals/
├── automation/
├── captions/
├── extensions/
│   ├── sdk/
│   ├── host/
│   └── examples/
├── schemas/
├── tests/
├── examples/
├── reports/
└── docs/
```

---

# 27. TESTING STRATEGY

## 27.1 Unit tests

* Show serialization
* Command validation
* Event normalization
* Audio routing
* Automation conditions
* Gift-value labeling
* Recovery journal
* Credential-reference handling

## 27.2 Integration tests

* Capture to compositor
* Compositor to encoder
* Audio/video synchronization
* Recording recovery
* Destination reconnect
* Platform event to alert
* Gift event to replay trigger
* Assistant transaction to Show mutation

## 27.3 Stress tests

* Eight-hour stream
* Twenty browser sources
* Multiple camera disconnects
* Network interruption
* Encoder reset
* Audio-device removal
* Plugin crash
* UI termination
* Low disk space
* Destination token expiration
* Large chat volume
* Gift-event burst

## 27.4 Proof package

Every release should produce:

* Test summary
* Performance report
* Recording samples
* Stream logs
* Recovery proof
* Desktop screenshots
* Reduced-motion proof
* High-DPI proof
* Mobile-control proof when available
* Plugin compatibility manifest
* Checksums

---

# 28. BUSINESS MODEL

## 28.1 Free desktop tier

* Local recording
* Single-destination streaming
* Basic scenes
* Basic audio
* Basic Pulse templates
* Local project files
* No watermark

## 28.2 Creator tier

Potential features:

* Direct multistreaming
* Advanced graphics
* Advanced replay
* Caption styling
* Vertical canvases
* Extended recording
* Creator analytics
* More automation rules

## 28.3 Relay tier

Usage-based or subscription:

* Cloud multistreaming
* Cloud recording
* Failover
* Scheduled streams
* Remote guests
* Remote dashboard
* Team access

## 28.4 Studio tier

* Multiple creator profiles
* Shared assets
* Brand kits
* Operator roles
* Approval workflows
* Advanced audio
* Remote production
* Priority support

## 28.5 Marketplace

Future revenue:

* Graphic templates
* Transitions
* Alert packs
* Audio processors
* Platform adapters
* Automation packs
* Creator themes

PulseCast should not take a percentage of creators’ ordinary platform gifts or direct tips unless it later provides an explicitly separate payment-processing service with clear terms.

---

# 29. DIFFERENTIATORS

PulseCast’s strongest advantages should be:

1. One Show file instead of fragmented project configuration.
2. Program, Monitor and Record audio routing that ordinary creators understand.
3. Horizontal and vertical production in the same Show.
4. Native multistreaming.
5. Unified gifts and support events.
6. Destination-aware alerts and graphics.
7. Pulse Core motion graphics without browser-template coding.
8. Instant replay connected directly to a clip editor.
9. Native captions and lyric workflows.
10. Plugin isolation and last-known-good recovery.
11. Structured assistant changes with preview and rollback.
12. Integrated audio, streaming and content creation.

---

# 30. NON-GOALS FOR THE FIRST RELEASE

Do not attempt initially:

* Full Adobe Premiere replacement
* Complete DAW
* Every streaming platform
* macOS and Linux parity
* Large plugin marketplace
* Cloud multistreaming infrastructure
* Automatic content moderation for every language
* Full 4K production
* Professional broadcast SDI stack
* Unrestricted AI control
* Custom payment processing
* Mobile-native production application

The first release must prove that PulseCast can reliably capture, mix, encode, stream, record and recover.

---

# 31. FIRST FLAGSHIP DEMO

Build one polished demonstration Show containing:

* Animated PulseCast intro
* Host camera
* Desktop or game capture
* OURconsole microphone processing
* Program, Monitor and Record routing
* Twitch and Facebook destination mock adapters
* Horizontal and vertical canvases
* Unified gift activity feed
* Gift-triggered Pulse animation
* Thirty-second replay
* Captioned vertical clip export
* Recovery after forced source-host failure

The demo should use only canonical public module interfaces.

No private shortcuts.

---

# 32. IMMEDIATE BUILD ORDER

## Milestone 1: Media proof

* Capture display
* Capture camera
* Composite both
* Preview 1080p60
* Record one minute
* Verify synchronization

## Milestone 2: Audio proof

* Capture microphone
* Capture desktop audio
* Route to Program
* Route to Monitor
* Record isolated tracks
* Detect clipping and silence

## Milestone 3: Stream proof

* Encode H.264
* Output RTMPS
* Show network health
* Reconnect after simulated interruption
* Preserve local recording

## Milestone 4: Show proof

* Save project
* Close application
* Reopen identically
* Force crash
* Recover project
* Restore last-known-good state

## Milestone 5: Pulse proof

* Render native Pulse overlay
* Trigger entrance and exit
* Bind overlay to test support event
* Validate frame performance
* Restart graphic host without ending recording

## Milestone 6: Multistream proof

* One capture graph
* Two destination configurations
* Two canvas variants
* Independent connection health
* Independent reconnection

---

# 33. DEFINITION OF SUCCESS

PulseCast succeeds when creators say:

* “I understood where my audio was going.”
* “I did not need three extra programs.”
* “My vertical stream looked intentional.”
* “My alerts worked on the right platforms.”
* “I recovered my stream after something broke.”
* “I turned my best moment into a clip immediately.”
* “I could customize it without learning browser-source code.”
* “It felt like a creator tool instead of an engineering control panel.”

The technical success condition is:

> PulseCast can maintain synchronized audio and video, record recoverable media, stream reliably to one or more destinations, process engagement events, render destination-aware graphics and preserve the production when a nonessential module fails.

---

# 34. FINAL PRODUCT STATEMENT

> **PulseCast Studio is a modular live-production operating system for creators. It combines streaming, recording, professional audio routing, animated graphics, multistream distribution, gifts, chat, captions, replay and content clipping inside one safe and recoverable Show project.**

The system should first become a trustworthy broadcaster.

Then it becomes a better creator workflow.

Then it becomes the place where Pulse Core, OURconsole, Atlas Studio and your agent ecosystem operate together as one complete production platform.

This version is structured so it can become the root `PULSECAST_MASTER_BLUEPRINT.md` for the repository.

[1]: https://developers.google.com/youtube/v3/live/guides/ingestion-protocol-comparison?utm_source=chatgpt.com "YouTube Live Streaming Ingestion Protocol Comparison"
[2]: https://developers.google.com/youtube/v3/live/getting-started?utm_source=chatgpt.com "YouTube Live Streaming API Overview"
[3]: https://dev.twitch.tv/docs/eventsub/?utm_source=chatgpt.com "EventSub"
[4]: https://developers.google.com/youtube/v3/live/docs/liveChatMessages?utm_source=chatgpt.com "LiveChatMessages | YouTube Live Streaming API"
[5]: https://obsproject.com/kb/scripting-guide?utm_source=chatgpt.com "Scripting Guide | OBS"
[6]: https://dev.twitch.tv/docs/authentication/scopes/?utm_source=chatgpt.com "Twitch Access Token Scopes"
[7]: https://dev.twitch.tv/docs/chat/irc/?utm_source=chatgpt.com "IRC Concepts"
[8]: https://developers.facebook.com/docs/permissions/?utm_source=chatgpt.com "Permissions Reference - App Development with Meta"
