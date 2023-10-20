import S3 from 'aws-sdk/clients/s3';
import * as utils from './lib/api_utils';
import { loadContextFromHeader, buildCipherDocument } from './lib/bitwarden';
import { mapCipher } from './lib/mappers';
import { putCipher, getCipher, queryAttachments, updateCipher, touch, deleteAttachment, deleteCipher } from './lib/models';

export const postHandler = async (event, context, callback) => {
  console.log('Cipher create handler triggered', JSON.stringify(event, null, 2));

  if (!event.body) {
    callback(null, utils.validationError('Request body is missing'));
    return;
  }

  const body = utils.normalizeBody(JSON.parse(event.body));

  let user;
  try {
    ({ user } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('User not found: ' + e.message));
    return;
  }

  if (!body.type || !body.name) {
    callback(null, utils.validationError('Missing name and type of vault item'));
    return;
  }

  try {

    const cipherUuid = await putCipher(buildCipherDocument(body, user));
    const cipher = await getCipher(user.uuid, cipherUuid);

    await touch('ciphers', cipher);

    callback(null, utils.okResponse({ ...await mapCipher(cipher), Edit: true }));
  } catch (e) {
    callback(null, utils.serverError('Server error saving vault item', e));
  }
};

export const putHandler = async (event, context, callback) => {
  console.log('Cipher edit handler triggered', JSON.stringify(event, null, 2));
  if (!event.body) {
    callback(null, utils.validationError('Request body is missing'));
    return;
  }

  const body = utils.normalizeBody(JSON.parse(event.body));

  let user;
  try {
    ({ user } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('User not found: ' + e.message));
    return;
  }

  if (!body.type || !body.name) {
    callback(null, utils.validationError('Missing name and type of vault item'));
    return;
  }

  const cipherUuid = event.pathParameters.uuid;
  if (!cipherUuid) {
    callback(null, utils.validationError('Missing vault item ID'));
  }

  try {
    let cipher = await getCipher(user.uuid, cipherUuid);

    if (!cipher) {
      callback(null, utils.validationError('Unknown vault item'));
      return;
    }

    await updateCipher(cipher.userUuid, cipher.uuid, buildCipherDocument(body, user));

    await touch('users', user);

    callback(null, utils.okResponse({ ...await mapCipher(cipher), Edit: true }));
  } catch (e) {
    callback(null, utils.serverError('Server error saving vault item', e));
  }
};

export const deleteHandler = async (event, context, callback) => {
  console.log('Cipher delete handler triggered', JSON.stringify(event, null, 2));

  let user;
  try {
    ({ user } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('User not found: ' + e.message));
  }

  let cipherUuids;
  if (event.pathParameters) {
    cipherUuids = [event.pathParameters.uuid];
  } else if (event.body) {
    const body = utils.normalizeBody(JSON.parse(event.body));
    cipherUuids = body.ids;
  } else {
    callback(null, utils.validationError('Missing vault id/s'));
    return;
  }
  if (!cipherUuids || cipherUuids.every(elem => (elem === undefined || elem === ''))) {
    callback(null, utils.validationError('Missing vault id/s'));
    return;
  }

  cipherUuids.forEach(async (cipherUuid) => {
    try {
      // Remove attachments. First retrieve associated attachments to the cipher.
      const attachments = await queryAttachments(cipherUuid);
      attachments.forEach(async (attachment) => {
        // Remove it from S3 bucket
        const params = {
          Bucket: process.env.ATTACHMENTS_BUCKET,
          Key: cipherUuid + '/' + attachment.uuid,
        };

        // TODO s3 v3 conversion
        const s3 = new S3();
        await new Promise((resolve, reject) => s3.deleteObject(params, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        }));

        // Remove it from table attachments
        await deleteAttachment(cipherUuid, attachment.uuid);
      });

      // Remove cipher from table ciphers
      await deleteCipher(user.uuid, cipherUuid);
      await touch('users', user);
    } catch (e) {
      callback(null, utils.validationError(e.toString()));
    }
  });

  callback(null, utils.okResponse(''));
};
