# Visual Review

Result: PASS for the bounded `fault-injected-real` native source-preview slice.

The Settings preview is visibly contained inside the PlayStation source card,
tracks scroll position, and exposes acquired/presented counters. The Production
surface is contained inside the canvas and is labeled `PLAYSTATION SOURCE
PREVIEW`, preventing it from being mistaken for Program output.

The native child surface is absent while Diagnostics is open; the full drawer
remains readable and operable. It returns after the drawer closes. The stopped
state removes the child surface and visibly reports `PREVIEW DETACHED` with
last frame count, resolution, and source.

The mock source itself is visibly labeled `MOCK REMOTE PLAY WINDOW - REAL
WINDOWS CAPTURE`. No screenshot claims an official Sony client, PS5, Program
composition, audio, recording, or destination output.
