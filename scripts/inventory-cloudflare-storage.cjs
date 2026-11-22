// Read-only inventory using the existing Firebase CLI login in memory.
// Never exports tokens, download URLs, or file contents.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../.npm-cache/_npx/ada49d693ef58c83/node_modules/firebase-tools/lib');
(async () => {
  const auth = require(path.join(root, 'auth.js'));
  const options = { project: 'm-v-ml', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(path.resolve(__dirname, '..'));
  if (!account) throw new Error('No existing Firebase CLI login');
  auth.setActiveAccount(options, account);
  await require(path.join(root, 'requireAuth.js')).requireAuth(options);
  const { Client } = require(path.join(root, 'apiv2.js'));
  const client = new Client({ urlPrefix: 'https://storage.googleapis.com', apiVersion: 'storage/v1' });
  const bucket = await require(path.join(root, 'gcp/storage.js')).getDefaultBucket('m-v-ml');
  let pageToken;
  const files = [];
  do {
    const query = new URLSearchParams({ maxResults: '1000', fields: 'items(name,size,contentType,updated),nextPageToken' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = (await client.get(`/b/${bucket}/o?${query}`)).body;
    for (const item of result.items || []) {
      const publicMedia = /^(publicBrands|publicPortfolioVideos)\//.test(item.name);
      files.push({ key: item.name, bytes: Number(item.size), contentType: item.contentType, updated: item.updated,
        access: publicMedia ? 'public-media-candidate' : 'private-review',
        destinationBucket: publicMedia ? 'mvm-public' : 'mvm-private' });
    }
    pageToken = result.nextPageToken;
  } while (pageToken);
  const destination = path.resolve(__dirname, '../output/cloudflare-migration');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'remote-storage-inventory.LOCAL-ONLY.json'), JSON.stringify({ checkedAt: new Date().toISOString(), bucket, files }, null, 2));
  const groups = {};
  for (const f of files) {
    const prefix = f.key.split('/')[0];
    groups[prefix] ??= { count: 0, bytes: 0 };
    groups[prefix].count++; groups[prefix].bytes += f.bytes;
  }
  fs.writeFileSync(path.join(destination, 'remote-storage-summary.json'), JSON.stringify({ checkedAt: new Date().toISOString(), bucket, totalFiles: files.length, groups }, null, 2));
  console.log(JSON.stringify({ bucket, totalFiles: files.length, groups }));
})().catch(error => { console.error('Storage inventory failed: ' + error.message); process.exitCode = 1; });
