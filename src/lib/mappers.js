import prettyBytes from 'pretty-bytes';
import S3 from 'aws-sdk/clients/s3';
import { queryAttachments } from './models';

const s3 = new S3();

async function mapAttachment(attachment, cipher) {
  const params = {
    Bucket: process.env.ATTACHMENTS_BUCKET,
    Key: cipher.uuid + '/' + attachment.uuid,
    Expires: 604800, // 1 week
  };
  const url = await new Promise((resolve, reject) => s3.getSignedUrl('getObject', params, (err, signedUrl) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(signedUrl);
  }));
  return {
    Id: attachment.uuid,
    Url: url,
    FileName: attachment.filename,
    Key: attachment.key,
    Size: attachment.size,
    SizeName: prettyBytes(attachment.size),
    Object: 'attachment',
  };
}

export async function mapCipher(cipher) {
  const attachments = await queryAttachments(cipher.uuid);
  return {
    Id: cipher.uuid,
    Type: cipher.type,
    RevisionDate: getRevisionDate(cipher),
    FolderId: cipher.folderUuid,
    Favorite: cipher.favorite,
    OrganizationId: cipher.organizationUuid,
    Attachments: await Promise.all(attachments
      .map(attachment => mapAttachment(attachment, cipher))),
    OrganizationUseTotp: false,
    CollectionIds: [],
    Name: cipher.name,
    Notes: cipher.notes,
    Fields: cipher.fields,
    Login: cipher.login,
    Card: cipher.card,
    Identity: cipher.identity,
    SecureNote: cipher.securenote,
    Edit: true,
    Object: 'cipher',
  };
}

export function mapUser(user) {
  return {
    Id: user.uuid,
    Name: user.name,
    Email: user.email,
    EmailVerified: user.emailVerified,
    Premium: user.premium,
    MasterPasswordHint: user.passwordHint,
    Culture: user.culture,
    TwoFactorEnabled: !!user.totpSecret,
    Key: user.key,
    PrivateKey: (user.privateKey || '').toString('utf8'),
    SecurityStamp: user.securityStamp,
    Organizations: [],
    Object: 'profile',
  };
}

export function mapFolder(folder) {
  return {
    Id: folder.uuid,
    Name: folder.name,
    RevisionDate: getRevisionDate(folder),
    Object: 'folder',
  };
}

export function getRevisionDateAsMillis(object) {
  return (new Date(getRevisionDate(object))).getTime();
}

function getRevisionDate(object) {
  // dynogels sets updated at only after update
  return object.updatedAt || object.createdAt;
}
