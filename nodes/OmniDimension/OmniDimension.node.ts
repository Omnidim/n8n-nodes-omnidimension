import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

async function omniRequest(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await ctx.getCredentials('omniDimensionApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	return ctx.helpers.httpRequestWithAuthentication.call(ctx, 'omniDimensionApi', {
		method,
		url: `${baseUrl}${path}`,
		body,
		qs,
		json: true,
	});
}

// Response arrays that should become one n8n item each, keyed by resource:operation.
const LIST_KEYS: Record<string, string> = {
	'agent:getAll': 'bots',
	'bulkCall:getAll': 'records',
	'call:getAllLogs': 'call_log_data',
	'call:getLog': 'call_log_data',
	'knowledgeBase:getAll': 'files',
	'phoneNumber:getAll': 'phone_numbers',
};

// Several OmniDimension endpoints report failures with HTTP 200 and an error-shaped
// body, so relying on the HTTP status alone would pass a silent failure downstream.
export function assertNoApiError(
	ctx: IExecuteFunctions,
	response: IDataObject,
	itemIndex: number,
): void {
	if (response?.status !== 'error' && response?.success !== false) return;
	const message =
		(response.message as string) ||
		(response.error_description as string) ||
		(response.error as string) ||
		'The OmniDimension API returned an error';
	throw new NodeOperationError(ctx.getNode(), message, { itemIndex });
}

function toId(
	ctx: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new NodeOperationError(
			ctx.getNode(),
			`${fieldName} must be a numeric ID, but got "${value}"`,
			{ itemIndex },
		);
	}
	return parsed;
}

