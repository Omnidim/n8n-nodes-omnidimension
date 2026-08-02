import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

// ponytail: static webhook receiver — upgrade to auto-subscribe (webhookMethods
// checkExists/create/delete) once the backend ships POST /api/v1/webhooks.
export class OmniDimensionTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OmniDimension Trigger',
		name: 'omniDimensionTrigger',
		icon: 'file:omnidimension.svg',
		group: ['trigger'],
		version: 1,
		subtitle: 'On Call Completed',
		description: 'Starts the workflow when an OmniDimension call completes',
		defaults: { name: 'OmniDimension Trigger' },
		inputs: [],
		outputs: ['main'],
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
					'Optional comma-separated list of agent (bot) IDs. Events from other agents are ignored. Leave empty to accept all.',
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
