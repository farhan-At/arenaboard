import fs from 'node:fs';
import path from 'node:path';
import {MongoClient} from 'mongodb';

export function fileStore(directory) {
  fs.mkdirSync(directory, {recursive: true});
  const filename = id => path.join(directory, id + '.json');
  function put(doc) {
    const temp = filename(doc.id) + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(doc), {mode: 0o600});
    fs.renameSync(temp, filename(doc.id));
  }
  function get(id) {
    try { return JSON.parse(fs.readFileSync(filename(id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return {get, insert: put, replace(doc, revision) {
    if (get(doc.id)?.board.revision !== revision) return false;
    put(doc);
    return true;
  }};
}

export async function mongoStore(uri) {
  const client = await MongoClient.connect(uri);
  const boards = client.db('arenaboard').collection('tournaments');
  await boards.createIndex({id: 1}, {unique: true});
  return {insert: doc => boards.insertOne(doc), get: id => boards.findOne({id}),
    async replace(doc, revision) {
      return (await boards.replaceOne({id: doc.id, 'board.revision': revision}, doc)).modifiedCount === 1;
    }, close: () => client.close()};
}