export class OmniDimension implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OmniDimension',
		name: 'omniDimension',
		icon: { light: 'file:omnidimension.svg', dark: 'file:omnidimension.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with OmniDimension voice AI agents',
		defaults: { name: 'OmniDimension' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'omniDimensionApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Agent', value: 'agent' },
					{ name: 'Bulk Call', value: 'bulkCall' },
					{ name: 'Call', value: 'call' },
					{ name: 'Knowledge Base', value: 'knowledgeBase' },
					{ name: 'Phone Number', value: 'phoneNumber' },
				],
				default: 'call',
			},

			// ----------------------------- agent -----------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['agent'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create an agent',
						description: 'Create a new voice agent',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get an agent',
						description: 'Get one agent with its full configuration',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many agents',
						description: 'List agents in the account',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents' },
				displayOptions: { show: { resource: ['agent'], operation: ['get'] } },
				default: '',
				required: true,
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				default: '',
				required: true,
				description: 'Name of the new agent',
			},
			{
				displayName: 'Context Breakdown',
				name: 'contextBreakdown',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				default: {
					sections: [{ title: 'Purpose', body: 'You are a helpful voice assistant.' }],
				},
				required: true,
				placeholder: 'Add Section',
				description:
					'The agent\'s instructions, split into titled sections (persona, purpose, rules, FAQ, …)',
				options: [
					{
						displayName: 'Section',
						name: 'sections',
						values: [
							{
								displayName: 'Title',
								name: 'title',
								type: 'string',
								default: '',
								placeholder: 'Purpose',
							},
							{
								displayName: 'Body',
								name: 'body',
								type: 'string',
								typeOptions: { rows: 4 },
								default: '',
								placeholder: 'You are a friendly sales assistant for…',
							},
						],
					},
				],
			},
			{
				displayName: 'Welcome Message',
				name: 'welcomeMessage',
				type: 'string',
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				default: '',
				placeholder: 'Hi, this is Alex from OmniDimension!',
				description: 'The first thing the agent says on a call',
			},
			{
				displayName: 'Call Type',
				name: 'callType',
				type: 'options',
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				options: [
					{ name: 'Incoming', value: 'Incoming' },
					{ name: 'Outgoing', value: 'Outgoing' },
				],
				default: 'Outgoing',
				description: 'Whether the agent handles inbound or outbound calls',
			},
			{
				displayName: 'Additional Fields',
				name: 'agentAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				default: {},
				options: [
					{
						displayName: 'Allow Interruption',
						name: 'is_interruption_allowed',
						type: 'boolean',
						default: true,
						description: 'Whether the caller can interrupt the agent while it speaks',
					},
					{
						displayName: 'Dynamic Welcome Message',
						name: 'is_welcome_message_dynamic',
						type: 'boolean',
						default: false,
						description: 'Whether to generate the welcome message dynamically per call',
					},
					{
						displayName: 'LLM Model',
						name: 'modelName',
						type: 'string',
						default: '',
						placeholder: 'gpt-4o, claude-3-5-sonnet-latest, gemini-2.5-flash…',
						description: 'Which LLM powers the agent. See docs for the current list.',
					},
					{
						displayName: 'LLM Temperature',
						name: 'modelTemperature',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
						default: 0.7,
					},
					{
						displayName: 'Voice ID',
						name: 'voiceId',
						type: 'string',
						default: '',
						description:
							'Provider-specific voice ID. Browse voices with GET /providers/voices or in the dashboard.',
					},
					{
						displayName: 'Voice Provider',
						name: 'voiceProvider',
						type: 'string',
						default: '',
						placeholder: 'eleven_labs, deepgram, cartesia, google…',
					},
					{
						displayName: 'Voice Speed',
						name: 'voiceSpeed',
						type: 'number',
						typeOptions: { minValue: 0.5, maxValue: 2, numberPrecision: 2 },
						default: 1,
						description: 'Speech speed multiplier',
					},
				],
			},
			{
				displayName: 'Advanced Configuration (JSON)',
				name: 'agentAdvanced',
				type: 'json',
				displayOptions: { show: { resource: ['agent'], operation: ['create'] } },
				default: '{}',
				description:
					'Any other agent settings merged into the request as-is: transcriber, post_call_actions, web_search, filler, background_track, voicemail, end_call. See https://docs.omnidim.io/docs/api-reference.',
			},
			{
				displayName: 'Filters',
				name: 'agentFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				displayOptions: { show: { resource: ['agent'], operation: ['getAll'] } },
				default: {},
				options: [
					{
						displayName: 'Name Contains',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Filter agents by name substring',
					},
					{
						displayName: 'Page',
						name: 'pageno',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
					},
					{
						displayName: 'Page Size',
						name: 'pagesize',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 150 },
						default: 30,
					},
				],
			},

			// --------------------------- bulk call ---------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['bulkCall'] } },
				options: [
					{
						name: 'Add Contact',
						value: 'addContact',
						action: 'Add a contact to a campaign',
						description: 'Push a contact into a dynamic campaign queue',
					},
					{
						name: 'Cancel',
						value: 'cancel',
						action: 'Cancel a bulk call campaign',
					},
					{
						name: 'Create',
						value: 'create',
						action: 'Create a bulk call campaign',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a bulk call campaign',
						description: 'Get campaign details',
					},
					{
						name: 'Get Live Status',
						value: 'getLiveStatus',
						action: 'Get live status of a campaign',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many bulk call campaigns',
					},
					{
						name: 'Pause',
						value: 'pause',
						action: 'Pause a campaign',
					},
					{
						name: 'Reschedule',
						value: 'reschedule',
						action: 'Reschedule a campaign',
					},
					{
						name: 'Resume',
						value: 'resume',
						action: 'Resume a campaign',
					},
				],
				default: 'addContact',
			},
			{
				displayName: 'Campaign Name or ID',
				name: 'campaignId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getBulkCalls' },
				displayOptions: {
					show: {
						resource: ['bulkCall'],
						operation: [
							'addContact',
							'cancel',
							'get',
							'getLiveStatus',
							'pause',
							'reschedule',
							'resume',
						],
					},
				},
				default: '',
				required: true,
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['create'] } },
				default: '',
				required: true,
				description: 'Name of the campaign',
			},
			{
				displayName: 'Phone Number Name or ID',
				name: 'phoneNumberId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPhoneNumbers' },
				displayOptions: { show: { resource: ['bulkCall'], operation: ['create'] } },
				default: '',
				required: true,
				description:
					'Number the campaign calls from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Dynamic Campaign',
				name: 'isDynamic',
				type: 'boolean',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['create'] } },
				default: true,
				description:
					'Whether contacts are pushed in over time via Add Contact (dynamic) instead of a fixed upfront list',
			},
			{
				displayName: 'Contacts (JSON)',
				name: 'contactList',
				type: 'json',
				displayOptions: {
					show: { resource: ['bulkCall'], operation: ['create'], isDynamic: [false] },
				},
				default: '[]',
				description:
					'Upfront contact list for a static campaign, e.g. [{"to_number": "+15551234567", "custom_variables": {"name": "Ravi"}}]',
			},
			{
				displayName: 'Additional Fields',
				name: 'bulkCallOptions',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['create'] } },
				default: {},
				options: [
					{
						displayName: 'Concurrent Call Limit',
						name: 'concurrent_call_limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'How many calls the campaign runs in parallel',
					},
					{
						displayName: 'Enable Reschedule',
						name: 'enabled_reschedule_call',
						type: 'boolean',
						default: false,
						description: 'Whether the agent can reschedule calls with the contact',
					},
					{
						displayName: 'Retry Config (JSON)',
						name: 'retry_config',
						type: 'json',
						default: '{}',
						description: 'E.g. {"auto_retry": true, "auto_retry_schedule": "after_1_hour", "retry_limit": 2}.',
					},
					{
						displayName: 'Scheduled',
						name: 'is_scheduled',
						type: 'boolean',
						default: false,
						description: 'Whether the campaign starts at a scheduled time instead of immediately',
					},
					{
						displayName: 'Scheduled Datetime',
						name: 'scheduled_datetime',
						type: 'string',
						default: '',
						placeholder: '2026-08-05 15:00:00',
					},
					{
						displayName: 'Timezone',
						name: 'timezone',
						type: 'string',
						default: '',
						placeholder: 'America/New_York',
					},
				],
			},
			{
				displayName: 'To Number',
				name: 'toNumber',
				type: 'string',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['addContact'] } },
				default: '',
				required: true,
				placeholder: '+15551234567',
				description: 'Contact number in E.164 format. The campaign must be dynamic.',
			},
			{
				displayName: 'Custom Variables (JSON)',
				name: 'customVariables',
				type: 'json',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['addContact'] } },
				default: '{}',
				description: 'Key-value context passed to the agent for this contact',
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['addContact'] } },
				default: '{}',
				description: 'Your own tracking data. Not passed to the agent.',
			},
			{
				displayName: 'New Scheduled Datetime',
				name: 'newScheduledDatetime',
				type: 'string',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['reschedule'] } },
				default: '',
				required: true,
				placeholder: '2026-08-05 15:00:00',
				description: 'New start time for the campaign',
			},
			{
				displayName: 'New Timezone',
				name: 'newTimezone',
				type: 'string',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['reschedule'] } },
				default: '',
				placeholder: 'America/New_York',
			},
			{
				displayName: 'Filters',
				name: 'bulkCallFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				displayOptions: { show: { resource: ['bulkCall'], operation: ['getAll'] } },
				default: {},
				options: [
					{
						displayName: 'Page',
						name: 'pageno',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
					},
					{
						displayName: 'Page Size',
						name: 'pagesize',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 150 },
						default: 10,
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'string',
						default: '',
						description: 'Filter campaigns by status, e.g. in_progress, completed',
					},
				],
			},

			// ----------------------------- call -----------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['call'] } },
				options: [
					{
						name: 'Dispatch',
						value: 'dispatch',
						action: 'Dispatch a call',
						description: 'Place an outbound call with an agent',
					},
					{
						name: 'Get Log',
						value: 'getLog',
						action: 'Get a call log',
						description: 'Get one call log (transcript, sentiment, extracted variables)',
					},
					{
						name: 'Get Many Logs',
						value: 'getAllLogs',
						action: 'Get many call logs',
						description: 'List call logs in the account',
					},
				],
				default: 'dispatch',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents' },
				displayOptions: { show: { resource: ['call'], operation: ['dispatch'] } },
				default: '',
				required: true,
				description:
					'Agent that makes the call. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'To Number',
				name: 'toNumber',
				type: 'string',
				displayOptions: { show: { resource: ['call'], operation: ['dispatch'] } },
				default: '',
				required: true,
				placeholder: '+15551234567',
				description: 'Destination number in E.164 format (leading +, country code)',
			},
			{
				displayName: 'From Number Name or ID',
				name: 'fromNumberId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPhoneNumbers' },
				displayOptions: { show: { resource: ['call'], operation: ['dispatch'] } },
				default: '',
				description:
					'Number to call from. Leave empty to use the agent\'s default. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Call Context (JSON)',
				name: 'callContext',
				type: 'json',
				displayOptions: { show: { resource: ['call'], operation: ['dispatch'] } },
				default: '{}',
				description:
					'Key-value context passed to the agent for this call, e.g. {"name": "Ravi", "order_id": "1234"}',
			},
			{
				displayName: 'Call Log ID',
				name: 'callLogId',
				type: 'string',
				displayOptions: { show: { resource: ['call'], operation: ['getLog'] } },
				default: '',
				required: true,
			},
			{
				displayName: 'Filters',
				name: 'callLogFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				displayOptions: { show: { resource: ['call'], operation: ['getAllLogs'] } },
				default: {},
				options: [
					{
						displayName: 'Page',
						name: 'pageno',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
					},
					{
						displayName: 'Page Size',
						name: 'pagesize',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 150 },
						default: 30,
					},
				],
			},

			// ------------------------- knowledge base -------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['knowledgeBase'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many knowledge base files',
						description: 'List knowledge base files',
					},
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload a knowledge base file',
						description: 'Upload a PDF to the knowledge base',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				displayOptions: { show: { resource: ['knowledgeBase'], operation: ['upload'] } },
				default: 'data',
				required: true,
				hint: 'The name of the input binary field containing the PDF',
			},
			{
				displayName: 'File Name',
				name: 'filename',
				type: 'string',
				displayOptions: { show: { resource: ['knowledgeBase'], operation: ['upload'] } },
				default: '',
				placeholder: 'document.pdf',
				description: 'Overrides the binary file name. Must end in .pdf.',
			},

			// -------------------------- phone number --------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['phoneNumber'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many phone numbers',
						description: 'List phone numbers in the account',
					},
				],
				default: 'getAll',
			},
		],
	};

	methods = {
		loadOptions: {
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await omniRequest(this, 'GET', '/agents', undefined, {
					pageno: 1,
					pagesize: 150,
				});
				const bots = (response.bots as IDataObject[]) ?? [];
				return bots.map((bot) => ({
					name: String(bot.name ?? bot.id),
					value: String(bot.id),
				}));
			},
			async getBulkCalls(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await omniRequest(this, 'GET', '/calls/bulk_call', undefined, {
					pageno: 1,
					pagesize: 150,
				});
				const records = (response.records as IDataObject[]) ?? [];
				return records.map((c) => ({
					name: String(c.name ?? c.id),
					value: String(c.id),
				}));
			},
			async getPhoneNumbers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await omniRequest(this, 'GET', '/phone_number/list', undefined, {
					pageno: 1,
					pagesize: 150,
				});
				const numbers = (response.phone_numbers as IDataObject[]) ?? [];
				return numbers.map((n) => ({
					name: n.name ? `${n.phone_number} (${n.name})` : String(n.phone_number),
					value: String(n.id),
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let response: IDataObject;

				if (resource === 'agent' && operation === 'getAll') {
					const filters = this.getNodeParameter('agentFilters', i, {}) as IDataObject;
					response = await omniRequest(this, 'GET', '/agents', undefined, filters);
				} else if (resource === 'agent' && operation === 'get') {
					const agentId = this.getNodeParameter('agentId', i) as string;
					response = await omniRequest(this, 'GET', `/agents/${agentId}`);
				} else if (resource === 'agent' && operation === 'create') {
					const sections = this.getNodeParameter('contextBreakdown.sections', i, []) as IDataObject[];
					const filledSections = sections.filter((s) => String(s.body ?? '').trim());
					if (!filledSections.length) {
						throw new NodeOperationError(
							this.getNode(),
							'Add at least one Context Breakdown section with a body. This is the agent\'s instructions and OmniDimension requires it.',
							{ itemIndex: i },
						);
					}
					const body: IDataObject = {
						name: this.getNodeParameter('name', i) as string,
						context_breakdown: filledSections.map((s) => ({
							title: s.title,
							body: s.body,
							is_enabled: true,
						})),
					};
					const welcomeMessage = this.getNodeParameter('welcomeMessage', i, '') as string;
					if (welcomeMessage) body.welcome_message = welcomeMessage;
					const callType = this.getNodeParameter('callType', i, '') as string;
					if (callType) body.call_type = callType;

					const extra = this.getNodeParameter('agentAdditionalFields', i, {}) as IDataObject;
					if (extra.is_interruption_allowed !== undefined)
						body.is_interruption_allowed = extra.is_interruption_allowed;
					if (extra.is_welcome_message_dynamic !== undefined)
						body.is_welcome_message_dynamic = extra.is_welcome_message_dynamic;
					if (extra.modelName || extra.modelTemperature !== undefined) {
						body.model = {
							...(extra.modelName ? { model: extra.modelName } : {}),
							...(extra.modelTemperature !== undefined
								? { temperature: extra.modelTemperature }
								: {}),
						};
					}
					if (extra.voiceProvider || extra.voiceId || extra.voiceSpeed !== undefined) {
						body.voice = {
							...(extra.voiceProvider ? { provider: extra.voiceProvider } : {}),
							...(extra.voiceId ? { voice_id: extra.voiceId } : {}),
							...(extra.voiceSpeed !== undefined ? { speech_speed: extra.voiceSpeed } : {}),
						};
					}
					Object.assign(body, parseJsonParameter(this, 'agentAdvanced', i));
					response = await omniRequest(this, 'POST', '/agents/create', body);
				} else if (resource === 'bulkCall' && operation === 'create') {
					const options = this.getNodeParameter('bulkCallOptions', i, {}) as IDataObject;
					if (typeof options.retry_config === 'string') {
						options.retry_config = JSON.parse((options.retry_config as string) || '{}');
					}
					const body: IDataObject = {
						name: this.getNodeParameter('name', i) as string,
						phone_number_id: this.getNodeParameter('phoneNumberId', i) as string,
						is_dynamic: this.getNodeParameter('isDynamic', i) as boolean,
						...options,
					};
					if (!body.is_dynamic) {
						const contacts = this.getNodeParameter('contactList', i, '[]');
						body.contact_list =
							typeof contacts === 'string' ? JSON.parse(contacts || '[]') : contacts;
					}
					response = await omniRequest(this, 'POST', '/calls/bulk_call/create', body);
				} else if (resource === 'bulkCall' && operation === 'addContact') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = await omniRequest(this, 'POST', `/calls/bulk_call/${campaignId}/add_contact`, {
						to_number: this.getNodeParameter('toNumber', i) as string,
						custom_variables: parseJsonParameter(this, 'customVariables', i),
						metadata: parseJsonParameter(this, 'metadata', i),
					});
				} else if (resource === 'bulkCall' && operation === 'getAll') {
					const filters = this.getNodeParameter('bulkCallFilters', i, {}) as IDataObject;
					response = await omniRequest(this, 'GET', '/calls/bulk_call', undefined, filters);
				} else if (resource === 'bulkCall' && operation === 'get') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = await omniRequest(this, 'GET', `/calls/bulk_call/${campaignId}`);
				} else if (resource === 'bulkCall' && operation === 'getLiveStatus') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					// note: this endpoint uses hyphens and no /calls prefix, unlike its siblings
					response = await omniRequest(this, 'GET', `/bulk-call/${campaignId}/live-status`);
				} else if (resource === 'bulkCall' && (operation === 'pause' || operation === 'resume')) {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = await omniRequest(this, 'PUT', `/calls/bulk_call/${campaignId}`, {
						action: operation,
					});
				} else if (resource === 'bulkCall' && operation === 'reschedule') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const body: IDataObject = {
						action: 'reschedule',
						new_scheduled_datetime: this.getNodeParameter('newScheduledDatetime', i) as string,
					};
					const newTimezone = this.getNodeParameter('newTimezone', i, '') as string;
					if (newTimezone) body.new_timezone = newTimezone;
					response = await omniRequest(this, 'PUT', `/calls/bulk_call/${campaignId}`, body);
				} else if (resource === 'bulkCall' && operation === 'cancel') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = await omniRequest(this, 'DELETE', `/calls/bulk_call/${campaignId}`);
				} else if (resource === 'call' && operation === 'dispatch') {
					const body: IDataObject = {
						agent_id: toId(this, this.getNodeParameter('agentId', i), 'Agent', i),
						to_number: this.getNodeParameter('toNumber', i) as string,
						call_context: parseJsonParameter(this, 'callContext', i),
					};
					const fromNumberId = this.getNodeParameter('fromNumberId', i, '') as string;
					if (fromNumberId) {
						body.from_number_id = toId(this, fromNumberId, 'From Number', i);
					}
					response = await omniRequest(this, 'POST', '/calls/dispatch', body);
				} else if (resource === 'call' && operation === 'getLog') {
					const callLogId = this.getNodeParameter('callLogId', i) as string;
					response = await omniRequest(this, 'GET', `/calls/logs/${callLogId}`);
					if (!(response.call_log_data as IDataObject[])?.length) {
						throw new NodeOperationError(
							this.getNode(),
							`No call log found with ID "${callLogId}"`,
							{ itemIndex: i },
						);
					}
				} else if (resource === 'call' && operation === 'getAllLogs') {
					const filters = this.getNodeParameter('callLogFilters', i, {}) as IDataObject;
					response = await omniRequest(this, 'GET', '/calls/logs', undefined, filters);
				} else if (resource === 'knowledgeBase' && operation === 'getAll') {
					response = await omniRequest(this, 'GET', '/knowledge_base/list');
				} else if (resource === 'knowledgeBase' && operation === 'upload') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
					const filename =
						(this.getNodeParameter('filename', i, '') as string) ||
						binaryData.fileName ||
						'document.pdf';
					if (!filename.toLowerCase().endsWith('.pdf')) {
						throw new NodeOperationError(
							this.getNode(),
							'OmniDimension knowledge base only accepts PDF files',
							{ itemIndex: i },
						);
					}
					response = await omniRequest(this, 'POST', '/knowledge_base/create', {
						file: buffer.toString('base64'),
						filename,
					});
				} else if (resource === 'phoneNumber' && operation === 'getAll') {
					response = await omniRequest(this, 'GET', '/phone_number/list');
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${operation}" for resource "${resource}"`,
						{ itemIndex: i },
					);
				}

				assertNoApiError(this, response, i);

				const records = response[LIST_KEYS[`${resource}:${operation}`]];
				if (Array.isArray(records)) {
					for (const record of records) {
						returnData.push({ json: record as IDataObject, pairedItem: { item: i } });
					}
				} else {
					returnData.push({ json: response, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeOperationError || error instanceof NodeApiError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

function parseJsonParameter(ctx: IExecuteFunctions, name: string, itemIndex: number): IDataObject {
	const raw = ctx.getNodeParameter(name, itemIndex, '{}');
	if (typeof raw === 'object' && raw !== null) return raw as IDataObject;
	try {
		return JSON.parse((raw as string) || '{}');
	} catch {
		throw new NodeOperationError(ctx.getNode(), `Parameter "${name}" is not valid JSON`, {
			itemIndex,
		});
	}
}
