const test = require('node:test');
const assert = require('node:assert');
const { OmniDimension } = require('../dist/nodes/OmniDimension/OmniDimension.node.js');

// Minimal fake of the n8n execution context. `params` maps parameter name -> value,
// `reply` is what the fake HTTP layer returns. Captures the outgoing request so we
// can assert on the URL and body the node actually builds.
function makeContext(params, reply) {
	const sent = {};
	const ctx = {
		sent,
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'OmniDimension' }),
		continueOnFail: () => false,
		getCredentials: async () => ({ baseUrl: 'https://backend.omnidim.io/api/v1/' }), // trailing slash on purpose
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		helpers: {
			httpRequestWithAuthentication: async function (_cred, options) {
				Object.assign(sent, options);
				return reply;
			},
		},
	};
	return ctx;
}

const run = (ctx) => OmniDimension.prototype.execute.call(ctx);

test('strips the trailing slash from a user-edited base URL', async () => {
	const ctx = makeContext({ resource: 'phoneNumber', operation: 'getAll' }, { phone_numbers: [] });
	await run(ctx);
	assert.strictEqual(ctx.sent.url, 'https://backend.omnidim.io/api/v1/phone_number/list');
});

test('throws on an error body returned with HTTP 200', async () => {
	const ctx = makeContext(
		{ resource: 'bulkCall', operation: 'addContact', campaignId: '7', toNumber: '+15551234567' },
		{ status: 'error', message: 'Campaign is not dynamic' },
	);
	await assert.rejects(run(ctx), /Campaign is not dynamic/);
});

test('splits a list response into one item per record', async () => {
	const ctx = makeContext(
		{ resource: 'agent', operation: 'getAll' },
		{ bots: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] },
	);
	const [items] = await run(ctx);
	assert.strictEqual(items.length, 2);
	assert.strictEqual(items[1].json.name, 'B');
});

test('rejects a non-numeric agent ID instead of sending NaN', async () => {
	const ctx = makeContext(
		{ resource: 'call', operation: 'dispatch', agentId: 'Sales Agent', toNumber: '+15551234567' },
		{},
	);
	await assert.rejects(run(ctx), /must be a numeric ID/);
});

test('rejects agent creation with no filled context section', async () => {
	const ctx = makeContext(
		{
			resource: 'agent',
			operation: 'create',
			name: 'Test',
			'contextBreakdown.sections': [{ title: 'Purpose', body: '   ' }],
		},
		{},
	);
	await assert.rejects(run(ctx), /at least one Context Breakdown section/i);
});

test('reports a missing call log instead of returning nothing', async () => {
	const ctx = makeContext(
		{ resource: 'call', operation: 'getLog', callLogId: '999' },
		{ call_log_data: [], total_records: 0 },
	);
	await assert.rejects(run(ctx), /No call log found/);
});

test('builds the dispatch body the API expects', async () => {
	const ctx = makeContext(
		{
			resource: 'call',
			operation: 'dispatch',
			agentId: '42',
			toNumber: '+15551234567',
			fromNumberId: '8',
			callContext: '{"name":"Ravi"}',
		},
		{ success: true, requestId: 1 },
	);
	await run(ctx);
	assert.deepStrictEqual(ctx.sent.body, {
		agent_id: 42,
		to_number: '+15551234567',
		call_context: { name: 'Ravi' },
		from_number_id: 8,
	});
});
