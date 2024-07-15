import assert from 'assert';
import axios from 'axios';
import { tmpdir } from 'os';
import path from 'path';
import { configForUser } from 'test/gen-server/testUtils';
import {main as mergedServerMain} from 'app/server/mergedServerMain';
import { prepareFilesystemDirectoryForTests } from './helpers/PrepareFilesystemDirectoryForTests';
import { createInitialDb, setUpDB } from 'test/gen-server/seed';
import { EnvironmentSnapshot } from '../testUtils';
import { FlexServer } from 'app/server/lib/FlexServer';


const username = process.env.USER || "nobody";
const tmpDir = path.join(tmpdir(), `grist_test_${username}_userendpoint`);
// const SUITENAME = 'users';
const chimpy = configForUser('Chimpy');
const nobody = configForUser('Anonymous');
const kiwi = configForUser('Kiwi');

describe('UserEndpoint', function () {
  this.timeout(30000);
  let server: FlexServer;
  let userEndpoint: string;
  let env: EnvironmentSnapshot;
  before(async function () {
    env = new EnvironmentSnapshot();
    await prepareFilesystemDirectoryForTests(tmpDir);
    setUpDB(this);
    await createInitialDb();
    process.env.GRIST_DEFAULT_EMAIL = 'chimpy@getgrist.com';
    const server = await mergedServerMain(0, ['home', 'docs']);
    // server = await TestServer.startServer('home,docs', tmpDir, SUITENAME, additionalEnvConfiguration);
    userEndpoint = `${server.getOwnUrl()}/users/`;
  });

  after(async function () {
    env.restore();
    await server.close();
  });

  describe('POST /users', function () {
    const validPostPayload = {
      email: 'newUser@example.org',
      name: 'Some User'
    };

    [
      {
        username: 'nobody',
        user: nobody,
        payload: validPostPayload
      }, {
        username: 'kiwi',
        user: kiwi,
        payload: validPostPayload
      },
    ].forEach((ctx) => {
      it(`should disallow creating a user when logged in as ${ctx.username}`, async () => {
        const res = await axios.post(userEndpoint, ctx.payload, ctx.user);
        assert.equal(res.status, 403);
      });
    });

    it('should reject user creation with wrong payload', async () => {
      const res = await axios.post(userEndpoint, {
        foo: 'bar'
      }, chimpy);
      assert.equal(res.status, 400);
    });

    it('should reject user creation with invalid email', async () => {
      const res = await axios.post(userEndpoint, {
        ...validPostPayload,
        email: 'not-an-email'
      }, chimpy);
      assert.equal(res.status, 400);
      assert.match(res.data, /Invalid email/);
    });

    it('should create a user', async () => {
      const res = await axios.post(userEndpoint, validPostPayload, chimpy);
      assert.equal(res.status, 200);
      assert.equal(typeof res.data.id, "number");
      assert.equal(res.data.name, validPostPayload.name, 'name should be stored in the User');
      assert.ok(Array.isArray(res.data.logins) && res.data.logins.length === 1, 'logins should be an array of 1');
      assert.equal(res.data.logins[0].email, validPostPayload.email.toLowerCase(), 'email should have been normalized');
      assert.equal(res.data.logins[0].displayEmail, validPostPayload.email,
        'passed email corresponds to displayEmail');
    });
  });

  describe('GET /users/:id', function () {
    const creationPayload = {
      email: 'new-user-get@example.org',
      name: 'Some User For GET /users/:id'
    };

    it('should retrieve a user', async () => {
      const creationRes = await axios.post(userEndpoint, creationPayload, chimpy);

      console.log(creationRes.data);
      assert.equal(creationRes.status, 200);
      const userId = creationRes.data.id;
      const res = await axios.get(`/${userEndpoint}/:${userId}`, chimpy);
      assert.equal(res.status, 200);
      assert.equal(res.data.name, creationPayload.name);
    });
  });
});
