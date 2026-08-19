import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

// Verify-only webhook lifecycle: the destination URL is set on the agent's
// Post-Call tab in the dashboard, so create() only confirms it is wired and
// never writes it. Writing it from here would mean PUT /agents/{id} with
// post_call_actions, which replaces every post-call action on the agent and
// would silently delete the user's other notifications.
export class OmniDimensionTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OmniDimension Trigger',
		name: 'omniDimensionTrigger',
		icon: { light: 'file:omnidimension.svg', dark: 'file:omnidimension.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'On Call Completed',
		description: 'Starts the workflow when an OmniDimension call completes',
		defaults: { name: 'OmniDimension Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'omniDimensionApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Copy this node\'s webhook URL, then in the OmniDimension dashboard open your agent → Post-Call tab → delivery method "Webhook" and paste the URL. Use the Test URL while building, the Production URL once the workflow is active.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Agent IDs',
				name: 'agentIds',
				type: 'string',
				default: '',
				placeholder: '42, 43',
				description:
					'Comma-separated agent (bot) IDs. Events from other agents are ignored, and activating the workflow checks that each agent really has this webhook URL configured. Leave empty to accept every agent and skip that check.',
			},
			{
				displayName: 'Call Statuses',
				name: 'callStatuses',
				type: 'multiOptions',
				options: [
					{ name: 'Busy', value: 'busy' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'No Answer', value: 'no_answer' },
					{ name: 'Voicemail Detected', value: 'voicemail_detected' },
				],
				default: [],
				description:
					'Only fire for these call statuses. Empty = all. The agent\'s Post-Call config must also have these statuses enabled, or OmniDimension never sends them.',
			},
		],
	};

	webhookMethods = {
		default: {
			// Reads each configured agent and reports whether it already posts to this
			// node's URL. With no agent IDs there is nothing to look up, so report
			// configured and let events flow.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const missing = await findAgentsMissingWebhook.call(this);
				return missing.length === 0;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const missing = await findAgentsMissingWebhook.call(this);
				if (!missing.length) return true;

				const webhookUrl = this.getNodeWebhookUrl('default');
				throw new NodeOperationError(
					this.getNode(),
					`Agent ${missing.join(', ')} is not sending calls to this workflow yet`,
					{
						description: `In the OmniDimension dashboard open each agent → Post-Call tab, set the delivery method to Webhook, and paste this URL: ${webhookUrl}. Then activate the workflow again. To skip this check, clear the Agent IDs field.`,
					},
				);
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				// Nothing was registered remotely, so there is nothing to clean up. The
				// URL stays on the agent until the user removes it in the dashboard.
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;

		const agentIdsRaw = this.getNodeParameter('agentIds', '') as string;
		if (agentIdsRaw.trim()) {
			const allowed = agentIdsRaw.split(',').map((s) => s.trim());
			if (!allowed.includes(String(body.bot_id))) {
				// ack with 200 so OmniDimension doesn't retry, but don't start the workflow
				return {};
			}
		}

		const statuses = this.getNodeParameter('callStatuses', []) as string[];
		if (statuses.length && !statuses.includes(String(body.call_status))) {
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray([body])],
		};
	}
}

async function findAgentsMissingWebhook(this: IHookFunctions): Promise<string[]> {
	const agentIdsRaw = this.getNodeParameter('agentIds', '') as string;
	if (!agentIdsRaw.trim()) return [];

	const webhookUrl = normalize(this.getNodeWebhookUrl('default') ?? '');
	if (!webhookUrl) return [];

	const credentials = await this.getCredentials('omniDimensionApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	const missing: string[] = [];

	for (const agentId of agentIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
		let agent: IDataObject;
		try {
			agent = await this.helpers.httpRequestWithAuthentication.call(this, 'omniDimensionApi', {
				method: 'GET',
				url: `${baseUrl}/agents/${agentId}`,
				json: true,
			});
		} catch {
			// Never block activation because the lookup itself failed.
			continue;
		}

		const configs = (agent.post_call_config_ids as IDataObject[]) ?? [];
		const wired = configs.some(
			(config) =>
				config.delivery_method === 'Webhook' &&
				normalize(String(config.webhook_url ?? '')) === webhookUrl,
		);
		if (!wired) missing.push(agentId);
	}

	return missing;
}
