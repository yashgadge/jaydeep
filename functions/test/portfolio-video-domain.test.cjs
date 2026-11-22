const test=require('node:test'),assert=require('node:assert/strict'),D=require('../portfolio-video-domain.cjs');
test('Direct playback requires HTTPS media links instead of Instagram or Drive viewer pages',()=>{
 assert.equal(D.directVideoURL(''),'');assert.equal(D.directVideoURL('https://cdn.example.invalid/reel.mp4'),'https://cdn.example.invalid/reel.mp4');
 for(const url of ['javascript:alert(1)','http://cdn.example.invalid/reel.mp4','https://www.instagram.com/reel/abc/','https://drive.google.com/file/d/id/view','https://user:pass@example.invalid/reel.mp4'])assert.throws(()=>D.directVideoURL(url));
});
test('Video uploads enforce actual file headers and size caps',()=>{
 const mp4=Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0]);assert.equal(D.videoBytes({base64:mp4.toString('base64')}).extension,'mp4');
 assert.throws(()=>D.videoBytes({base64:Buffer.from('<html>not video</html>').toString('base64')}));
 assert.throws(()=>D.videoBytes({base64:Buffer.alloc(D.MAX_VIDEO_BYTES+1).toString('base64')}));
});
