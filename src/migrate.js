import omit from 'lodash/omit';
import { scanAllCiphers, scanAllUsers, updateCipher } from './lib/models';
import {
  TYPE_LOGIN,
  TYPE_NOTE,
  TYPE_CARD,
  TYPE_IDENTITY,
} from './lib/bitwarden';

export const migrateHandler = async (event, context, callback) => {
  console.log('Data migration handler triggered', JSON.stringify(event, null, 2));

  let ciphers;
  let users;
  try {
    ciphers = await scanAllCiphers();
    users = await scanAllUsers();
  } catch (e) {
    callback(null, 'Server error loading vault items ' + e.message);
    return;
  }

  let userCount = 0;
  users.forEach(async (user) => {
    const version = user.version;
    console.log('Checking user ' + user.uuid + ' with version ' + version);
    switch (version) {
      case 2:
        console.log('Already up-to-date');
        break;
      case 1:
        userCount += 1;
        await updateUser(user.uuid, { kdfIterations: 5000, version: 2 });
        break;
      default:
        userCount += 1;
        await updateUser(user.uuid, { emailVerified: true, version: 1 });
        break;
    }
  });

  let cipherCount = 0;
  ciphers.forEach(async (cipher) => {
    const version = cipher.version;
    console.log('Checking cipher ' + cipher.uuid + ' with version ' + version);
    switch (version) {
      case 2:
        // up-to-date
        console.log('Already up-to-date');
        break;
      case 1: {
        cipherCount += 1;
        const fields = {
          version: 2,
          attachments: [],
        };
        await updateCipher(cipher.userUuid, cipher.uuid, fields);
        break;
      }
      default: {
        cipherCount += 1;
        const fields = {
          version: 1,
        };
        const data = cipher.data;

        if (data) {
          fields.name = data.Name || null;
          fields.notes = data.Notes || null;
          fields.fields = data.Fields || null;

          const fmap = {
            [TYPE_LOGIN]: 'login',
            [TYPE_NOTE]: 'securenote',
            [TYPE_CARD]: 'card',
            [TYPE_IDENTITY]: 'identity',
          };

          fields[fmap[cipher.type]] = omit(data, ['Name', 'Notes', 'Fields', 'Uri']);

          if (cipher.type === TYPE_LOGIN) {
            fields.login.Uris = [
              {
                Uri: data.Uri,
                Match: null,
              },
            ];
          }
        }

        fields.data = null;

        console.log('Updating with fields', fields);
        await updateCipher(cipher.userUuid, cipher.uuid, fields);
        break;
      }
    }
  });

  callback(null, 'Migrated ' + cipherCount + ' ciphers and ' + userCount + ' users.');
};
