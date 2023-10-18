import { DynamoDBClient, UpdateItemCommand, GetItemCommand, ReturnValue, AttributeAction, PutItemCommand } from "@aws-sdk/client-dynamodb";

let client;

if (process.env.STAGE === 'dev') {
  console.log('Using local DynamoDB endpoint ' + process.env.LOCAL_DYNAMODB_ENDPOINT);
  client = new DynamoDBClient({
    region: 'localhost',
    endpoint: process.env.LOCAL_DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: 'MockAccessKeyId',
      secretAccessKey: 'MockSecretAccessKey',
    }
  });
} else {
  client = new DynamoDBClient({
    region: process.env.REGION,
  });
}

const devicesTableName = process.env.DEVICES_TABLE || 'devices';
const usersTableName = process.env.USERS_TABLE || 'users';
const cipherTableName = process.env.CIPHERS_TABLE || 'ciphers';
const folderTableName = process.env.FOLDERS_TABLE || 'folders';
const attachmentsTableName = process.env.ATTACHMENTS_TABLE || 'attachments';

export const CIPHER_MODEL_VERSION = 2;
export const USER_MODEL_VERSION = 2;

// ========================= Device =========================
// export type deviceSchema = {
//   uuid: string,
//   userUuid: string | null,
//   name:string,
//   type: number,
//   pushToken: string | null,
//   refreshToken: string | null,
// }

export const getDevice = async (uuid) => {
  const params = {
    TableName: devicesTableName,
    Key: {
      "uuid": { S: uuid }
    }
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response.Item;
}

export const updateDevice = async (uuid, pushToken) => {
  const params = {
    TableName: devicesTableName,
    Key: {
      "uuid": { S: uuid }
    },
    AttributeUpdates: {
      "pushToken": { 
        Value: { S: pushToken },
        Action: AttributeAction.PUT,
      }
    },
    ReturnValues: ReturnValue.ALL_NEW,
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  return response.Attributes;
}

// ========================= User =========================

// export type userSchema = {
//   uuid: string,
//   email: string,
//   emailVerified: boolean,
//   premium: boolean,
//   name: string | null,
//   passwordHash: string,
//   passwordHint: string | null,
//   key: string,
//   jwtSecret: string,
//   privateKey: Buffer,
//   publicKey: Buffer,
//   totpSecret: string | null,
//   totpSecretTemp: string | null,
//   securityStamp: string,
//   culture: string,
//   kdfIterations: number,
//   version: number | null,
// }

export const getUser = async (uuid) => {
  const params = {
    TableName: usersTableName,
    Key: {
      "uuid": { S: uuid }
    }
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response.Item;
}


// ========================= Cipher =========================

// export type cipherSchema = {
//   userUuid: string,
//   uuid: string,
//   folderUuid: string | null,
//   organizationUuid: string | null,
//   type: number,
//   version: number | null,
//   data: any,
//   favorite: boolean,
//   name: string | null,
//   notes: string | null,
//   fields: any | null,
//   login: any | null,
//   securenote: any | null,
//   identity: any | null,
//   card: any | null,
// }

export const getCipher = async (uuid) => {
  const params = {
    TableName: cipherTableName,
    Key: {
      "uuid": { S: uuid }
    }
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response.Item;
}

export const putCipher = async (cipher) => {
  const params = {
    TableName: cipherTableName,
    Item: cipher,
  };
  const command = new PutItemCommand(params);
  const response = await client.send(command);
  return response.Attributes;
}

// ========================= Folder =========================

// export type folderSchema = {
//   userUuid: string,
//   uuid: string,
//   name: string,
// }

export const getFolder = async (uuid) => {
  const params = {
    TableName: folderTableName,
    Key: {
      "uuid": { S: uuid }
    }
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response.Item;
}

// ========================= Attachment =========================

// export type attachmentSchema = {
//   cipherUuid: string,
//   uuid: string,
//   filename: string,
//   size: number,
//   key: string,
// }

export const getAttachment = async (uuid) => {
  const params = {
    TableName: attachmentsTableName,
    Key: {
      "uuid": { S: uuid }
    }
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response.Item;
}