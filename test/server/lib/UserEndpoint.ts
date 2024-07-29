// FIXME: sort and normalize imports
import assert from 'assert';
import axios, { AxiosRequestConfig } from 'axios';
import { tmpdir } from 'os';
import path from 'path';
import { configForUser } from 'test/gen-server/testUtils';
import { prepareFilesystemDirectoryForTests } from './helpers/PrepareFilesystemDirectoryForTests';
import { EnvironmentSnapshot } from '../testUtils';
import { prepareDatabase } from './helpers/PrepareDatabase';
import { TestServer } from './helpers/TestServer';
import { UserProfile } from 'app/common/UserProfile';

const username = process.env.USER || "nobody";
const tmpDir = path.join(tmpdir(), `grist_test_${username}_userendpoint`);
// const SUITENAME = 'users';
const chimpy = configForUser('Chimpy');
const nobody = configForUser('Anonymous');
const kiwi = configForUser('Kiwi');

describe('UserEndpoint', function () {
  const SUITENAME = 'UserEndpoint';
  this.timeout(30000);
  let server: TestServer;
  let userEndpoint: string;
  let env: EnvironmentSnapshot;
  before(async () => {
    env = new EnvironmentSnapshot(); // FIXME: still useful?
    await prepareFilesystemDirectoryForTests(tmpDir);
    await prepareDatabase(tmpDir);
    const additionalEnvConfiguration = {
      GRIST_DEFAULT_EMAIL: 'chimpy@getgrist.com'
    };
    server = await TestServer.startServer('home,docs', tmpDir, SUITENAME, additionalEnvConfiguration);
    userEndpoint = `${server.serverUrl}/users`;
  });

  after(async function () {
    env.restore();
    await server.stop();
  });

  async function createUser(profile: UserProfile, requestConfig = chimpy) {
    return await axios.post(userEndpoint, profile, requestConfig);
  }

  async function createUserAndAssertCreated(profile: UserProfile, requestConfig?: AxiosRequestConfig) {
    const res = await createUser(profile, requestConfig);
    assert.equal(res.status, 200, `User ${profile.email} should have been created`);
    return res;
  }


  describe('POST /users', function () {
    const validPostPayload = {
      email: 'newUser@example.org',
      name: 'Some User'
    };

    it('should disallow creating a user when logged in as nobody', async function () {
      const res = await createUser(validPostPayload, nobody);
      assert.equal(res.status, 403);
    });

    it('should disallow creating a user when logged in as kiwi', async function () {
      const res = await createUser(validPostPayload, kiwi);
      assert.equal(res.status, 403);
    });

    it('should reject user creation with wrong payload', async () => {
      const invalidPayload = {foo: 'bar'} as unknown as any;
      const res = await createUser(invalidPayload, chimpy);
      assert.equal(res.status, 400);
    });

    it('should reject user creation with invalid email', async () => {
      const res = await createUser({
        ...validPostPayload,
        email: 'not-an-email'
      }, chimpy);
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Invalid email/);
    });

    it('should create a user', async () => {
      const res = await createUserAndAssertCreated(validPostPayload, chimpy);
      assert.equal(typeof res.data.id, "number");
      assert.equal(res.data.name, validPostPayload.name, 'name should be stored in the User');
      assert.ok(Array.isArray(res.data.logins) && res.data.logins.length === 1, 'logins should be an array of 1');
      assert.equal(res.data.logins[0].email, validPostPayload.email.toLowerCase(), 'email should have been normalized');
      assert.equal(res.data.logins[0].displayEmail, validPostPayload.email,
        'passed email corresponds to displayEmail');
    });

    it('should disallow 2 users with the same email to exist', async () => {
      const res = await createUser({...validPostPayload, email: 'chimpy@getgrist.com'}, chimpy);
      assert.equal(res.status, 409); // CONFLICT status code
      assert.match(res.data.error, /already exists/);
    });
  });

  describe('GET /users/', function () {
    it('should retrieve users', async () => {
      const res = await axios.get(userEndpoint, chimpy);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.length > 1);
    });
  });

  describe('GET /users/:id', function () {
    const creationPayload = {
      email: 'new-user-get@example.org',
      name: 'Some User For GET /users/:id'
    };

    it('should retrieve a user', async () => {
      const creationRes = await createUserAndAssertCreated(creationPayload);
      const userId = creationRes.data.id;
      const res = await axios.get(`${userEndpoint}/${userId}`, chimpy);
      assert.equal(res.status, 200);
      assert.equal(res.data.name, creationPayload.name);
    });

    it('should return a 404 when the user is not found', async () => {
      const res = await axios.get(`${userEndpoint}/404`, chimpy);
      assert.equal(res.status, 404);
      assert.match(res.data.error, /User not found/);
    });
  });

  describe('DELETE /users/:id', function () {
    async function assertUserDeleted(userId: number) {
      const res = await axios.get(`${userEndpoint}/${userId}`, chimpy);
      assert.equal(res.status, 404);
      assert.match(res.data.error, /not found/);
    }

    const creationPayload = {
      email: 'new-user-delete@example.org',
      name: 'Some User For DELETE /users/:id'
    };

    it('should return a 404 when the user is not found', async () => {
      const res = await axios.delete(`${userEndpoint}/404`, chimpy);
      assert.equal(res.status, 404);
      assert.match(res.data.error, /User not found/);
    });

    it('should retrieve a user', async () => {
      const creationRes = await createUserAndAssertCreated(creationPayload);
      const userId = creationRes.data.id;

      const res = await axios.delete(`${userEndpoint}/${userId}`, chimpy);
      assert.equal(res.status, 200);
      assert.equal(res.data.name, creationPayload.name);

      await assertUserDeleted(userId);
      // TODO: Also ensure that user's personal org is deleted
    });
  });
});
