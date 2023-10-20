import querystring from 'querystring';
import * as utils from './lib/api_utils';
import { regenerateTokens, loadContextFromHeader, DEFAULT_VALIDITY } from './lib/bitwarden';

export const handler = async (event, context, callback) => {
  console.log('Keys handler triggered', JSON.stringify(event, null, 2));
  if (!event.body) {
    callback(null, utils.validationError('Missing request body'));
    return;
  }

  let body;
  const contentType = event.headers['content-type'].split(';')[0];
  if (contentType === 'application/json') {
    body = utils.normalizeBody(JSON.parse(event.body));
  } else {
    body = utils.normalizeBody(querystring.parse(event.body));
  }

  let user;
  let device;
  try {
    ({ user, device } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('User not found: ' + e.message));
    return;
  }

  const re = /^2\..+\|.+/;
  if (!re.test(body.encryptedprivatekey)) {
    callback(null, utils.validationError('Invalid key'));
    return;
  }

  user.set({ privateKey: body.encryptedprivatekey });
  user.set({ publicKey: body.publickey });

  const tokens = regenerateTokens(user, device);

  device.set({ refreshToken: tokens.refreshToken });

  device = await device.updateAsync();
  await user.updateAsync();

  try {
    callback(null, utils.okResponse({
      access_token: tokens.accessToken,
      expires_in: DEFAULT_VALIDITY,
      token_type: 'Bearer',
      refresh_token: tokens.refreshToken,
      Key: user.key,
      Id: user.uuid,
      Name: user.name,
      Email: user.email,
      EmailVerified: user.emailVerified,
      Premium: user.premium,
      MasterPasswordHint: user.passwordHint,
      Culture: user.culture,
      TwoFactorEnabled: user.totpSecret,
      PrivateKey: user.privateKey,
      SecurityStamp: user.securityStamp,
      Organizations: '[]',
      Object: 'profile',
    }));
  } catch (e) {
    callback(null, utils.serverError('Internal error', e));
  }
};
