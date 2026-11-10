import { Hono } from 'hono';
import { expect, test, vi } from 'vitest';
import { prepareServer, type Setup } from '../../src/cli/commands/studio';

const studioOrigin = 'https://local.drizzle.studio';

const proxyBody = JSON.stringify({
	type: 'proxy',
	data: { sql: 'delete from users', params: [], mode: 'object', method: 'run' },
});

async function studioApp() {
	const proxy = vi.fn(async () => []);
	const setup: Setup = {
		dbHash: 'hash',
		dialect: 'sqlite',
		packageName: 'node:sqlite',
		proxy,
		transactionProxy: vi.fn(async () => []),
		customDefaults: [],
		schema: {},
		relations: {},
	};
	const app = new Hono();
	await prepareServer(setup, app);
	return { app, proxy };
}

const post = (app: Hono, headers: Record<string, string>) =>
	app.request('/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: proxyBody,
	});

test('studio refuses a request from another website and runs nothing', async () => {
	const { app, proxy } = await studioApp();

	const res = await post(app, { Origin: 'https://evil.example' });

	expect(res.status).toBe(403);
	expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
	expect(proxy).not.toHaveBeenCalled();
});

test('studio refuses a preflight from another website', async () => {
	const { app } = await studioApp();

	const res = await app.request('/', {
		method: 'OPTIONS',
		headers: {
			Origin: 'https://evil.example',
			'Access-Control-Request-Method': 'POST',
			'Access-Control-Request-Headers': 'content-type',
		},
	});

	expect(res.status).toBe(403);
	expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
});

test('studio answers its own page', async () => {
	const { app, proxy } = await studioApp();

	const preflight = await app.request('/', {
		method: 'OPTIONS',
		headers: {
			Origin: studioOrigin,
			'Access-Control-Request-Method': 'POST',
			'Access-Control-Request-Headers': 'content-type',
		},
	});
	expect(preflight.status).toBe(204);
	expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(studioOrigin);
	expect(preflight.headers.get('Access-Control-Allow-Private-Network')).toBe('true');

	const res = await post(app, { Origin: studioOrigin });
	expect(res.status).toBe(200);
	expect(res.headers.get('Access-Control-Allow-Origin')).toBe(studioOrigin);
	expect(proxy).toHaveBeenCalledOnce();
});

test('studio still answers a client that sends no Origin, such as curl', async () => {
	const { app, proxy } = await studioApp();

	const res = await post(app, {});

	expect(res.status).toBe(200);
	expect(proxy).toHaveBeenCalledOnce();
});
