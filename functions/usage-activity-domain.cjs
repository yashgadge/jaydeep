function activityRow(snapshot){
 const value=snapshot.data()??{};
 return{...value,id:snapshot.id,auditId:snapshot.id,entityId:value.id??value.orderId??value.enquiryId??value.contactId??'',atISO:value.atISO??value.at?.toDate?.().toISOString()??''};
}
module.exports={activityRow};
