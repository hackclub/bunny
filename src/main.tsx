/** @jsx JSXSlack.h **/
/** @jsxFrag JSXSlack.Fragment **/

/* ---------------------- Set up environment variables ---------------------- */

import "dotenv/config";

/* -------------------------- Import other imports -------------------------- */

import { App } from "@slack/bolt";
import {
	Section,
	Blocks,
	JSXSlack,
	Header,
	Mrkdwn,
	Field,
	Fragment,
} from "jsx-slack";

/* ----------------------- Set up bot and user clients ---------------------- */

const botApp = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	socketMode: true,
	appToken: process.env.SLACK_APP_TOKEN,
});

const userApp = new App({
	token: process.env.SLACK_USER_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
});

/* --------------------------------- Run bot -------------------------------- */

(async () => {
	await botApp.start(process.env.PORT || 3000);

	/* ----------------------------- React to /bunny ---------------------------- */

	botApp.command("/bunny", async ({ ack, respond }) => {
		await ack();

		let channelCounts = {};

		/* -------------------------------- Get data -------------------------------- */

		let messageData = await userApp.client.search.messages({
			query: "-is:dm",
			sort: "timestamp",
			sort_dir: "desc",
			count: 100,
		});

		/* ------------------------------ Get channels ------------------------------ */

		messageData.messages.matches.map((match) => {
			/* ---------------------- Return if not public channel ---------------------- */

			if (
				match.channel?.is_channel !== true ||
				match.channel?.is_private === true
			)
				return;

			/* -------------------------------- Otherwise ------------------------------- */

			let channelID = match.channel?.id as string;

			// If channel doesn't exist yet, add the key
			if (channelCounts[channelID] === undefined)
				channelCounts[channelID] = 0;

			// Increment the count
			channelCounts[channelID] += 1;
		});

		/* ------------------------------ Sort channels ----------------------------- */

		let sortedChannels = Object.keys(channelCounts).sort(function (a, b) {
			return channelCounts[b] - channelCounts[a];
		});

		/* ------------------ Get channel topics for top 5 channels ----------------- */

		let topFiveChannelTopics: string[] = [];

		for (const channel of sortedChannels.slice(0, 5)) {
			let topic = (
				await botApp.client.conversations.info({
					channel,
				})
			).channel.topic.value;

			topFiveChannelTopics.push(topic);
		}

		/* -------------------------------- Build UI -------------------------------- */

		const topChannelsUI = (
			<Fragment>
				<Header>Top channels</Header>
				{sortedChannels.slice(0, 5).map((channel) => {
					let topicText =
						topFiveChannelTopics[sortedChannels.indexOf(channel)];

					return (
						<Fragment>
							<Section>
								<Mrkdwn raw>
									{"*" + "<#" + channel + ">" + "*"}
								</Mrkdwn>
							</Section>
							{topicText !== "" && (
								<Section>
									<Mrkdwn raw>{topicText}</Mrkdwn>
								</Section>
							)}
						</Fragment>
					);
				})}
			</Fragment>
		);

		const moreChannelsUI = (
			<Fragment>
				<Header>More channels</Header>
				<Section>
					{sortedChannels.length > 5 &&
						sortedChannels.slice(5, 15).map((channel) => (
							<Field>
								<Mrkdwn raw>{"<#" + channel + ">"}</Mrkdwn>
							</Field>
						))}
				</Section>
			</Fragment>
		);

		const evenMoreChannelsUI = (
			<Fragment>
				<Header>Even more channels</Header>
				<Section>
					<Mrkdwn raw>
						{sortedChannels.length > 15 &&
							sortedChannels
								.slice(15)
								.map((channel) => "<#" + channel + "> ")}
					</Mrkdwn>
				</Section>
			</Fragment>
		);

		/* --------------------------------- Respond -------------------------------- */

		respond({
			blocks: JSXSlack(
				<Blocks>
					{topChannelsUI}
					{moreChannelsUI}
					{evenMoreChannelsUI}
				</Blocks>
			),
		});
	});

	console.log("⚡️ Bolt app is running!");
})();
