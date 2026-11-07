# Facebook chat on the stream (Pages only)

Facebook gives apps live comments for **Pages**. It does not for personal profiles, so a stream
to a profile cannot show chat on screen.

## Get a Page token (once)

1. Go to developers.facebook.com, create an app (type "Business" or "Other"). Development mode is
   enough because you are the app admin and the Page admin.
2. Open the Graph API Explorer, pick your app, choose "Get Page Access Token", select your Page.
3. Ask for these permissions: `pages_show_list`, `pages_read_engagement`,
   `pages_read_user_content`. (Facebook can change what it asks for; if PulseCast says a permission
   is missing, add the one it names.)
4. Turn the short token into a long-lived one (Access Token Debugger, "Extend Access Token").
   A Page token made from a long-lived user token does not expire.
5. In PulseCast Studio, open CHAT, paste the token, press Save. It is stored encrypted with Windows
   secure storage and is never shown again.

## Use

- Tick Facebook as a destination, add a "+ Chat" source, press Go live. PulseCast connects to the
  Page's live video by itself and follows it if the stream drops.
- Twitch chat and Facebook chat feed the same Chat source.

## Status

The reader is covered by unit tests against a fake Graph API. It has **not** been run against the
real Facebook Graph API yet (proof level: `simulated`). The first real run decides whether the
permission list above is complete.
