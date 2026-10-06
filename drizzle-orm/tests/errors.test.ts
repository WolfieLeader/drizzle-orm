import { describe, test } from 'vitest';
import { EffectDrizzleQueryError } from '~/effect-core/errors.ts';
import { DrizzleQueryError } from '~/errors.ts';

const query = 'insert into "users" ("email", "token") values ($1, $2)';
const params = ['jane@example.com', 'secret-token'];

describe('query errors', () => {
	test('DrizzleQueryError keeps params out of the message and stack', ({ expect }) => {
		const cause = new Error('duplicate key value violates unique constraint "users_email_key"');
		const error = new DrizzleQueryError(query, params, cause);

		expect(error.message).toBe(`Failed query: ${query}\nparams: 2 omitted (see .params)`);
		expect(error.stack).not.toContain('jane@example.com');
		expect(error.stack).not.toContain('secret-token');
		expect(error.query).toBe(query);
		expect(error.params).toEqual(params);
		expect(error.cause).toBe(cause);
	});

	test('EffectDrizzleQueryError keeps params out of the message', ({ expect }) => {
		const error = new EffectDrizzleQueryError({ query, params, cause: undefined });

		expect(error.message).toBe(`Failed query: ${query}\nparams: 2 omitted (see .params)`);
		expect(error.query).toBe(query);
		expect(error.params).toEqual(params);
	});
});
