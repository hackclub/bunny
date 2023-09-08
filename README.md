# bunny

🐇 What's trending on Slack? With a simple slash command, Bunny reveals the most recently active channels.

## Features

-   Run `/bunny` to view channels with the most activity over the last 100 messages.
-   Run `/bunny-fresh` for a similar view that filters out channels you're in.
-   Run `/bunny-toggle #channel` to toggle if a channel appeares in Bunny results. You need to own the channel or be a Workspace Admin for this to work!

**TIP:** If you run `/bunny [number]` or `/bunny-fresh [number]`, you can search up to the last 1000 messages, to reveal more channels!

## How it works

Bunny does not keep a database of messages, or other interactions, in its Slack workspace, aside from logging messages sent to it. Instead, whenever a user asks for the latest active channels, it uses Slack's search API to find the last 100 (or more, if requested) messages.

Its search query filters out DMs and any blocked channels! Based on the search results, Bunny ranks channels in order of messages sent within them. Message reactions don't affect ranking.

If there's an error, the bot will reply to the user with it. Otherwise, it'll compose a UI & respond to the user with it! All communications from the bot to the user use ephemeral messages.

The bot is designed to be run on a simple Linux server: just open a tool like `screen`, run `npm run start`, and you should be good to go! However, other approaches can also work well. Currently, the bot is being run on Hack Club's Heroku but on the past, it was run with the example (`screen`) mentioned above!

A few other notes:

-   The list of blocked channels is kept inside `blocklist.json`.
-   With `/bunny-fresh`, the bot checks what channels the user who called the command is in. While blocked channels are filtered out from the original search query, _these_ channels are instead filtered from the search _results_. In effect, this means Bunny won't surface as many channels if you're already in most of them. This is a design decision that could be changed!

## Maintenance

The whole bot exists inside `main.tsx`. Imports and setup are at the top, followed by the main "control flow" of the bot. At the bottom are helper functions. Note that almost all functions are asynchronous!

The library `jsx-slack` is used to code the bot's UI. The JSX-like syntax makes using Block Kit much easier, if you're familiar with JSX-style syntax :))

I would suggest keeping the code clean, as it makes maintenance much easier! VS Code lets you auto-format on save. Select Prettier as your formatter. In addition, the [Comment Divider](https://marketplace.visualstudio.com/items?itemName=stackbreak.comment-divider) extension was used heavily in `main.tsx` to establish a visual hierarchy between and inside blocks of code, making it easier to read! Ultimately, feel free to use whatever approach is best :)

## Setup

This bot uses both a bot token and a user token to run.

**Warning:** To get a user token, the app will be authorized to _act_ as a certain Slack user. This user token is important because it enables the searching functionality that underpins Bunny. However, the bot will be able to read **all** of the user's messages, including _private messages_ 😳. I strongly recommend creating a new, separate user account for this bot to use.

Environment variables:

-   `SLACK_BOT_TOKEN` - Bot token for Slack app
-   `SLACK_USER_TOKEN` - User token for Slack app
-   `SLACK_APP_TOKEN` - App token for Slack app (because socket mode!)
-   `SLACK_SIGNING_SECRET` — Signing secret for Slack app

## Misc

Inspired (especially UI-wise) by [Paul Bunyan](https://github.com/hackclub/bunyan).
