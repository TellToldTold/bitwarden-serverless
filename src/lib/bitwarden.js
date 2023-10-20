import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bufferEq from 'buffer-equal-constant-time';
import entries from 'object.entries';
import mapKeys from 'lodash/mapKeys';
import { CIPHER_MODEL_VERSION, getDevice, getUser, USER_MODEL_VERSION } from './models';
import { KDF_PBKDF2_ITERATIONS_DEFAULT } from './crypto';

const JWT_DEFAULT_ALGORITHM = 'HS256';

export const TYPE_LOGIN = 1;
export const TYPE_NOTE = 2;
export const TYPE_CARD = 3;
export const TYPE_IDENTITY = 4;

export const DEFAULT_VALIDITY = 60 * 60;

export async function loadContextFromHeader(header) {
  if (!header) {
    throw new Error('Missing Authorization header');
  }

  const token = header.replace(/^(Bearer)/, '').trim();
  const payload = jwt.decode(token);
  const userUuid = payload.sub;
  const deviceUuid = payload.device;
  const user = await getUser(userUuid);
  const device = await getDevice(deviceUuid);

  if (!user || !device) {
    throw new Error('User or device not found from token');
  }

  // Throws on error
  jwt.verify(token, user.jwtSecret, { algorithms: [JWT_DEFAULT_ALGORITHM] });

  if (payload.sstamp !== user.securityStamp) {
    throw new Error('You need to login again after recent profile changes');
  }

  return { user, device };
}

export function regenerateTokens(user, device) {
  const expiryDate = new Date();
  expiryDate.setTime(expiryDate.getTime() + (DEFAULT_VALIDITY * 1000));

  const notBeforeDate = new Date();
  notBeforeDate.setTime(notBeforeDate.getTime() - (60 * 2 * 1000));

  const tokens = {
    tokenExpiresAt: expiryDate,
    refreshToken: device.refreshToken,
  };

  if (!device.refreshToken) {
    tokens.refreshToken = generateToken();
  }

  const payload = {
    nbf: Math.floor(notBeforeDate.getTime() / 1000),
    exp: Math.floor(expiryDate.getTime() / 1000),
    iss: '/identity',
    sub: user.uuid,
    premium: user.premium,
    name: user.name,
    email: user.email,
    email_verified: user.emailVerified,
    sstamp: user.securityStamp,
    device: device.uuid,
    scope: ['api', 'offline_access'],
    amr: ['Application'],
  };

  tokens.accessToken = jwt.sign(payload, user.jwtSecret, { algorithm: JWT_DEFAULT_ALGORITHM });

  return tokens;
}

export function hashesMatch(hashA, hashB) {
  return hashA && hashB && bufferEq(Buffer.from(hashA), Buffer.from(hashB));
}

export function buildCipherDocument(body, user) {
  const params = {
    userUuid: user.uuid,
    organizationUuid: body.organizationid,
    folderUuid: body.folderid,
    favorite: !!body.favorite,
    type: parseInt(body.type, 10),
    name: body.name,
    notes: body.notes,
    fields: [],
    version: CIPHER_MODEL_VERSION,
  };

  let additionalParamsType = null;
  if (params.type === TYPE_LOGIN) {
    additionalParamsType = 'login';
  } else if (params.type === TYPE_CARD) {
    additionalParamsType = 'card';
  } else if (params.type === TYPE_IDENTITY) {
    additionalParamsType = 'identity';
  } else if (params.type === TYPE_NOTE) {
    additionalParamsType = 'securenote';
  }

  if (additionalParamsType !== null && additionalParamsType in body) {
    params[additionalParamsType] = {};
    entries(body[additionalParamsType]).forEach(([key, value]) => {
      let paramValue = value;
      if (ucfirst(key) === 'Uris' && value) {
        paramValue = value.map(val => mapKeys(val, (_, uriKey) => ucfirst(uriKey)));
      }
      params[additionalParamsType][ucfirst(key)] = paramValue;
    });
  }

  if (body.fields && Array.isArray(body.fields)) {
    params.fields = body.fields.map((field) => {
      const vals = {};
      entries(field).forEach(([key, value]) => {
        vals[ucfirst(key)] = value;
      });

      return vals;
    });
  }

  return params;
}

export function buildUserDocument(body) {
  const user = {
    email: body.email.toLowerCase(),
    passwordHash: body.masterpasswordhash,
    passwordHint: body.masterpasswordhint,
    kdfIterations: body.kdfiterations || KDF_PBKDF2_ITERATIONS_DEFAULT,
    key: body.key,
    jwtSecret: generateSecret(),
    culture: 'en-US', // Hard-coded unless supplied from elsewhere
    premium: true,
    emailVerified: true, // Web-vault requires verified e-mail
    version: USER_MODEL_VERSION,
  };
  if (body.keys) {
    user.privateKey = body.keys.encryptedPrivateKey;
    user.publicKey = body.keys.publicKey;
  }
  return user;
}

export function buildAttachmentDocument(attachment, attachmentKey, cipher) {
  return {
    cipherUuid: cipher.uuid,
    uuid: attachment.id,
    filename: attachment.filename,
    size: attachment.size,
    key: attachmentKey,
  };
}

export function generateSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(64)
    .toString('base64')
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, ''); // Remove ending '='
}

function ucfirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
