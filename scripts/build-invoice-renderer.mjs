import {resolve} from 'node:path';
import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Freeze the same React component and styles used by Print into the Functions package.
const inter=await readFile('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const devanagari=await readFile('functions/assets/NotoSansDevanagari.ttf');
const fontCss=(interUrl,devanagariUrl)=>`/* Inter: SIL OFL, @fontsource-variable/inter. Noto Sans Devanagari: SIL OFL. */\n@font-face{font-family:Inter;src:url(${interUrl}) format('woff2');font-style:normal;font-weight:100 900;font-display:block}\n@font-face{font-family:MVMDevanagari;src:url(${devanagariUrl}) format('truetype');font-style:normal;font-weight:100 900;font-display:block}\n`;
await mkdir('public/assets/fonts',{recursive:true});
const fontKey=(name,bytes,ext)=>`${name}-${createHash('sha256').update(bytes).digest('hex').slice(0,12)}.${ext}`;
const interKey=fontKey('inter-latin',inter,'woff2'),devanagariKey=fontKey('noto-devanagari',devanagari,'ttf');
await writeFile(`public/assets/fonts/${interKey}`,inter);
await writeFile(`public/assets/fonts/${devanagariKey}`,devanagari);
await writeFile('public/assets/fonts/Inter-OFL.txt',await readFile('node_modules/@fontsource-variable/inter/LICENSE'));
await writeFile('public/assets/fonts/Noto-OFL.txt',await readFile('functions/assets/OFL-NotoSansDevanagari.txt'));
await writeFile('src/invoicing/invoice-font.css',fontCss(`/assets/fonts/${interKey}`,`/assets/fonts/${devanagariKey}`));
const embeddedFonts=fontCss(`data:font/woff2;base64,${inter.toString('base64')}`,`data:font/ttf;base64,${devanagari.toString('base64')}`);
await mkdir('functions/generated',{recursive:true});
await writeFile('functions/assets/Inter-OFL.txt',await readFile('node_modules/@fontsource-variable/inter/LICENSE'));

await build({entryPoints:['src/invoicing/invoiceHtml.tsx'],outfile:'functions/generated/invoice-html.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},plugins:[{name:'raw-css',setup(b){b.onResolve({filter:/\.css\?raw$/},args=>({path:resolve(args.resolveDir,args.path.replace(/\?raw$/,'')),namespace:'raw-css'}));b.onLoad({filter:/.*/,namespace:'raw-css'},async args=>({contents:`export default ${JSON.stringify(args.path.endsWith('invoice-font.css')?embeddedFonts:await readFile(args.path,'utf8'))}`,loader:'js'}));}}]});
