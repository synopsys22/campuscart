import { MongoMemoryServer } from 'mongodb-memory-server';

/** Starts one throwaway mongod shared by every test file. */
export default async function setup({ provide }) {
  const server = await MongoMemoryServer.create();
  provide('mongoUri', server.getUri());
  return async () => {
    await server.stop();
  };
}
