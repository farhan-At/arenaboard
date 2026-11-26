import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {arenaServer} from '../src/server.js';
import {fileStore} from '../src/store.js';
const dir=mkdtempSync(join(tmpdir(),'arena-browser-'));
const server=arenaServer(fileStore(dir));
server.listen(0,'127.0.0.1'); await once(server,'listening');
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
  const organiser=await browser.newPage(), viewer=await browser.newPage({viewport:{width:1160,height:800}});
  await organiser.goto('http://127.0.0.1:'+server.address().port);
  await organiser.getByRole('button',{name:'Create bracket'}).click();
  await organiser.waitForURL('**/?board=*');
  await viewer.goto(organiser.url());
  await viewer.getByText(/Spectator view · Live updates connected/).waitFor();
  assert.equal(await viewer.getByText('Save score').count(),0);
  for(const [index,left,right] of [[0,3,1],[1,1,2],[2,2,1]]){
    const game=organiser.locator('article').nth(index);
    const scores=game.getByRole('spinbutton');
    await scores.nth(0).fill(String(left)); await scores.nth(1).fill(String(right));
    await game.getByRole('button',{name:'Save score'}).click();
    await viewer.getByText(new RegExp('Revision '+(index+1))).waitFor();
  }
  assert.match(await viewer.locator('tbody tr').first().innerText(),/Kestrel/);
  mkdirSync('evidence',{recursive:true});
  await viewer.screenshot({path:'evidence/completed-bracket.png',fullPage:true});
  console.log('PASS: separate organiser and spectator sessions. Spectator received revisions 1, 2 and 3 without refresh. Champion: Kestrel.');
} finally {
  if(browser) await browser.close();
  await new Promise(r=>server.close(r));
  rmSync(dir,{recursive:true});
}
