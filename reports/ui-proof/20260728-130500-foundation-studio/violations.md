# Violations

Blocking violations: **none**.

The first desktop capture exposed an overlap between the intrinsically sized
studio grid and the audio console. The layout was corrected to allocate the
remaining viewport height explicitly, contain panel overflow, and keep the
audio and lower docks in their own rows. The certified default and destination
failure screenshots were recaptured after that correction.

Non-blocking notes:

- At 1024 x 720, vertical scrolling is expected; measured horizontal overflow
  is zero.
- The inspector uses internal scrolling at the fixed desktop height.
- Media pixels and meters remain placeholders by design and are labeled.
