/** @jsx JSXSlack.h **/
/** @jsxFrag JSXSlack.Fragment **/

/* ---------------------- Set up environment variables ---------------------- */

import "dotenv/config";

/* -------------------------- Import other imports -------------------------- */

import { readFileSync, writeFileSync } from "fs";
import { App, RespondFn } from "@slack/bolt";
import {
	Section,
	Blocks,
	JSXSlack,
	Header,
	Mrkdwn,
	Field,
	Fragment,
} from "jsx-slack";

import { Match } from "@slack/web-api/dist/response/SearchMessagesResponse";

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

	/* -------------------------------------------------------------------------- */
	/*                               React to /bunny                              */
	/* -------------------------------------------------------------------------- */

	botApp.command("/bunny", async ({ ack, command, respond }) => {
		await ack();

		let count = 100;
		let allMessages;
		let sortedChannels;

		/* -------------------------- Process command text -------------------------- */

		if (command.text && !isNaN(parseInt(command.text))) {
			count = parseInt(command.text);
		}

		/* ------------------------ Reject count beyond 5000 ------------------------ */

		if (count > 1000) {
			respond({
				text: `Sorry, ${count} is a bit excessive. Try 1000 or lower?`,
			});
			return;
		}

		/* -------------------------------- Get data -------------------------------- */

		allMessages = await getLatestMessages(count, respond);

		/* ------------------------------ Get channels ------------------------------ */

		sortedChannels = await getSortedChannels(allMessages);

		/* ------------------ Get channel topics for top 5 channels ----------------- */

		let topFiveChannelTopics = await getChannelTopics(
			sortedChannels.slice(0, 5)
		);

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

		const moreChannelsUI =
			sortedChannels.length > 5 ? (
				<Fragment>
					<Header>More channels</Header>

					<Section>
						{sortedChannels.slice(5, 15).map((channel) => (
							<Field>
								<Mrkdwn raw>{"<#" + channel + ">"}</Mrkdwn>
							</Field>
						))}
					</Section>
				</Fragment>
			) : undefined;

		const evenMoreChannelsUI =
			sortedChannels.length > 15 ? (
				<Fragment>
					<Header>Even more channels</Header>

					<Section>
						<Mrkdwn raw>
							{sortedChannels
								.slice(15)
								.map((channel) => "<#" + channel + "> ")}
						</Mrkdwn>
					</Section>
				</Fragment>
			) : undefined;

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

	/* -------------------------------------------------------------------------- */
	/*                           React to /bunny-toggle                           */
	/* -------------------------------------------------------------------------- */

	botApp.command("/bunny-toggle", async ({ ack, body, respond }) => {
		ack();

		const channelRegex = /(?<=<#).*?((?=>)|(?=\|))/;
		const channelRegexMatches = channelRegex.exec(body.text);

		if (channelRegexMatches === null) {
			respond("That channel doesn't appear to exist.");
			return;
		}

		const channelID = channelRegexMatches[0];
		const userID = body.user_id;

		/* ---------------------------- Check if allowed ---------------------------- */

		let isUserOwner =
			(await botApp.client.conversations.info({ channel: channelID }))
				.channel.creator === userID;

		let isUserAdmin = (await botApp.client.users.info({ user: userID }))
			.user.is_admin;

		/* -------------------------- If not allowed, deny -------------------------- */

		if (!isUserOwner && !isUserAdmin) {
			respond({
				text: "Only the channel owner or a Workspace Admin can run this command.",
			});
			return;
		}

		/* -------------------------- If allowed, do action ------------------------- */

		let { blockedChannels } = JSON.parse(
			readFileSync("./blocklist.json", "utf8")
		);

		if (blockedChannels.includes(channelID)) {
			blockedChannels.splice(blockedChannels.indexOf(channelID), 1);
			respond({ text: `<#${channelID}> is now unblocked!` });
		} else {
			blockedChannels.push(channelID);
			respond({ text: `<#${channelID}> is now blocked!` });
		}

		writeFileSync("./blocklist.json", JSON.stringify({ blockedChannels }));
	});

	console.log("⚡️ Bolt app is running!");
})();

/* -------------------------------------------------------------------------- */
/*                             Get latest messages                            */
/* -------------------------------------------------------------------------- */

async function getLatestMessages(count: number, respond: RespondFn) {
	let allMessages;

	/* ----------------------------- Get first page ----------------------------- */

	let currentMessageData = await userApp.client.search.messages({
		query: "-is:dm",
		sort: "timestamp",
		sort_dir: "desc",
		count: count <= 100 ? count : 100,
	});

	allMessages = currentMessageData.messages.matches;

	/* ---------------------- Paginate, if there are pages ---------------------- */

	// I hope that one of these days, Slack adds cursor-based
	// pagination to search.messages :,)

	if (allMessages.length < count) {
		respond({
			text: `Due to requesting >100 messages, this may take some time... (expected: ${Math.floor(
				(count / 100) * 1.25
			)}-${Math.ceil((count / 100) * 1.75)} seconds)`,
		});
	}

	while (allMessages.length < count) {
		currentMessageData = await userApp.client.search.messages({
			query: "-is:dm",
			sort: "timestamp",
			sort_dir: "desc",
			count: 100,
			page: currentMessageData.messages.pagination.page + 1,
		});

		/* ------------ If <20 more messages are needed, slice the array ------------ */

		if (count - allMessages.length < 20) {
			allMessages.push(
				...currentMessageData.messages.matches.slice(
					0,
					allMessages.length - count
				)
			);
		} else {
			allMessages.push(...currentMessageData.messages.matches);
		}

		/* ---------------------- Sleep, to avoid rate limiting --------------------- */

		await new Promise((resolve) => setTimeout(resolve, 1500));
	}

	return allMessages;
}

async function getSortedChannels(messages: Match[]) {
	let channelCounts = {};
	let sortedChannels;

	messages.map((match) => {
		/* ---------------------- Return if not public channel ---------------------- */

		if (
			match.channel.is_channel !== true ||
			match.channel.is_private === true
		)
			return;

		/* -------------------------- Otherwise, process it ------------------------- */

		let channelID = match.channel.id as string;

		// If channel doesn't exist yet, add the key
		if (channelCounts[channelID] === undefined)
			channelCounts[channelID] = 0;

		// Increment the count
		channelCounts[channelID] += 1;
	});

	/* ------------------------------ Sort channels ----------------------------- */

	sortedChannels = Object.keys(channelCounts).sort(function (a, b) {
		return channelCounts[b] - channelCounts[a];
	});

	/* ----------------------------- Return results ----------------------------- */

	return sortedChannels;
}

async function getChannelTopics(channels: string[]) {
	let topics: string[] = [];

	for (const channel of channels) {
		let topic = (
			await botApp.client.conversations.info({
				channel,
			})
		).channel.topic.value;

		topics.push(topic);
	}

	return topics;
}
