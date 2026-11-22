const MAX_VIDEO_BYTES=8*1024*1024;
function videoBytes(data){
 if(typeof data.base64!=='string'||data.base64.length>Math.ceil(MAX_VIDEO_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))throw new Error('Choose an MP4 or WebM up to 8 MB');
 const bytes=Buffer.from(data.base64,'base64');if(!bytes.length||bytes.length>MAX_VIDEO_BYTES)throw new Error('Choose an MP4 or WebM up to 8 MB');
 const mp4=bytes.length>12&&bytes.toString('ascii',4,8)==='ftyp',webm=bytes.length>4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
 if(!mp4&&!webm)throw new Error('Upload an original MP4 or WebM video');
 return{bytes,extension:mp4?'mp4':'webm',contentType:mp4?'video/mp4':'video/webm'};
}
function directVideoURL(value=''){
 if(!value)return'';const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||['instagram.com','www.instagram.com','youtube.com','www.youtube.com','youtu.be','drive.google.com'].includes(u.hostname))throw new Error('Use a direct HTTPS video-file link or upload an original video');
 return u.href;
}
module.exports={videoBytes,directVideoURL,MAX_VIDEO_BYTES};
