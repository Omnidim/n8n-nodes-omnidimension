import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OmniDimensionApi implements ICredentialType {
	name = 'omniDimensionApi';

	displayName = 'OmniDimension API';

	icon = { light: 'file:omnidimension.svg', dark: 'file:omnidimension.dark.svg' } as const;

	documentationUrl = 'https://docs.omnidim.io/docs/api-reference';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Get your API key at https://omnidim.io/api-management. Tip: create a key named "n8n" so you can revoke it independently.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://backend.omnidim.io/api/v1',
			description: 'OmniDimension API base URL. Only change this if support tells you to.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/agents',
			method: 'GET',
			qs: { pageno: 1, pagesize: 1 },
		},
	};
}
