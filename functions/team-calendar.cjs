// Read every affected reservation before applying any transaction writes.
module.exports=async function planTeamMove(tx,db,orderId,order,nextDate,nextSlot){
 const members=[...new Set(order.assignees??[])];
 const plans=await Promise.all(members.map(async uid=>{
  const oldRef=db.doc(`teamSlots/${uid}_${order.shootDate}_${order.slot}`),nextRef=nextDate?db.doc(`teamSlots/${uid}_${nextDate}_${nextSlot}`):null;
  const [old,next]=await Promise.all([tx.get(oldRef),nextRef?tx.get(nextRef):null]);
  if(next&&Object.keys(next.data()?.orders??{}).some(id=>id!==orderId))throw new Error('An assigned team member is already reserved for the new slot. Choose another slot.');
  return{uid,oldRef,nextRef,oldOrders:old.data()?.orders??{},nextOrders:next?.data()?.orders??{}};
 }));
 return()=>{for(const p of plans){const orders={...p.oldOrders};delete orders[orderId];tx.set(p.oldRef,{uid:p.uid,date:order.shootDate,slot:order.slot,orders});if(p.nextRef)tx.set(p.nextRef,{uid:p.uid,date:nextDate,slot:nextSlot,orders:{...p.nextOrders,[orderId]:true}});}};
};
