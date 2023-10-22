import querystring from 'querystring';
import speakeasy from 'speakeasy';
import * as utils from './lib/api_utils';
import {
  deleteDevice,
  getDevice, getUser, scanDevice,
  scanUser,
  updateDevice
} from './lib/models';
import { regenerateTokens, hashesMatch, DEFAULT_VALIDITY } from './lib/bitwarden';
import { KDF_PBKDF2, KDF_PBKDF2_ITERATIONS_DEFAULT } from './lib/crypto';

export const handler = async (event, context, callback) => {
  console.log('Login handler triggered', JSON.stringify(event, null, 2));
  if (!event.body) {
    callback(null, utils.validationError('Missing request body'));
    return;
  }

  const body = utils.normalizeBody(querystring.parse(event.body));

  let eventHeaders;
  let device;
  let deviceType;
  let user;

  try {
    let params = {};
    switch (body.grant_type) {
      case 'password':
        if ([
          'client_id',
          'grant_type',
          'password',
          'scope',
          'username',
        ].some((param) => {
          if (!body[param]) {
            callback(null, utils.validationError(param + ' must be supplied'));
            return true;
          }

          return false;
        })) {
          return;
        }

        if (body.scope !== 'api offline_access') {
          callback(null, utils.validationError('Scope not supported'));
          return;
        }

        user = await scanUser(body.username.toLowerCase());

        if (!user) {
          callback(null, utils.validationError('Invalid username or password'));
          return;
        }

        if (!hashesMatch(user.passwordHash, body.password)) {
          callback(null, utils.validationError('Invalid username or password'));
          return;
        }

        if (user.totpSecret) {
          const verified = speakeasy.totp.verify({
            secret: user.totpSecret,
            encoding: 'base32',
            token: body.twofactortoken,
          });

          if (!verified) {
            callback(null, {
              statusCode: 400,
              headers: utils.CORS_HEADERS,
              body: JSON.stringify({
                error: 'invalid_grant',
                error_description: 'Two factor required.',
                TwoFactorProviders: [0],
                TwoFactorProviders2: { 0: null },
              }),
            });
            return;
          }
        }

        // Web vault doesn't send device identifier
        if (body.deviceidentifier) {
          device = await getDevice(body.deviceidentifier);
          if (device && device.userUuid !== user.uuid) {
            await deleteDevice(device.uuid)
            device = null;
          }
        }

        let deviceUuid;
        if (!device) {
          deviceUuid = await updateDevice(body.deviceidentifier, {
            userUuid: user.uuid,
          });
        }

        // Browser extension sends body, web and mobile send header.
        // iOS sends lower case header with string value.
        eventHeaders = utils.normalizeBody(event.headers);
        deviceType = body.devicetype;
        if (!Number.isNaN(eventHeaders['device-type'])) {
          deviceType = parseInt(event.headers['device-type'], 10);
        }

        if (body.devicename && deviceType) {
          params = {
            ...params,
            type: deviceType,
            name: body.devicename,
          };
        }

        if (body.devicepushtoken) {
          params = {
            ...params,
            type: deviceType,
            pushToken: body.devicepushtoken
          };
        }

        break;
      case 'refresh_token':
        if (!body.refresh_token) {
          callback(null, utils.validationError('Refresh token must be supplied'));
          return;
        }

        console.log('Login attempt using refresh token', { refreshToken: body.refresh_token });

        device = await scanDevice(body.refresh_token);

        if (!device) {
          console.error('Invalid refresh token', { refreshToken: body.refresh_token });
          callback(null, utils.validationError('Invalid refresh token'));
          return;
        }

        user = await getUser(device.userUuid);
        break;
      default:
        callback(null, utils.validationError('Unsupported grant type'));
        return;
    }

    const tokens = regenerateTokens(user, device);

    params = {...params, refreshToken: tokens.refreshToken };

    await updateDevice(device.uuid, params);

    const privateKey = user.privateKey || null;

    callback(null, utils.okResponse({
      access_token: tokens.accessToken,
      expires_in: DEFAULT_VALIDITY,
      token_type: 'Bearer',
      refresh_token: tokens.refreshToken,
      Key: user.key,
      PrivateKey: privateKey ? privateKey.toString('utf8') : null,
      Kdf: KDF_PBKDF2,
      KdfIterations: user.kdfIterations || KDF_PBKDF2_ITERATIONS_DEFAULT,
      ResetMasterPassword: false, // TODO: according to official server https://github.com/bitwarden/server/blob/01d4d97ef18637fa857195a7285fda092124a677/src/Core/IdentityServer/BaseRequestValidator.cs#L164
    }));
  } catch (e) {
    callback(null, utils.serverError('Internal error', e));
  }
};
