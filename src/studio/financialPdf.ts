import {call} from '../operations/api';
type PDFFile={base64:string;filename:string};
export async function financialPDF(id:string):Promise<PDFFile>{
 const cached=await call<unknown,PDFFile&{ready:boolean}>('getStoredFinancialPDF',{id});
 return cached.ready?cached:call<unknown,PDFFile>('getFinancialPDF',{id});
}
