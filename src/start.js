import {arenaServer} from './server.js';
import {fileStore, mongoStore} from './store.js';

const store = process.env.MONGO_URL ? await mongoStore(process.env.MONGO_URL) : fileStore(process.env.DATA_DIR || 'data');
const port = Number(process.env.PORT || 3000);
arenaServer(store).listen(port, process.env.HOST || '127.0.0.1', () => console.log('ArenaBoard listening on port ' + port));
