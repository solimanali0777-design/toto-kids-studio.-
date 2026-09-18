import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnerAuth, parseCookies } from '../backend/ownerAuth.mjs';

test('owner auth fails closed when server token is not configured', () => {
  const auth = buildOwnerAuth({ ownerToken: '', disabled: false });
  assert.equal(auth.configured, false);
  assert.equal(auth.authenticated({}), false);
  assert.throws(
    () => auth.assertAuthenticated({}),
    error => error?.code === 'owner_auth_not_configured' && error?.status === 503,
  );
});

test('wrong owner token is rejected', () => {
  const auth = buildOwnerAuth({ ownerToken: 'this-is-a-long-owner-token-for-tests', disabled: false });
  assert.throws(
    () => auth.login('wrong-token'),
    error => error?.code === 'unauthorized' && error?.status === 401,
  );
});

test('valid login cookie authenticates without exposing raw token', () => {
  const rawToken = 'this-is-a-long-owner-token-for-tests';
  const auth = buildOwnerAuth({ ownerToken: rawToken, disabled: false });
  const login = auth.login(rawToken);
  assert.equal(login.ok, true);
  assert.notEqual(login.sessionValue, rawToken);

  const setCookie = auth.cookie({ secure: true });
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Strict'));
  assert.ok(setCookie.includes('Secure'));
  assert.equal(setCookie.includes(rawToken), false);

  const cookieHeader = setCookie.split(';')[0];
  assert.equal(auth.authenticated({ cookie: cookieHeader }), true);
  assert.equal(parseCookies(cookieHeader).soly_owner_session, login.sessionValue);
});

test('bearer authentication works for non-browser owner clients', () => {
  const rawToken = 'this-is-a-long-owner-token-for-tests';
  const auth = buildOwnerAuth({ ownerToken: rawToken, disabled: false });
  assert.equal(auth.authenticated({ authorization: `Bearer ${rawToken}` }), true);
});

test('auth bypass must be explicitly disabled by configuration', () => {
  const auth = buildOwnerAuth({ ownerToken: '', disabled: true });
  assert.equal(auth.disabled, true);
  assert.equal(auth.authenticated({}), true);
  assert.equal(auth.assertAuthenticated({}), true);
});
