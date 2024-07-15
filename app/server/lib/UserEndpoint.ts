// FIXME: sort and normalize imports
import { ApiError } from 'app/common/ApiError';
import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { RequestWithLogin } from 'app/server/lib/Authorizer';
import * as t from "ts-interface-checker";
import * as Types from 'app/common/UserProfile';
import UserProfileTI from 'app/common/UserProfile-ti';
import log from 'app/server/lib/log';
import { HomeDBManager } from 'app/gen-server/lib/homedb/HomeDBManager';
import { isEmail } from 'app/common/gutil';
import { expressWrap } from './expressWrap';

const {
  UserProfile
} = t.createCheckers(UserProfileTI);

for (const checker of [UserProfile]) {
  checker.setReportedPath("body");
}

// FIXME: factorize it (in express-wrap? Maybe rename the module?)
/**
 * Middleware for validating request's body with a Checker instance.
 */
function validate(checker: t.Checker): RequestHandler {
  return (req, res, next) => {
    validateCore(checker, req, req.body);
    next();
  };
}

function validateCore(checker: t.Checker, req: Request, body: any) {
    try {
      checker.check(body);
    } catch(err) {
      log.warn(`Error during api call to ${req.path}: Invalid payload: ${String(err)}`);
      throw new ApiError('Invalid payload', 400, {userError: String(err)});
    }
}


const buildUserRoute = (dbManager: HomeDBManager) => {
  const userRoute = Router();

  userRoute.post('/', validate(UserProfile), expressWrap(async function (req, res) {
    // FIXME: should it reject if the user already exist? Or send some flag that it is not a newly created user?
    const profile = req.body as Types.UserProfile;
    const { email } = profile;
    if (!isEmail(profile.email)) {
      throw new ApiError('Invalid email: ' + email, 400);
    }
    await dbManager.ensureExternalUser(profile);
    const user = await dbManager.getUserByLogin(email);
    res.status(200).json(user);
  }));

  userRoute.get('/:id', expressWrap(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      throw new ApiError('Invalid user id, expected number: ' + req.params.id, 400);
    }
    const user = dbManager.getUser(userId);
    res.status(200).json(user);
  }));

  return userRoute;
};

function checkPermissionToUserEndpoint(req: Request, res: Response, next: NextFunction) {
  const mreq = req as RequestWithLogin;
  const adminEmail = process.env.GRIST_DEFAULT_EMAIL;
  if (!adminEmail || mreq.user?.loginEmail !== adminEmail) {
    throw new ApiError('Permission denied', 403);
  }
  return next();
}

export { buildUserRoute, checkPermissionToUserEndpoint };
