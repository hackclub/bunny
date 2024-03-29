/** @jsx JSXSlack.h **/
/** @jsxFrag JSXSlack.Fragment **/

/* ---------------------- Set up environment variables ---------------------- */

import "dotenv/config";

/* -------------------------- Import other imports -------------------------- */

import { readFileSync, writeFileSync, appendFileSync } from "fs";
import {
	AckFn,
	App,
	RespondArguments,
	RespondFn,
	SlashCommand,
} from "@slack/bolt";
import {
	Section,
	Blocks,
	JSXSlack,
	Header,
	Mrkdwn,
	Field,
	Fragment,
} from "jsx-slack";

import { LogLevel } from "@slack/bolt";
import { Match } from "@slack/web-api/dist/response/SearchMessagesResponse";
import { UsersConversationsResponse } from "@slack/web-api";

/* ----------------------- Set up bot and user clients ---------------------- */

const botApp = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	socketMode: true,
	appToken: process.env.SLACK_APP_TOKEN,
	logger: {
		debug: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[BOT ] [${Date.now()}] [DEBUG] ${JSON.stringify(msgs)}\n`
			);
		},
		info: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[BOT ] [${Date.now()}] [INFO ] ${JSON.stringify(msgs)}\n`
			);
		},
		warn: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[BOT ] [${Date.now()}] [WARN ] ${JSON.stringify(msgs)}\n`
			);
		},
		error: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[BOT ] [${Date.now()}] [ERROR] ${JSON.stringify(msgs)}\n`
			);
		},
		// This are required...but will really just be ignored
		setLevel: (level) => {},
		getLevel: () => LogLevel.DEBUG,
		setName: (name) => {},
	},
});

const userApp = new App({
	token: process.env.SLACK_USER_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	logger: {
		debug: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[USER] [${Date.now()}] [DEBUG] ${JSON.stringify(msgs)}\n`
			);
		},
		info: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[USER] [${Date.now()}] [INFO ] ${JSON.stringify(msgs)}\n`
			);
		},
		warn: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[USER] [${Date.now()}] [WARN ] ${JSON.stringify(msgs)}\n`
			);
		},
		error: (...msgs) => {
			appendFileSync(
				"logs.txt",
				`[USER] [${Date.now()}] [ERROR] ${JSON.stringify(msgs)}\n`
			);
		},
		// This are required...but will really just be ignored
		setLevel: (level) => {},
		getLevel: () => LogLevel.DEBUG,
		setName: (name) => {},
	},
});

/* --------------------------------- Run bot -------------------------------- */

(async () => {
	await botApp.start(process.env.PORT || 3000);

	/* -------------------------------------------------------------------------- */
	/*                      React to /bunny and /bunny-fresh                      */
	/* -------------------------------------------------------------------------- */

	botApp.command("/bunny", async ({ ack, command, respond }) => {
		bunnyDo(ack, command, respond, false);
	});

	botApp.command("/bunny-fresh", async ({ ack, command, respond, body }) => {
		bunnyDo(ack, command, respond, true, body.user_id);
	});

	/* ------------------- Standardize /bunny and /bunny-fresh ------------------ */

	async function bunnyDo(
		ack: AckFn<string | RespondArguments>,
		command: SlashCommand,
		respond: RespondFn,
		filterOutExistingChannels,
		userID?: string
	) {
		await ack();

		let count = 100;
		let allMessages;
		let usedChannels;

		/* --------------------- See if command text is argument -------------------- */

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

		usedChannels = await getSortedChannels(allMessages);

		if (filterOutExistingChannels)
			usedChannels = await filterSortedChannels(userID, usedChannels);

		/* ------------------ Get channel topics for top 5 channels ----------------- */

		let topFiveChannelTopics = await getChannelTopics(
			usedChannels.slice(0, 5)
		);

		/* -------------------------------- Blank UI -------------------------------- */

		const blankText =
			"There are no channels to show! Try upping the message count in your command, to search farther back.";

		const blankFilteredText =
			"There are no channels to show! Try upping the message count in your command, to search farther back. Or, perhaps you're in every channel? 😳";

		/* -------------------------------- Build UI -------------------------------- */

		const topChannelsUI = (
			<Fragment>
				<Header>Top channels</Header>

				{usedChannels.slice(0, 5).map((channel) => {
					let topicText =
						topFiveChannelTopics[usedChannels.indexOf(channel)];

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
			usedChannels.length > 5 ? (
				<Fragment>
					<Header>More channels</Header>

					<Section>
						{usedChannels.slice(5, 15).map((channel) => (
							<Field>
								<Mrkdwn raw>{"<#" + channel + ">"}</Mrkdwn>
							</Field>
						))}
					</Section>
				</Fragment>
			) : undefined;

		const evenMoreChannelsUI =
			usedChannels.length > 15 ? (
				<Fragment>
					<Header>Even more channels</Header>

					<Section>
						<Mrkdwn raw>
							{usedChannels
								.slice(15)
								.map((channel) => "<#" + channel + "> ")}
						</Mrkdwn>
					</Section>
				</Fragment>
			) : undefined;

		/* --------------------------------- Respond -------------------------------- */

		if (usedChannels.length == 0) {
			respond({
				text: filterOutExistingChannels ? blankFilteredText : blankText,
			});
		} else {
			respond({
				blocks: JSXSlack(
					<Blocks>
						{topChannelsUI}
						{moreChannelsUI}
						{evenMoreChannelsUI}
					</Blocks>
				),
			});
		}
	}

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

	console.log("⚡️ Bunny app is running!!");
})();

/* -------------------------------------------------------------------------- */
/*                             Get latest messages                            */
/* -------------------------------------------------------------------------- */

async function getLatestMessages(count: number, respond: RespondFn) {
	let allMessages;
	let query = "-is:dm";

	/* -------------------- Modify query for blocked channels ------------------- */

	let { blockedChannels } = JSON.parse(
		readFileSync("./blocklist.json", "utf8")
	);

	for (let channelID of blockedChannels) {
		query += ` -in:<#${channelID}>`;
	}

	/* ----------------------------- Get first page ----------------------------- */

	let currentMessageData = await userApp.client.search.messages({
		query,
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

/* -------------------------------------------------------------------------- */
/*                              Sort the channels                             */
/* -------------------------------------------------------------------------- */

async function getSortedChannels(messages: Match[]) {
	let channelCounts = {};
	let sortedChannels;

	messages.map((match) => {
		/* ---------------------- Ignore if not public channel ---------------------- */

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

/* -------------------------------------------------------------------------- */
/*                       Filter out channels user is in                       */
/* -------------------------------------------------------------------------- */

async function filterSortedChannels(userID: string, sortedChannels: string[]) {
	let filteredChannels = [];

	/* ------------------------- Get channels user is in ------------------------ */

	let channelsUserIsIn: string[] = [];
	let response: UsersConversationsResponse;
	let keepPaging = true;
	let cursor;

	while (keepPaging) {
		response = await botApp.client.users.conversations({
			user: userID,
			cursor,
		});

		response.channels.map((channel) => channelsUserIsIn.push(channel.id));

		if (response.response_metadata.next_cursor) {
			keepPaging = true;
			cursor = response.response_metadata.next_cursor;
		} else {
			keepPaging = false;
		}
	}

	/* --------------------- Filter out channels user is in --------------------- */

	filteredChannels = sortedChannels.filter(
		(channel) => !channelsUserIsIn.includes(channel)
	);

	return filteredChannels;
}

/* -------------------------------------------------------------------------- */
/*                Get topics array parallel to argument's array               */
/* -------------------------------------------------------------------------- */

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
