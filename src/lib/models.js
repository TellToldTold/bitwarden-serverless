import { DynamoDBClient, ReturnValue} from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from 'uuid';

import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';

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

const docClient = DynamoDBDocumentClient.from(client);

const tableNames = {
  devices : process.env.DEVICES_TABLE || 'devices',
  users : process.env.USERS_TABLE || 'users',
  ciphers : process.env.CIPHERS_TABLE || 'ciphers',
  folders : process.env.FOLDERS_TABLE || 'folders',
  attachments : process.env.ATTACHMENTS_TABLE || 'attachments',
}

export const CIPHER_MODEL_VERSION = 2;
export const USER_MODEL_VERSION = 2;


// ========================= Attachment =========================

// export type attachmentSchema = {
//   cipherUuid: string,
//   uuid: string,
//   filename: string,
//   size: number,
//   key: string,
// }

export const queryAttachments = async (cipherUuid) => {
  const params = {
    TableName: tableNames.attachments,
    KeyConditionExpression: "cipherUuid = :cipherUuid",
    ExpressionAttributeValues: {
      ":cipherUuid": cipherUuid
    }
  };

  const command = new QueryCommand(params);
  const response = await docClient.send(command);

  return response.Items;
};

export const putAttachment = async (attachment) => {

  const generatedUuid = uuidv4();

  const params = {
    TableName: tableNames.attachments,
    Item: {
      uuid: generatedUuid,
      ...attachment
    },
  };
  const command = new PutCommand(params);
  await docClient.send(command);
  return generatedUuid;
}

export const deleteAttachment = async (cipherUuid, uuid) => {
  const params = {
    TableName: tableNames.attachments,
    Key: {
      cipherUuid: cipherUuid,
      uuid: uuid
    }
  };
  const command = new DeleteCommand(params);
  const response = await docClient.send(command);
  return response;
}


export const touch = async (table, object) => {
  const params = {
    TableName: tableNames[table],
    Key: {
      uuid: object.uuid
    },
    UpdateExpression: "set updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: ReturnValue.ALL_NEW,
  };
  const command = new UpdateCommand(params);
  const response = await docClient.send(command);
  return response.Attributes;
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

export const getCipher = async (userUuid, uuid) => {
  const params = {
    TableName: tableNames.ciphers,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    }
  };
  const command = new GetCommand(params);
  const response = await docClient.send(command);
  return response.Item;
}

export const updateCipher = async (userUuid, uuid, data) => {
  const params = {
    TableName: tableNames.ciphers,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    },
    UpdateExpression: "set " + Object.keys(data).map(key => `${key} = :${key}`).join(", "),
    ExpressionAttributeValues: data,
    ReturnValues: ReturnValue.ALL_NEW,
  };
  const command = new UpdateCommand(params);
  const response = await docClient.send(command);
  return response.Attributes;
}

export const putCipher = async (cipher) => {

  const generatedUuid = uuidv4();

  const params = {
    TableName: tableNames.ciphers,
    Item: {
      uuid: generatedUuid,
      ...cipher
    },
  };
  const command = new PutCommand(params);
  await docClient.send(command);
  return generatedUuid;
}

export const deleteCipher = async (userUuid, uuid) => {
  const params = {
    TableName: tableNames.ciphers,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    }
  };
  const command = new DeleteCommand(params);
  const response = await docClient.send(command);
  return response;
}


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
    TableName: tableNames.devices,
    Key: {
      uuid: uuid
    }
  };
  const command = new GetCommand(params);
  const response = await docClient.send(command);
  return response.Item;
}

export const updateDevice = async (uuid, pushToken) => {
  const params = {
    TableName: tableNames.devices,
    Key: {
      uuid: uuid
    },
    UpdateExpression: "set pushToken = :pushToken",
    ExpressionAttributeValues: {
      ":pushToken": pushToken,
    },
    ReturnValues: ReturnValue.ALL_NEW,
  };
  const command = new UpdateCommand(params);
  const response = await docClient.send(command);
  return response.Attributes;
}


// ========================= Folder =========================

// export type folderSchema = {
//   userUuid: string,
//   uuid: string,
//   name: string,
// }

export const getFolder = async (userUuid, uuid) => {
  const params = {
    TableName: tableNames.folders,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    }
  };
  const command = new GetCommand(params);
  const response = await docClient.send(command);
  return response.Item;
}

export const updateFolder = async (userUuid, uuid, data) => {
  const params = {
    TableName: tableNames.folders,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    },
    UpdateExpression: "set " + Object.keys(data).map(key => `${key} = :${key}`).join(", "),
    ExpressionAttributeValues: data,
    ReturnValues: ReturnValue.ALL_NEW,
  };
  const command = new UpdateCommand(params);
  const response = await docClient.send(command);
  return response.Attributes;
}

export const putFolder = async (folder) => {

    const generatedUuid = uuidv4();

    const params = {
      TableName: tableNames.folders,
      Item: {
        uuid: generatedUuid,
        ...folder
      },
    };
    const command = new PutCommand(params);
    await docClient.send(command);
    return generatedUuid;
}

export const deleteFolder = async (userUuid, uuid) => {
  const params = {
    TableName: tableNames.folders,
    Key: {
      userUuid: userUuid,
      uuid: uuid
    }
  };
  const command = new DeleteCommand(params);
  const response = await docClient.send(command);
  return response;
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
    TableName: tableNames.devices,
    Key: {
      uuid: uuid
    }
  };
  const command = new GetCommand(params);
  const response = await docClient.send(command);
  return response.Item;
}