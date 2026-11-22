const { financialYear,buildInvoice,validateSettings }=require('./invoice-domain.cjs');
const { publicIds }=require('./studio-domain.cjs');
const {FieldValue}=require('firebase-admin/firestore');
module.exports=function financial(db){
  function refs(now=new Date()) {const year=financialYear(now.toISOString());return{invoiceCounter:db.doc(`invoiceCounters/${year}`),publicCounter:db.doc(`publicCounters/${publicIds({},['client'],now).year}`),settings:db.doc('settings/invoicing')};}
  async function read(tx,orderId,now=new Date()){
    const r=refs(now);const [settings,counter,publicCounter,invoice]=await Promise.all([tx.get(r.settings),tx.get(r.invoiceCounter),tx.get(r.publicCounter),tx.get(db.doc(`invoices/${orderId}`))]);
    return{refs:r,settings:settings.exists?validateSettings(settings.data()):null,counter:counter.data()?.sequence??0,counts:publicCounter.data()??{},invoice:invoice.data(),now};
  }
  function invoice(tx,orderId,order,context){
    if(context.invoice)return context.invoice;
    if(!context.settings)throw new Error('Complete invoice business details before confirming orders');
    const sequence=context.counter+1;if(!Number.isSafeInteger(sequence)||sequence<1||sequence>999999)throw new Error('Invoice sequence requires owner attention');const number=`${context.settings.prefix}/${financialYear(context.now.toISOString())}/${String(sequence).padStart(6,'0')}`;
    const result=buildInvoice(order,context.settings,number,context.now.toISOString());const {agreedTotalPaise,...snapshot}=result;
    const value={...snapshot,id:orderId,orderId,orderPublicId:order.publicId??orderId,documentType:'invoice',contactId:order.contactId??order.clientUid,createdAt:FieldValue.serverTimestamp()};
    tx.create(db.doc(`invoices/${orderId}`),value);tx.set(context.refs.invoiceCounter,{sequence});
    tx.create(db.doc(`financialDocuments/invoice-${orderId}`),{...value,id:`invoice-${orderId}`,pdfStatus:'pending',immutable:true});
    context.invoice=value;return value;
  }
  async function forPayment(paymentId){
    const now=new Date();return db.runTransaction(async tx=>{
      const [paymentSnap,receiptSnap]=await Promise.all([tx.get(db.doc(`payments/${paymentId}`)),tx.get(db.doc(`financialDocuments/receipt-${paymentId}`))]);
      if(!paymentSnap.exists||receiptSnap.exists)return;
      const payment=paymentSnap.data();const orderRef=db.doc(`orders/${payment.orderId}`);const orderSnap=await tx.get(orderRef);if(!orderSnap.exists)throw new Error('Payment order is missing');
      const order=orderSnap.data();const context=await read(tx,payment.orderId,now);
      const invoiceValue=invoice(tx,payment.orderId,order,context);
      const allocation=publicIds(context.counts,['payment','receipt'],now);
      const paymentPublicId=payment.publicId??allocation.ids.payment;
      const total=order.paymentMode==='bypass'?0:order.billedTotalPaise??invoiceValue.totalPaise;
      const paid=payment.cumulativePaidPaise??order.paidPaise??payment.amountPaise;const cancelled=payment.latePayment===true;const balance=cancelled?0:Math.max(0,total-paid);
      const stage=cancelled?'Receipt · cancelled bill':balance===0?'Final payment receipt':paid===payment.amountPaise?'Advance receipt':'Part-payment receipt';
      const receipt={...invoiceValue,id:`receipt-${paymentId}`,documentType:'receipt',documentTitle:stage,number:allocation.ids.receipt,
        invoiceNumber:invoiceValue.number,paymentId,paymentPublicId,issuedAt:now.toISOString(),createdAt:FieldValue.serverTimestamp(),
        receiptAmountPaise:payment.amountPaise,paidPaise:paid,balancePaise:balance,paymentStatus:cancelled?'Received after cancellation':balance===0?'Paid in full':'Advance / part payment received',
        method:payment.method,reference:payment.reference??'',receivedAtISO:payment.receivedAtISO,pdfStatus:'pending',immutable:true,
        items:[{description:stage,quantity:1,unitPaise:payment.amountPaise,linePaise:payment.amountPaise}],
        note:payment.unappliedPaise>0?`This receipt records money actually received. ${payment.unappliedPaise/100} INR exceeds the invoice balance and requires refund review.`:cancelled?'Money received against a cancelled bill. This payment remains recorded and requires refund review.':'This receipt records money actually received. It does not add another charge to the invoice.'};
      tx.create(db.doc(`financialDocuments/receipt-${paymentId}`),receipt);
      tx.set(context.refs.publicCounter,allocation.next);
      tx.update(paymentSnap.ref,{publicId:paymentPublicId,receiptDocumentId:receipt.id});
      tx.update(orderRef,{timeline:require('./booking-workflow.cjs').history(order,{id:'payment-'+paymentId,kind:'payment',label:balance===0?'Payment received in full':'Payment received',atISO:payment.receivedAtISO??now.toISOString(),details:{amountPaise:payment.amountPaise,method:payment.method,receiptNumber:receipt.number}}),invoiceId:payment.orderId,lastReceiptDocumentId:receipt.id,financialStatus:order.billingStatus==='cancelled'?(order.refundReviewRequired?'cancelled-refund-review':'cancelled'):(order.paidPaise??paid)>=total?'settled':'part-paid'});
      tx.set(db.doc('operationsState/payments'),{updatedAt:FieldValue.serverTimestamp()});tx.set(db.doc('operationsState/studio'),{updatedAt:FieldValue.serverTimestamp()});
    });
  }
  return{read,invoice,forPayment};
};
