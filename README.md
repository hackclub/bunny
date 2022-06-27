# bunny

🐇 What's trending on your Slack? Bunny lets you see the most active channels, with a simple slash command.

## Features

-   Run `/bunny` to see which channels were talked in the most over the last 100 messages.
-   Run `/bunny [number]` (like `/bunny 200`) for a broader scope.
-   Run `/bunny-toggle #channel` to enable/disable a channel's presence in Bunny
-   `/bunny-toggle` usage is limited to Workspace Admins and whoever owns the specified channel

## Setup

This bot uses both a bot token and a user token to run.

**Caution:** If you authorize this app with an account, it will be able to read all your messages, including private messages. I recommend authorizing this app with an alternate account.

Environment variables:

-   `SLACK_BOT_TOKEN` - Bot token for Slack app
-   `SLACK_USER_TOKEN` - User token for Slack app
-   `SLACK_APP_TOKEN` - App token for Slack app (because socket mode!)
-   `SLACK_SIGNING_SECRET`

## Misc

Inspired (especially UI-wise) by [Paul Bunyan](https://github.com/hackclub/bunyan).
