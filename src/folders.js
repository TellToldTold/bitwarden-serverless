import * as utils from './lib/api_utils';
import { loadContextFromHeader } from './lib/bitwarden';
import { mapFolder } from './lib/mappers';
import { deleteFolder, getFolder, putFolder, touch, updateFolder } from './lib/models';

export const postHandler = async (event, context, callback) => {
  console.log('Folder create handler triggered', JSON.stringify(event, null, 2));

  if (!event.body) {
    callback(null, utils.validationError('Missing request body'));
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

  if (!body.name) {
    callback(null, utils.validationError('Missing folder name'));
    return;
  }

  try {
    const folderUuid = await putFolder({
      name: body.name,
      userUuid: user.uuid,
    });

    await touch('users', user);

    callback(null, utils.okResponse(mapFolder(await getFolder(user.uuid, folderUuid))));
  } catch (e) {
    callback(null, utils.serverError('Server error saving folder', e));
  }
};

export const putHandler = async (event, context, callback) => {
  console.log('Folder edit handler triggered', JSON.stringify(event, null, 2));
  if (!event.body) {
    callback(null, utils.validationError('Missing request body'));
    return;
  }

  const body = utils.normalizeBody(JSON.parse(event.body));

  let user;
  try {
    ({ user } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('Cannot load user from access token: ' + e));
    return;
  }

  if (!body.name) {
    callback(null, utils.validationError('Missing folder name'));
    return;
  }

  const folderUuid = event.pathParameters.uuid;
  if (!folderUuid) {
    callback(null, utils.validationError('Missing folder ID'));
  }

  try {
    let folder = await getFolder(user.uuid, folderUuid);

    await touch('users', user);

    if (!folder) {
      callback(null, utils.validationError('Unknown folder'));
      return;
    }

    await updateFolder(user.uuid, folderUuid, { name: body.name });

    callback(null, utils.okResponse(mapFolder(await getFolder(user.uuid, folderUuid))));
  } catch (e) {
    callback(null, utils.serverError('Server error saving folder', e));
  }
};

export const deleteHandler = async (event, context, callback) => {
  console.log('Folder delete handler triggered', JSON.stringify(event, null, 2));

  let user;
  try {
    ({ user } = await loadContextFromHeader(event.headers.Authorization));
  } catch (e) {
    callback(null, utils.validationError('User not found'));
  }

  const folderUuid = event.pathParameters.uuid;
  if (!folderUuid) {
    callback(null, utils.validationError('Missing folder ID'));
  }

  try {
    await deleteFolder(user.uuid, folderUuid);

    await touch('users', user);

    callback(null, utils.okResponse(''));
  } catch (e) {
    callback(null, utils.validationError(e.toString()));
  }
};
