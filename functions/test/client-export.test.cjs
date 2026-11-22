const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const ExcelJS=require('exceljs');
function exporter(pages) {
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/operations/exportClients.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  const output={};let blob;let downloaded='';let calls=0;
  vm.runInNewContext(code,{exports:output,require:name=>name==='./api'?{call:async()=>pages[calls++]}:require(name),Blob,
    document:{createElement:()=>({set href(value){},set download(value){downloaded=value;},click(){}})},
    URL:{createObjectURL:value=>{blob=value;return'blob:isolated-test';},revokeObjectURL(){}},setTimeout:callback=>{callback();return 0;}},
    {filename:'client-export-isolated-test.cjs'});
  return{run:output.exportClients,get blob(){return blob;},get filename(){return downloaded;},get calls(){return calls;}};
}
test('Excel export includes all matching pages and preserves strings and consent safely',async()=>{
  const run=exporter([{rows:[{id:'a',name:'=1+1',phone:'+919999999999',updatesOptIn:true,marketingOptIn:false,secret:'must-not-export'}],scanned:250,cursor:'next'},
    {rows:[{id:'b',name:'मराठी क्लायंट',phone:'+919999999998',updatesOptIn:false,marketingOptIn:true}],scanned:1,cursor:null}]);
  assert.equal(await run.run({city:'Pune',from:'2026-11-01'},()=>{},()=>false),2);assert.equal(run.calls,2);assert.ok(run.filename.endsWith('.xlsx'));
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await run.blob.arrayBuffer()));const sheet=book.getWorksheet('Clients');
  assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell('C2').value,'=1+1');assert.equal(sheet.getCell('C2').type,ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('F2').value,'+919999999999');assert.equal(sheet.getCell('M2').value,'Yes');assert.equal(sheet.getCell('N2').value,'No');
  assert.equal(sheet.getCell('C3').value,'मराठी क्लायंट');assert.ok(sheet.autoFilter);assert.equal(sheet.views[0].ySplit,1);
  assert.ok(!JSON.stringify(sheet.getSheetValues()).includes('must-not-export'));
  assert.ok(JSON.stringify(book.getWorksheet('Export scope').getSheetValues()).includes('Pune'));
});
test('cancelled and oversized exports never download a partial workbook',async()=>{
  const cancelled=exporter([]);await assert.rejects(cancelled.run({},()=>{},()=>true),/cancelled/);assert.equal(cancelled.blob,undefined);
  const oversized=exporter([{rows:[],scanned:10001,cursor:null}]);await assert.rejects(oversized.run({},()=>{},()=>false),/10,000/);assert.equal(oversized.blob,undefined);
});
